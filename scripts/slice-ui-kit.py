#!/usr/bin/env python3
"""Separa o atlas de interface enviado pelo usuário nos arquivos que o jogo usa.

O atlas é uma folha única (1536×1024) com painéis, cabeçalho, moldura de retrato,
barras, botões, ícones de Gu e peças do HUD. Este script recorta cada peça, gera
os estados derivados (hover/pressed/disabled) e publica tudo em `public/assets/ui/`.

Regras que vêm do pedido:
  * nenhum texto é recortado — rótulos continuam sendo HTML/DOM (o jogo é PT-BR);
  * a arte é publicada em escala 2× do tamanho de exibição (o atlas já é 2×);
  * as barras de vida/essência são brancas, para recoloração em CSS/código;
  * a moldura de retrato tem centro transparente.

Uso:
    /tmp/venv2/bin/python scripts/slice-ui-kit.py [--check]

`--check` só mede e imprime as caixas, sem escrever arquivos.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art/source/ui/ui-kit-source.png'
OUT = ROOT / 'public/assets/ui'
MANIFEST = ROOT / 'art/source/ui/ui-kit.json'

ALPHA_MIN = 24


# ── Caixas de recorte (coordenadas do atlas) ────────────────────────────────
# Cada janela isola um elemento; o recorte real é apertado pelo alfa.
REGIONS: dict[str, tuple[int, int, int, int]] = {
    'panel-9slice': (10, 10, 420, 285),
    'header-3slice': (420, 20, 900, 130),
    'bar-track': (425, 125, 890, 193),
    'bar-fill': (425, 193, 890, 258),
    'frame-portrait': (920, 18, 1170, 266),
    'card-gu-9slice': (14, 270, 346, 530),
    'divider-3slice': (14, 528, 326, 596),
    'btn-list-9slice': (24, 606, 320, 672),
    'chip-9slice': (515, 604, 670, 660),
    'card-recipe-9slice': (696, 664, 1000, 730),
    'card-character-9slice': (696, 600, 1000, 666),
    'pill-green-3slice': (1072, 750, 1292, 812),
    'pill-gold-3slice': (1288, 750, 1510, 812),
    'slot-gu-9slice': (1078, 884, 1448, 958),
    'joystick-base': (1070, 482, 1262, 674),
    'knob': (1264, 518, 1372, 626),
    'badge-cicada': (1400, 386, 1495, 487),
    'cursor-target': (1398, 910, 1496, 996),
    'btn-basic': (1075, 268, 1186, 378),
    'icon-diamond': (1026, 950, 1094, 1018),
    'icon-medal-red': (1094, 948, 1164, 1018),
    'icon-drop-blue': (1164, 950, 1232, 1018),
    'icon-arrow-green': (1232, 948, 1302, 1018),
    'btn-small-green': (342, 598, 500, 656),
    'btn-small-brown': (342, 652, 500, 704),
    'btn-small-slate': (342, 700, 500, 754),
    'btn-small-red': (342, 752, 500, 806),
}

# Botões de fechar: normal / hover / pressionado / desativado.
CLOSE_STATES = [
    (1214, 16, 1322, 121),
    (1322, 16, 1428, 121),
    (1214, 121, 1322, 222),
    (1322, 121, 1428, 222),
]

# Grade de ícones de Gu: 8 colunas × 5 linhas de células (~62 px).
GRID_BOX = (530, 272, 1032, 590)
GRID_COLS, GRID_ROWS = 8, 5

# Mapa Gu → célula do atlas. A escolha segue o elemento/cor de cada Gu; os ícones
# do pack são sigilos elementais, não retratos canônicos de Gu.
GU_CELLS: dict[str, int] = {
    'moonlight': 7, 'bone-spear': 20, 'star-arrow': 0, 'star-dart': 9,
    'ghost-fire': 27, 'exploding-egg': 2,
    'stone-skin': 26, 'jade-skin': 23, 'bronze-skin': 13, 'iron-skin': 17,
    'rock-skin': 30, 'beast-skin': 12,
    'liquor-worm': 19, 'little-light': 3, 'amplify-effect': 31,
    'cleansing-water': 5, 'flash-blink': 32, 'all-out-effort': 16,
    'whirlwind': 1, 'clear-wind-wheel': 14, 'dragonpill-cricket': 35,
    'bear-strength': 25, 'white-boar': 36, 'black-boar': 29,
    'moonglow': 21, 'white-jade': 28,
}


def crop_trim(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """Recorta a janela e aperta até o conteúdo visível (alfa acima do limite)."""
    x0, y0, x1, y1 = box
    piece = image.crop((x0, y0, x1, y1))
    alpha = piece.getchannel('A').point(lambda v: 255 if v > ALPHA_MIN else 0)
    bounds = alpha.getbbox()
    if bounds is None:
        raise SystemExit(f'recorte vazio: {box}')
    return piece.crop(bounds)


def fit_square(piece: Image.Image, size: int, pad: float = 0.06) -> Image.Image:
    """Centraliza a peça num quadro quadrado, preservando a proporção."""
    inner = max(1, int(size * (1 - pad * 2)))
    scale = min(inner / piece.width, inner / piece.height)
    resized = piece.resize(
        (max(1, round(piece.width * scale)), max(1, round(piece.height * scale))),
        Image.LANCZOS,
    )
    frame = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    frame.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return frame


def state(piece: Image.Image, brightness: float = 1.0, color: float = 1.0,
          alpha: float = 1.0, desaturate: float = 0.0) -> Image.Image:
    """Estado derivado: o pack só traz um desenho por botão, então hover/pressed
    são variações de brilho/saturação do mesmo pixel art (sem inventar arte)."""
    out = piece
    if desaturate:
        grey = ImageEnhance.Color(out).enhance(1 - desaturate)
        out = grey
    if brightness != 1.0:
        out = ImageEnhance.Brightness(out).enhance(brightness)
    if color != 1.0:
        out = ImageEnhance.Color(out).enhance(color)
    if alpha != 1.0:
        band = out.getchannel('A').point(lambda v: int(v * alpha))
        out = out.copy()
        out.putalpha(band)
    return out


def strip(frames: list[Image.Image]) -> Image.Image:
    """Cola quadros lado a lado (tira de estados)."""
    width = sum(f.width for f in frames)
    height = max(f.height for f in frames)
    out = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    x = 0
    for frame in frames:
        out.alpha_composite(frame, (x, (height - frame.height) // 2))
        x += frame.width
    return out


def punch_center(piece: Image.Image) -> Image.Image:
    """Abre o centro da moldura de retrato.

    O atlas entrega o miolo pintado com o fundo do painel; para o retrato do
    personagem aparecer, o miolo precisa ser transparente de verdade.
    """
    pixels = piece.copy()
    alpha = pixels.getchannel('A')
    fill = pixels.getpixel((pixels.width // 2, pixels.height // 2))
    work = pixels.load()
    alpha_mask = alpha.load()
    stack = [(pixels.width // 2, pixels.height // 2)]
    seen = set()
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < pixels.width and 0 <= y < pixels.height):
            continue
        seen.add((x, y))
        r, g, b, a = work[x, y]
        if a == 0 or abs(r - fill[0]) + abs(g - fill[1]) + abs(b - fill[2]) > 26:
            continue
        alpha_mask[x, y] = 0
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    pixels.putalpha(alpha)
    return pixels


def erase_inner_line(piece: Image.Image, rows: tuple[int, int]) -> Image.Image:
    """Remove a linha decorativa interna do cartão.

    Com 9-slice essa linha cairia no meio elástico e se repetiria em todo cartão
    de tamanho variável; o traço é decoração de mock, não estrutura.
    """
    pixels = piece.copy()
    fill = pixels.getpixel((pixels.width // 2, min(pixels.height - 2, rows[1] + 6)))
    work = pixels.load()
    for y in range(rows[0], rows[1]):
        for x in range(24, pixels.width - 24):
            r, g, b, a = work[x, y]
            if a and r + g + b > 150:
                work[x, y] = (fill[0], fill[1], fill[2], a)
    return pixels


def build_gu_grid(image: Image.Image) -> Image.Image:
    """Reorganiza as células da folha numa grade 8×8 de células de 64 px."""
    x0, y0, x1, y1 = GRID_BOX
    cell_w = (x1 - x0) / GRID_COLS
    cell_h = (y1 - y0) / GRID_ROWS
    grid = Image.new('RGBA', (64 * 8, 64 * 8), (0, 0, 0, 0))
    filled = 0
    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            box = (round(x0 + col * cell_w), round(y0 + row * cell_h),
                   round(x0 + (col + 1) * cell_w), round(y0 + (row + 1) * cell_h))
            cell = crop_trim(image, box)
            if cell.width < 12 or cell.height < 12:
                continue
            index = row * GRID_COLS + col
            grid.alpha_composite(fit_square(cell, 64, pad=0.03),
                                 ((index % 8) * 64, (index // 8) * 64))
            filled += 1
    if filled < 26:
        raise SystemExit(f'grade de Gu incompleta: {filled} células')
    return grid


def main() -> None:
    check_only = '--check' in sys.argv
    if not SOURCE.exists():
        raise SystemExit(f'atlas ausente: {SOURCE.relative_to(ROOT)}')
    image = Image.open(SOURCE).convert('RGBA')
    if image.size != (1536, 1024):
        raise SystemExit(f'atlas inesperado: {image.size[0]}×{image.size[1]}')

    OUT.mkdir(parents=True, exist_ok=True)
    report: dict[str, dict[str, object]] = {}
    written: list[tuple[str, Image.Image]] = []

    for name, box in REGIONS.items():
        piece = crop_trim(image, box)
        report[name] = {'source_box': list(box), 'size': list(piece.size)}
        print(f'{name:24s} {piece.width:4d}×{piece.height:<4d}  <- {box}')
        if name == 'joystick-base':
            piece = piece.resize((232, 232), Image.LANCZOS)
        elif name == 'btn-basic':
            piece = fit_square(piece, 128, pad=0.02)
        elif name.startswith('icon-'):
            piece = fit_square(piece, 64, pad=0.04)
        elif name == 'frame-portrait':
            piece = punch_center(piece)
        elif name == 'card-gu-9slice':
            piece = erase_inner_line(piece, (96, 102))
        if name != 'knob':
            written.append((name, piece))

    # Botões de fechar (4 estados) e knob do direcional (3 estados).
    close_frames = [fit_square(crop_trim(image, box), 88, pad=0.02) for box in CLOSE_STATES]
    written.append(('btn-close-4x88', strip(close_frames)))

    knob = fit_square(crop_trim(image, REGIONS['knob']), 128, pad=0.02)
    written.append(('btn-round-4x128', strip([
        knob,
        state(knob, brightness=1.2, color=1.08),
        state(knob, brightness=0.78, color=0.95),
        state(knob, brightness=0.85, desaturate=0.85, alpha=0.55),
    ])))
    knob_small = knob.resize((96, 96), Image.LANCZOS)
    written.append(('joystick-knob-3x96', strip([
        knob_small,
        state(knob_small, brightness=1.16, color=1.05),
        state(knob_small, brightness=0.82),
    ])))

    grid = build_gu_grid(image)
    written.append(('gu-icons-8x8-64', grid))

    if not check_only:
        for name, piece in written:
            piece.save(OUT / f'{name}.png', optimize=True)
        MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_text(json.dumps({
            'source': str(SOURCE.relative_to(ROOT)),
            'atlas_size': list(image.size),
            'display_scale': 0.5,
            'regions': report,
            'gu_cells': GU_CELLS,
            'close_states': ['normal', 'hover', 'pressed', 'disabled'],
            'round_states': ['normal', 'hover', 'pressed', 'disabled'],
            'knob_states': ['idle', 'active', 'pressed'],
        }, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'\n{len(written)} arquivos em {OUT.relative_to(ROOT)}')
        print(f'manifesto em {MANIFEST.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
