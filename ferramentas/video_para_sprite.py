# Transforma os vídeos da Maga (gerados por IA, fundo preto) numa folha de sprite do jogo.
# Uso: python3 video_para_sprite.py <pasta_quadros_A> <pasta_quadros_B> <saida_sem_extensao>
# (os quadros saem do vídeo com: ffmpeg -i video.mp4 pasta/%03d.png)
import sys, json, os
import numpy as np
from PIL import Image
from scipy import ndimage

A, B, SAIDA = sys.argv[1], sys.argv[2], sys.argv[3]
ESC = 0.38          # 720p do vídeo -> folha
K = 1 / 1.4         # a folha tem 1.4x a resolução da dos cavaleiros
FUNDO = 5

# animação: (pasta, quadros, espelhar?, ancora)  ancora: 'tronco' = alinha cada quadro pelo tronco; 'fixa' = alinha pelo 1º quadro
ANIMS = {
    'parado': (B, list(range(1, 31, 2)), False, 'fixa'),       # toca indo e voltando
    'correr': (A, list(range(30, 46)), False, 'tronco'),       # ciclo de 16 quadros (30 = 46)
    'pular':  (B, list(range(52, 97, 3)), False, 'base'),
    'atk1':   (A, list(range(64, 96, 2)), True, 'fixa'),
    'morrer': (A, list(range(150, 191, 3)), True, 'fixa'),
}

def recortar(pasta, i, esp):
    rgb = np.array(Image.open(os.path.join(pasta, f'{i:03d}.png')).convert('RGB')).astype(np.float32)
    if esp: rgb = rgb[:, ::-1]
    v = rgb.max(2)
    suave = np.clip((v - 14) / 26, 0, 1)
    solido = v > 24
    lab, n = ndimage.label(solido)
    if n:
        tam = ndimage.sum(solido, lab, range(1, n + 1))
        solido = np.isin(lab, [k + 1 for k, t in enumerate(tam) if t > 150])
    solido = ndimage.binary_closing(solido, iterations=2)
    buracos = ndimage.binary_fill_holes(solido) & ~solido      # só tapa buracos pequenos (não o vão entre as pernas)
    lb, nb = ndimage.label(buracos)
    if nb:
        tb = ndimage.sum(buracos, lb, range(1, nb + 1))
        solido = solido | np.isin(lb, [k + 1 for k, t in enumerate(tb) if t < 1500])
    alfa = np.maximum(suave, ndimage.binary_erosion(solido, iterations=1).astype(np.float32))
    alfa[~ndimage.binary_dilation(solido, iterations=3)] = 0
    a = np.maximum(alfa, 1e-3)[..., None]
    cor = np.clip((rgb - FUNDO * (1 - a)) / a, 0, 255)
    return np.dstack([cor, alfa * 255]).astype(np.uint8), solido

def tronco_x(m):
    ys, xs = np.nonzero(m)
    y0, y1 = ys.min(), ys.max(); h = y1 - y0
    faixa = (ys > y0 + h * 0.18) & (ys < y0 + h * 0.5)
    return np.median(xs[faixa])

meta = {'escala': ESC, 'k': K, 'anims': {}}
tiras = []
for nome, (pasta, quadros, esp, anc) in ANIMS.items():
    imgs, ancoras = [], []
    for i in quadros:
        im, m = recortar(pasta, i, esp)
        ys, xs = np.nonzero(m)
        ancoras.append((tronco_x(m), ys.max()))
        imgs.append(im)
    base_y = max(a[1] for a in ancoras)
    x_ref = ancoras[0][0]
    # desloca cada quadro pra ancora comum
    alinhados = []
    for im, (tx, by) in zip(imgs, ancoras):
        dx = (x_ref - tx) if anc == 'tronco' else 0
        dy = (base_y - by) if anc == 'base' else 0
        alinhados.append(ndimage.shift(im, (dy, dx, 0), order=0, mode='constant'))
    caixa = None
    for im in alinhados:
        ys, xs = np.nonzero(im[..., 3] > 8)
        b = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        caixa = b if caixa is None else (min(caixa[0], b[0]), min(caixa[1], b[1]), max(caixa[2], b[2]), max(caixa[3], b[3]))
    x0, y0, x1, y1 = caixa
    w, h = round((x1 - x0) * ESC), round((y1 - y0) * ESC)
    fr = [Image.fromarray(im[y0:y1, x0:x1]).resize((w, h), Image.LANCZOS) for im in alinhados]
    tiras.append((nome, fr, w, h, round((x0 - x_ref) * ESC), round((y0 - base_y) * ESC)))

larg = min(4000, max(w * len(q) for _, q, w, *_ in tiras))
y = 0; colocar = []
for nome, q, w, h, ox, oy in tiras:
    por = max(1, larg // w); linhas = -(-len(q) // por)
    meta['anims'][nome] = {'y': y, 'w': w, 'h': h, 'n': len(q), 'por': por, 'ox': ox, 'oy': oy}
    for i, f in enumerate(q): colocar.append((f, (i % por) * w, y + (i // por) * h))
    y += linhas * h
atlas = Image.new('RGBA', (larg, y))
for f, px, py in colocar: atlas.alpha_composite(f, (px, py))
atlas.save(SAIDA + '.webp', 'WEBP', quality=86, method=6)
json.dump(meta, open(SAIDA + '.json', 'w'))
print(atlas.size, os.path.getsize(SAIDA + '.webp') // 1024, 'KB', {k: v['n'] for k, v in meta['anims'].items()})
