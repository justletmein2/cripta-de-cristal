# Monta as folhas de sprite do jogo a partir dos pacotes da reinvogames (itch.io).
# Os pacotes originais NÃO ficam no repositório (a licença proíbe redistribuir).
# Uso: python3 montar_sprites.py <pasta-do-hero> <pasta-da-swordswoman> <saida>
import sys, glob, json, os
from PIL import Image

ESCALA = 0.75          # 384px -> 288px por quadro
ANCORA = (208, 360)    # pés do personagem dentro do quadro de 384px
MAXW = 4000

PACOTES = {
    'cavaleiro_m': (sys.argv[1], {
        'parado': 'standing-idle', 'correr': 'run-armed', 'pular': 'jump', 'atk1': 'standing-melee-attack-horizontal',
        'atk2': 'crouch-slash', 'ferido': 'standing-react-large', 'morrer': 'death-1'}),
    'cavaleiro_f': (sys.argv[2], {
        'parado': 'standing-idle', 'correr': 'run-with-sword', 'pular': 'jump', 'atk1': 'standing-overhead-slash',
        'ferido': 'standing-react-large', 'morrer': 'death-1'}),
}
saida = sys.argv[3]
for nome, (pasta, anims) in PACOTES.items():
    meta = {'escala': ESCALA, 'anims': {}}
    tiras = []
    for chave, an in anims.items():
        f = glob.glob(os.path.join(pasta, 'animations', an, '*384x384.png'))[0]
        im = Image.open(f).convert('RGBA')
        n = im.size[0] // 384
        caixa = None
        for i in range(n):
            b = im.crop((i * 384, 0, i * 384 + 384, 384)).getbbox()
            if b: caixa = b if caixa is None else (min(caixa[0], b[0]), min(caixa[1], b[1]), max(caixa[2], b[2]), max(caixa[3], b[3]))
        x0, y0, x1, y1 = caixa
        w, h = round((x1 - x0) * ESCALA), round((y1 - y0) * ESCALA)
        quadros = [im.crop((i * 384 + x0, y0, i * 384 + x1, y1)).resize((w, h), Image.LANCZOS) for i in range(n)]
        tiras.append((chave, quadros, w, h, x0, y0))
    # empilha: cada animação numa faixa (quebra em linhas se passar de MAXW)
    larg = max(min(MAXW, w * len(q)) for _, q, w, _, _, _ in tiras)
    y = 0; colocar = []
    for chave, q, w, h, x0, y0 in tiras:
        por = max(1, larg // w)
        linhas = -(-len(q) // por)
        meta['anims'][chave] = {'y': y, 'w': w, 'h': h, 'n': len(q), 'por': por,
                                'ox': round((x0 - ANCORA[0]) * ESCALA), 'oy': round((y0 - ANCORA[1]) * ESCALA)}
        for i, fr in enumerate(q): colocar.append((fr, (i % por) * w, y + (i // por) * h))
        y += linhas * h
    atlas = Image.new('RGBA', (larg, y))
    for fr, px, py in colocar: atlas.alpha_composite(fr, (px, py))
    atlas.save(os.path.join(saida, nome + '.webp'), 'WEBP', quality=86, method=6)
    json.dump(meta, open(os.path.join(saida, nome + '.json'), 'w'))
    print(nome, atlas.size, os.path.getsize(os.path.join(saida, nome + '.webp')) // 1024, 'KB')
