"""Regera atlas de alta resolução sem mudar o tamanho lógico dos personagens.

Uso: python -m venv .venv && .venv/bin/pip install Pillow
     .venv/bin/python scripts/build-sprite-atlases.py
Os PNG originais enviados pelo usuário ficam em art/source/.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/source'
DEST = ROOT / 'public/assets'


def rows_from_alpha(source: Image.Image, x: int, span: int, count: int) -> list[tuple[int, int]]:
    """Corta entre linhas no espaço realmente transparente, não na grade nominal:
    os pés nos masters de 1920px passam alguns pixels do limite teórico.
    """
    alpha = source.getchannel('A')
    runs: list[tuple[int, int]] = []
    start = None
    for y in range(source.height):
        occupied = alpha.crop((x, y, x + span, y + 1)).point(
            lambda value: 255 if value > 100 else 0).getbbox() is not None
        if not occupied and start is None:
            start = y
        elif occupied and start is not None:
            if y - start >= 2:
                runs.append((start, y - 1))
            start = None
    if start is not None:
        runs.append((start, source.height - 1))
    if len(runs) != count + 1:
        raise ValueError(f'Esperados {count + 1} intervalos transparentes, recebidos {runs}')
    boundaries = [0] + [(start + end) // 2 + 1 for start, end in runs[1:-1]]
    boundaries.append(source.height)
    return list(zip(boundaries, boundaries[1:]))


def build(name: str, source_file: str, dest_file: str, cols: int, rows: int,
          x_start: int, x_stride: int, size: int, body_height: int, body_width: int,
          crop_to_subject: bool = True):
    source = Image.open(SOURCE / source_file).convert('RGBA')
    atlas = Image.new('RGBA', (cols * size, rows * size))
    row_ranges = rows_from_alpha(source, x_start, cols * x_stride, rows)
    for row, (top, bottom) in enumerate(row_ranges):
        for col in range(cols):
            left = x_start + col * x_stride
            frame = source.crop((left, top, left + x_stride, bottom))
            if crop_to_subject:
                # Ignora apenas halos quase invisíveis ao localizar a silhueta;
                # os canais RGBA verdadeiros não são alterados no recorte.
                bounds = frame.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
                if bounds is None:
                    raise ValueError(f'Sprite vazio: {name} {row},{col}')
                frame = frame.crop(bounds)
                factor = min(body_height / frame.height, body_width / frame.width)
                width = max(1, round(frame.width * factor))
                height = max(1, round(frame.height * factor))
                frame = frame.resize((width, height), Image.Resampling.LANCZOS)
                dest_x = col * size + (size - width) // 2
                dest_y = row * size + size - height - 2  # pés alinhados entre poses
            else:
                # Bosses já têm uma célula larga; não aparar patas/caudas na borda.
                frame = frame.resize((size, size), Image.Resampling.LANCZOS)
                dest_x, dest_y = col * size, row * size
            atlas.paste(frame, (dest_x, dest_y))
    output = DEST / dest_file
    output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output, optimize=True)
    print(f'{name}: {cols}×{rows} quadros {size}px -> {output.relative_to(ROOT)}')


if __name__ == '__main__':
    build('Fang Yuan', 'fang-yuan-walk-4dir-4frames-master.png',
          'characters/fang-yuan-walk-64.png', 4, 4, 0, 480, 64, 56, 60)
    build('NPCs', 'npc-static-4dir-master.png',
          'npcs/npc-static-4dir-64.png', 4, 10, 576, 192, 64, 58, 60)
    build('mobs', 'mob-static-4dir-master.png',
          'mobs/mob-static-4dir-64.png', 4, 15, 528, 216, 64, 58, 60)
    build('bosses', 'boss-static-4dir-master.png',
          'bosses/boss-static-4dir-96.png', 4, 4, 0, 480, 96, 96, 96, False)
