"""Recorta um retrato (peito pra cima) de imagem com fundo preto, no padrão 440x470 do corte de cena.
uso: python3 ferramentas/retrato.py <imagem> <saida.webp> x0 y0 x1 y1"""
import sys
from PIL import Image
import numpy as np, cv2
src, saida = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = map(int, sys.argv[3:7])
im = Image.open(src).convert('RGB')
c = np.array(im.crop((x0, y0, x1, y1)).resize((440, 470), Image.LANCZOS))
m = c.max(axis=2).astype(np.float32)
T = 34
n, lab = cv2.connectedComponents((m < T).astype(np.uint8), connectivity=4)
borda = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(borda))
# buracos pretos grandes e bem escuros (vãos entre cabelo/capa e corpo)
n2, l2, st, _ = cv2.connectedComponentsWithStats((m < 20).astype(np.uint8), connectivity=4)
for i in range(1, n2):
    if st[i][4] >= 400: bg |= (l2 == i)
a = np.full(m.shape, 255, np.float32)
a[bg] = np.clip((m[bg] - 14) / (T - 14), 0, 1) * 255
a = cv2.GaussianBlur(a, (3, 3), 0)
h, w = a.shape
f = np.ones(h); f[-80:] = np.linspace(1, 0, 80); a *= f[:, None]
g = np.ones(w); g[-70:] = np.linspace(1, 0, 70); g[:90] = np.linspace(0, 1, 90) ** 1.5; a *= g[None, :]
out = np.dstack([c, a.astype(np.uint8)])
Image.fromarray(out).save(saida, quality=90)
pv = Image.new('RGBA', (w, h), (120, 40, 160, 255)); pv.alpha_composite(Image.fromarray(out))
pv.convert('RGB').save(saida.rsplit('/', 1)[-1].replace('.webp', '_prev.png'))
