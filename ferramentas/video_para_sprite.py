# Transforma os vídeos da Maga (gerados por IA, fundo preto) numa folha de sprite do jogo.
# Uso: python3 video_para_sprite.py <heroi> <pasta_video_1> <pasta_video_2> <saida_sem_extensao>
#   heroi: mago_f ou mago_m (cada um tem sua lista de trechos abaixo)
# (os quadros saem do vídeo com: ffmpeg -i video.mp4 pasta/%03d.png)
import sys, json, os
import numpy as np
from PIL import Image
from scipy import ndimage

HEROI, A, B, SAIDA = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
ESC = 0.38          # 720p do vídeo -> folha
K = 1 / 1.4         # a folha tem 1.4x a resolução da dos cavaleiros
FUNDO = 2 if sys.argv[1].startswith('vampiro') else 5

# animação: (pasta, quadros, espelhar?, ancora)  ancora: 'tronco' = alinha cada quadro pelo tronco; 'fixa' = alinha pelo 1º quadro
TRECHOS = {}
TRECHOS['mago_f'] = {
    'parado': (B, list(range(1, 31, 2)), True, 'fixa'),        # toca indo e voltando (no vídeo ela olha pra esquerda)
    'correr': (A, list(range(30, 46)), False, 'tronco'),       # ciclo de 16 quadros (30 = 46)
    'pular':  (B, list(range(52, 97, 3)), True, 'base'),
    'atk1':   (A, list(range(64, 96, 2)), True, 'fixa'),
    'morrer': (A, list(range(150, 191, 3)), True, 'fixa'),
}
# Mago: video 1 = Flow "action sequence" (parado, corrida, pulo), video 2 = Flow "criar animação" (magia, golpe, queda)
TRECHOS['mago_m'] = {
    'parado': (A, list(range(7, 32, 2)), False, 'fixa'),       # começo tem fumacinha, pula
    'correr': (A, list(range(45, 75, 2)), False, 'tronco'),      # ciclo de 30 quadros (45 = 75)
    'pular':  (A, list(range(106, 126, 2)), True, 'base'),        # no vídeo ele pula virado pra esquerda
    'atk1':   (B, list(range(67, 113, 3)), False, 'fixa'),
    'morrer': (B, list(range(140, 172, 2)), False, 'fixa'),
}
# Vampira: um vídeo só (Flow). Parado olhando pra direita; golpe, corrida e "morrer" virada pra esquerda.
# Não tem pulo: usa o meio da corrida (pernas no ar).
TRECHOS['vampiro_f'] = {
    'parado': (A, list(range(1, 20, 2)), False, 'fixa'),
    'correr': (A, list(range(150, 163)), True, 'tronco'),      # ciclo de 13 quadros (150 = 163)
    'pular':  (A, list(range(146, 160, 2)), True, 'tronco'),
    'atk1':   (A, list(range(40, 95, 3)), True, 'fixa'),       # garras: prepara, estica, segura, recolhe
    'atk2':   (A, list(range(97, 126, 2)), True, 'fixa'),      # giro com a perna (golpe final)
    'morrer': (A, list(range(125, 141, 3)), True, 'fixa'),
}
# Vampiro: vídeo do Flow com sabre e kunais, apagados antes com tirar_lamina.py (pasta "limpa").
# Corre e lança virado pra direita; pulo virado pra esquerda; sem pose parada (usa o fim do pouso).
TRECHOS['vampiro_m'] = {
    'parado': (A, [188, 189, 190], True, 'base'),               # fim da queda, já com as pernas esticadas, pés alinhados no chão
    'correr': (A, list(range(20, 37)), False, 'tronco'),        # ciclo de 17 quadros (20 = 37)
    'pular':  (A, list(range(137, 186, 3)), True, 'tronco'),
    'atk1':   (A, [63, 66, 69] + list(range(105, 126, 2)), False, 'fixa'),   # recolhe e estica o braço (pula os quadros com o leque de kunais)
    'morrer': (A, list(range(129, 138, 2)), True, 'fixa'),
}
ANIMS = TRECHOS[HEROI]
# roupa escura em fundo preto puro: corte bem mais baixo
LIM = (4, 8, 7) if HEROI.startswith('vampiro') else (14, 26, 24)   # início do suave, largura, sólido
LIMPAR_VERMELHO = HEROI == 'mago_m'   # o vídeo 1 do Mago saiu com manchas vermelhas no rosto

def recortar(pasta, i, esp):
    rgb = np.array(Image.open(os.path.join(pasta, f'{i:03d}.png')).convert('RGB')).astype(np.float32)
    if esp: rgb = rgb[:, ::-1]
    if LIMPAR_VERMELHO:
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        mancha = (r > 120) & (g < r * 0.5) & (b < r * 0.5) & (r - g > 70)
        mancha = ndimage.binary_dilation(mancha, iterations=2)
        import cv2
        rgb = cv2.inpaint(rgb.astype(np.uint8), mancha.astype(np.uint8), 6, cv2.INPAINT_TELEA).astype(np.float32)
    v = rgb.max(2)
    suave = np.clip((v - LIM[0]) / LIM[1], 0, 1)
    solido = v > LIM[2]
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

def limpar_vampiro(im, m, nome):
    # tira pedaços soltos (kunais voando) e, no golpe, as kunais finas na mão (abertura morfológica na frente do corpo)
    a = im[..., 3] > 20
    if nome == 'atk1':
        tx = int(tronco_x(m))
        frente = np.zeros_like(a); frente[:, tx + 90:] = True
        fino = a & ~ndimage.binary_opening(a, iterations=5)
        a &= ~(fino & frente)
    lab, n = ndimage.label(a)
    if n > 1:
        tam = ndimage.sum(a, lab, range(1, n + 1))
        a = np.isin(lab, [k + 1 for k, t in enumerate(tam) if t > tam.max() * 0.04])
    im = im.copy(); im[..., 3] = np.where(a, im[..., 3], 0)
    return im, m & a

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
        if HEROI == 'vampiro_m': im, m = limpar_vampiro(im, m, nome)
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
