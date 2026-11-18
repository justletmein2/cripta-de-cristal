"""Apaga lâminas (sabre, kunais) dos quadros do vídeo do Vampiro: tudo que é metal claro e sem cor,
fora da cabeça, é pintado por cima com o que está em volta (inpaint).
uso: python3 tirar_lamina.py <pasta_quadros> <pasta_saida>"""
import sys, os, glob
import numpy as np, cv2
from scipy import ndimage
ent, sai = sys.argv[1], sys.argv[2]
os.makedirs(sai, exist_ok=True)
for f in sorted(glob.glob(os.path.join(ent, '*.png'))):
    im = cv2.imread(f)                       # BGR
    v = im.max(2).astype(int); ch = v - im.min(2).astype(int)
    fig = v > 30
    ys, xs = np.nonzero(fig)
    metal = (v > 85) & (ch < 34)
    # cabeça: a mancha clara que contém o topo da figura (cabelo + rosto)
    lab, n = ndimage.label(ndimage.binary_dilation(metal, iterations=3))
    cabeca = np.zeros_like(metal)
    if len(ys):
        topo = ys.min()
        perto = (np.abs(np.arange(im.shape[0])[:, None] - topo) < 60) & metal
        ids = set(np.unique(lab[perto])) - {0}
        cabeca = np.isin(lab, list(ids))
        # a cabeça não desce mais que ~170px a partir do topo
        cabeca[topo + 170:] = False
    lamina = metal & ~cabeca
    # só coisas finas/compridas ou soltas: ignora manchas largas (mão, rosto)
    larga = ndimage.binary_opening(lamina, iterations=4)
    lamina &= ~ndimage.binary_dilation(larga, iterations=3)
    # cresce a partir da lâmina achada: partes borradas mais escuras do metal e a pedra vermelha do cabo
    perto = ndimage.binary_dilation(lamina, iterations=7)
    for _ in range(3):
        b, g, r = im[..., 0].astype(int), im[..., 1].astype(int), im[..., 2].astype(int)
        metal_fraco = (v > 45) & (ch < 40)
        pedra = (r > 120) & (r - g > 80) & (r - b > 60)
        novo = perto & (metal_fraco | pedra) & ~cabeca
        lamina |= novo
        perto = ndimage.binary_dilation(lamina, iterations=7) & ~ndimage.binary_dilation(cabeca, iterations=4)
    lamina = ndimage.binary_dilation(lamina, iterations=3)
    out = cv2.inpaint(im, lamina.astype(np.uint8), 7, cv2.INPAINT_TELEA)
    cv2.imwrite(os.path.join(sai, os.path.basename(f)), out)
