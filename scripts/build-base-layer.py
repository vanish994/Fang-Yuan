#!/usr/bin/env python3
"""Gera o atlas da camada de chão da vila: public/assets/village/base-tiles-64.png.

Fonte: sheets do free-asset-pack já no repo (1. Grass and dirt, 6. Dirt paths).
Cada tile é recortado do sheet (centro e tamanho medidos no pack), reduzido para 64 px
(BOX) e colocado numa grade de 8 colunas × 5 linhas. Os índices estão em
src/world/village/villageMap.ts (BASE_TILE) e a ordem é a mesma daqui.

O layout (alturas e superfície) NÃO é gerado aqui: fica em src/world/village/baseLayout.ts.

Uso (precisa de Pillow):  python3 scripts/build-base-layer.py
"""
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
PACK = REPO / 'public/assets/tilesets/free-asset-pack'
GRASS = PACK / '1. Grass and dirt.png'
PATHS = PACK / '6. Dirt paths.png'
ROCKS = PACK / '3. Rocks and cliffs.png'
# Blocos de piso de pedra no sheet ROCKS (x0, y0, x1, y1), medidos por alfa.
STONE_BLOCKS = {'escada-a': (44, 748, 247, 955), 'escada-b': (726, 748, 930, 955)}
OUT = REPO / 'public/assets/village/base-tiles-64.png'
COLS, ROWS, TILE = 8, 7, 64

# (arquivo, centro x, centro y, tamanho do recorte) na ordem dos índices do atlas.
TILES = []
# 0-11 (grama e terra): recorte com inset de 8 px (tamanho 196). Com 212 px a borda do recorte
# pega o gutter semitransparente da folha, e as emendas entre tiles ficavam pretas no jogo.
TILES += [(GRASS, cx, 212, 196) for cx in [175, 433, 696, 965, 1235, 1497]]   # 0-5 grama
TILES += [(GRASS, cx, 450, 196) for cx in [175, 433, 696, 965, 1235, 1497]]   # 6-11 terra
TILES += [(GRASS, cx, 690, 212) for cx in [175, 433, 697, 965, 1235, 1497]]   # 12-17 penhascos
# 18-19 escadas: não vêm do pack. São compostas a partir dos blocos de piso de pedra do sheet
# "3. Rocks and cliffs" (ver stairs_tile). Aqui fica um marcador que é substituído em main().
TILES += [(ROCKS, 0, 0, 0), (ROCKS, 0, 0, 0)]                                 # 18-19 escadas (pedra)
TILES += [(PATHS, cx, 250, 212) for cx in [119, 336, 552, 767, 962, 1171, 1394]]  # 20-26 caminhos (20 = vertical)
TILES += [(PATHS, cx, 542, 240) for cx in [157, 443, 728, 1020, 1340]]        # 27-31 cruzamentos
TILES += [(PATHS, 162, 846, 212), (PATHS, 438, 846, 212)]                     # 32 arco, 33 vertical largo
assert len(TILES) == 34
# 34-51: penhascos girados. Grama (topo do penhasco) voltada para o lado do patamar.
#   34-39 CW  (patamar a leste: grama à direita)
#   40-45 CCW (patamar a oeste: grama à esquerda)
#   46-51 180 (patamar ao sul: grama embaixo)
ROTATIONS = [('CW', Image.ROTATE_270), ('CCW', Image.ROTATE_90), ('180', Image.ROTATE_180)]


def crop(img, cx, cy, size):
    half = size // 2
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img.crop((cx - half, cy - half, cx - half + size, cy - half + size)), (0, 0))
    return out


def stone_block(img, box, inset=12):
    x0, y0, x1, y1 = box
    return img.crop((x0 + inset, y0 + inset, x1 - inset, y1 - inset)).resize((TILE, TILE), Image.BOX)


def stairs_tile(base):
    """Degraus horizontais (4 patamares de 16 px): piso claro, espelho escuro, laterais escuras."""
    t = base.copy()
    px = t.load()
    for k in range(4):
        top = 16 * k
        for y in range(top, top + 16):
            f = 1.22 if y - top < 11 else 0.48   # piso do degrau mais claro; espelho sombreado
            for x in range(TILE):
                r, g, b, _ = px[x, y]
                px[x, y] = (min(255, int(r * f)), min(255, int(g * f)), min(255, int(b * f)), 255)
        for x in range(TILE):                     # beirada clara no topo de cada degrau
            r, g, b, _ = px[x, top]
            px[x, top] = (min(255, r + 25), min(255, g + 25), min(255, b + 25), 255)
    for y in range(TILE):                         # laterais de pedra escura (3 px)
        for x in list(range(0, 3)) + list(range(TILE - 3, TILE)):
            r, g, b, _ = px[x, y]
            px[x, y] = (int(r * 0.7), int(g * 0.7), int(b * 0.7), 255)
    return t


def main():
    atlas = Image.new('RGBA', (COLS * TILE, ROWS * TILE), (0, 0, 0, 0))
    cache = {}
    base = []
    for i, (path, cx, cy, size) in enumerate(TILES):
        if path == ROCKS:
            base.append(None)  # preenchido abaixo (escadas)
            continue
        if path not in cache:
            cache[path] = Image.open(path).convert('RGBA')
        t = crop(cache[path], cx, cy, size).resize((TILE, TILE), Image.BOX)
        base.append(t)
    rocks = Image.open(ROCKS).convert('RGBA')
    base[18] = stairs_tile(stone_block(rocks, STONE_BLOCKS['escada-a']))
    base[19] = stairs_tile(stone_block(rocks, STONE_BLOCKS['escada-b']))
    faces = base[12:18]
    rotated = [f.transpose(m) for _, m in ROTATIONS for f in faces]
    for i, t in enumerate(base + rotated):
        atlas.paste(t, ((i % COLS) * TILE, (i // COLS) * TILE), t)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT)
    print('escrito', OUT.relative_to(REPO), atlas.size, 'tiles', len(TILES) + 18)


if __name__ == '__main__':
    main()
