"""Regera os atlas de alta resolução sem mudar o tamanho lógico dos personagens.

Uso: python -m venv .venv && .venv/bin/pip install Pillow
     .venv/bin/python scripts/build-sprite-atlases.py
Os PNG originais enviados pelo usuário ficam em art/source/.

Cada personagem jogável (Fang Yuan e Bai Ning Bing) tem quatro poses (caminhada,
conjuração, arremetida e queda). As poses de um personagem compartilham o MESMO
fator de escala: se cada pose fosse escalada pela própria altura, o personagem
mudaria de tamanho ao trocar de animação. O fator também é comum aos dois
personagens, para que um não fique maior que o outro.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/source'
DEST = ROOT / 'public/assets'

# Célula da grade 4×4 nos masters enviados (1920 / 4).
MASTER_CELL = 480


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


def subject(source: Image.Image, row_range: tuple[int, int], col: int,
            stride: int = MASTER_CELL, x_start: int = 0) -> Image.Image:
    """Recorta um quadro e descarta apenas o halo quase invisível ao redor."""
    top, bottom = row_range
    left = x_start + col * stride
    frame = source.crop((left, top, left + stride, bottom))
    bounds = frame.getchannel('A').point(lambda value: 255 if value > 8 else 0).getbbox()
    if bounds is None:
        raise ValueError('Quadro vazio no master')
    return frame.crop(bounds)


def feet_center_x(frame: Image.Image, band: float = 0.2) -> float:
    """Centro horizontal dos pés (faixa inferior do quadro).

    O bbox inteiro muda quando o braço se estende na conjuração; ancorar pelo centro
    do bbox faria o corpo pular de lado entre quadros. Os pés não se movem com o gesto.
    """
    width, height = frame.size
    alpha = frame.getchannel('A').load()
    columns = [x for y in range(int(height * (1 - band)), height)
               for x in range(width) if alpha[x, y] > 8]
    return sum(columns) / len(columns) if columns else width / 2


def facing_side(atlas_path: Path, cell: int, row: int) -> str | None:
    """Lado para onde o personagem olha num quadro de uma linha lateral do atlas.

    O rosto é a área clara (pele) no terço superior do quadro. Comparar a média
    horizontal dela com o centro do corpo revela o lado: serve para conferir que a
    linha `left` não acabou com o desenho virado para a direita — foi exatamente o
    defeito que o usuário viu ao andar, quando as linhas 2 e 4 dos masters novos
    vieram invertidas.

    Devolve `None` quando não há pele visível (linhas de frente e de costas).
    """
    atlas = Image.open(atlas_path).convert('RGBA')
    frame = atlas.crop((0, row * cell, cell, row * cell + cell))
    pixels = [(x, y, red + green + blue)
              for y in range(cell) for x in range(cell)
              for red, green, blue, alpha in [frame.getpixel((x, y))] if alpha > 60]
    if not pixels:
        return None
    rows = [pixel[1] for pixel in pixels]
    head_limit = min(rows) + 0.30 * (max(rows) - min(rows))
    skin = [pixel for pixel in pixels if pixel[1] < head_limit and pixel[2] > 3 * 105]
    if not skin:
        return None
    face = sum(pixel[0] for pixel in skin) / len(skin)
    body = sum(pixel[0] for pixel in pixels) / len(pixels)
    if face > body + 2:
        return 'right'
    if face < body - 2:
        return 'left'
    return None


def check_side_rows(atlas_path: Path, cell: int, label: str) -> None:
    """Falha a geração se as linhas laterais do atlas não olharem para o lado certo."""
    expected = {1: 'left', 3: 'right'}
    for row, side in expected.items():
        found = facing_side(atlas_path, cell, row)
        if found != side:
            raise ValueError(f'{label}: linha {row} deveria olhar para {side}, veio {found}')
    print(f'{label}: linhas laterais olham para o lado certo (esquerda na 2ª, direita na 4ª)')


def build_grid(name: str, source_file: str, dest_file: str, cols: int, rows: int,
               size: int, body_height: int, body_width: int, scale: float | None = None,
               crop_to_subject: bool = True, stride: int = MASTER_CELL,
               x_start: int = 0, feet_anchor: bool = False,
               row_map: list[int] | None = None) -> float:
    """Monta um atlas de grade. `scale` compartilhado mantém o corpo do mesmo tamanho
    entre poses; quando omitido, o fator é calculado só com este atlas.

    `row_map` reordena as linhas do master na saída (ex.: o desenho vem em
    down/right/up/left e o atlas do jogo é down/left/up/right). Sem ele a ordem é a mesma.
    """
    source = Image.open(SOURCE / source_file).convert('RGBA')
    row_ranges = rows_from_alpha(source, x_start, cols * stride, rows)
    frames = [[subject(source, row_ranges[row], col, stride, x_start) for col in range(cols)]
              for row in range(rows)]
    order = row_map if row_map is not None else list(range(rows))
    if sorted(order) != list(range(rows)):
        raise ValueError(f'{name}: row_map inválido para {rows} linhas: {order}')
    if scale is None:
        widest = max(frame.width for line in frames for frame in line)
        tallest = max(frame.height for line in frames for frame in line)
        scale = min(body_height / tallest, body_width / widest)
    atlas = Image.new('RGBA', (cols * size, rows * size))
    for row, master_row in enumerate(order):
        line = frames[master_row]
        for col, frame in enumerate(line):
            if crop_to_subject:
                width = max(1, round(frame.width * scale))
                height = max(1, round(frame.height * scale))
                anchor = feet_center_x(frame) * scale if feet_anchor else width / 2
                frame = frame.resize((width, height), Image.Resampling.LANCZOS)
                dest_x = col * size + round(size / 2 - anchor)
                # O gesto pode ser mais largo que a célula: mantém o quadro inteiro.
                dest_x = max(col * size, min(dest_x, col * size + size - width))
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
    return scale


def effect_mask(source: Image.Image) -> Image.Image:
    """Transforma as partículas em máscara clara para o jogo pintar por Gu.

    A cor sai do `visual.color` do catálogo em tempo real, então a folha guarda só o
    desenho: cada pixel mantém o alfa e recebe o brilho normalizado (o traço mais claro
    vira branco). Assim o tint multiplica e o efeito fica legível em qualquer Gu, sem
    precisar de uma folha de arte por cor.
    """
    rgba = source.convert('RGBA')
    masked = []
    for red, green, blue, alpha in list(rgba.getdata()):
        light = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
        # Normaliza para o traço chegar ao branco: a arte original é escura demais
        # para multiplicar por uma cor saturada e continuar visível sobre a grama.
        value = 255 if light >= 0.75 else round(min(255, 110 + 145 * (light / 0.75)))
        masked.append((value, value, value, alpha))
    output = Image.new('RGBA', rgba.size)
    output.putdata(masked)
    return output


def pose_scale(masters: dict[str, str]) -> float:
    """Um único fator para as quatro poses de um personagem: mede o maior quadro.

    Sem isso cada pose calcularia o próprio fator pela própria altura e o
    personagem cresceria ao conjurar ou encolheria ao cair.
    """
    widest = tallest = 0
    for source_file in masters.values():
        source = Image.open(SOURCE / source_file).convert('RGBA')
        for top, bottom in rows_from_alpha(source, 0, 4 * MASTER_CELL, 4):
            for col in range(4):
                frame = subject(source, (top, bottom), col)
                widest = max(widest, frame.width)
                tallest = max(tallest, frame.height)
    return min(56 / tallest, 60 / widest)


def player_scale() -> float:
    """Escala comum a TODOS os personagens jogáveis: preserva a proporção
    relativa das artes e mantém o mesmo tamanho no mundo."""
    return min(pose_scale(masters) for masters in PLAYER_MASTERS.values())


# Personagens jogáveis: mesma grade 4×4 de 480px por pose, quatro poses cada.
PLAYER_MASTERS = {
    'fang-yuan': {
        'walk': 'fang-yuan-walk-4dir-4frames-master.png',
        'cast': 'fang-yuan-cast-4dir-4frames-master.png',
        'dash': 'fang-yuan-dash-4dir-4frames-master.png',
        'down': 'fang-yuan-down-4dir-4frames-master.png',
    },
    'bai-ning-bing': {
        'walk': 'bai-ning-bing-walk-4dir-4frames-master.png',
        'cast': 'bai-ning-bing-cast-4dir-4frames-master.png',
        'dash': 'bai-ning-bing-dash-4dir-4frames-master.png',
        'down': 'bai-ning-bing-down-4dir-4frames-master.png',
    },
}

# Os masters desenham as linhas como baixo, DIREITA, cima, esquerda — o inverso do
# atlas do jogo (baixo, esquerda, cima, direita). Sem esta troca o personagem anda
# para a esquerda com o sprite virado para a direita (e vice-versa) nas quatro poses.
# Conferido olhando o lado do rosto em cada linha: 1ª linha = direita, 4ª = esquerda.
# Vale para os dois personagens: as duas artes vieram do mesmo gerador.
MASTER_ROW_MAP = [0, 3, 2, 1]

# Só o Fang Yuan tem a pele contrastada o bastante para a conferência automática do
# lado do rosto; o Bai Ning Bing tem cabelo branco em volta do rosto e o teste mede
# a coisa errada. Para ele a ordem foi conferida olhando quadro a quadro.
CHECK_SIDE_ROWS = {'fang-yuan'}

# Efeitos de gelo do Bai Ning Bing: 4 formas × 4 quadros de 480px. Viram máscara,
# então a cor também vem do código (nada de arte duplicada por cor).
ICE_EFFECTS_MASTER = 'ice-effects-4x4-master.png'
ICE_EFFECTS_ATLAS = 'characters/ice-effects-4x4-48.png'
ICE_EFFECTS_CELL = 48


def mask_into_place(path: Path) -> None:
    """Reescreve um atlas de efeitos como máscara clara (o jogo pinta a cor)."""
    image = Image.open(path).convert('RGBA')
    effect_mask(image).save(path, optimize=True)


if __name__ == '__main__':
    scale = player_scale()
    print(f'escala compartilhada dos personagens: {scale:.4f}')
    for character, masters in PLAYER_MASTERS.items():
        for pose, source_file in masters.items():
            build_grid(f'{character} ({pose})', source_file,
                       f'characters/{character}-{pose}-64.png', 4, 4, 64, 56, 60, scale,
                       feet_anchor=True, row_map=MASTER_ROW_MAP)
            if character in CHECK_SIDE_ROWS:
                check_side_rows(DEST / f'characters/{character}-{pose}-64.png', 64,
                                f'{character} ({pose})')
        # Retrato do painel: mesma pose, quadro 32px, 4×4 (o CSS usa 256px de fundo).
        build_grid(f'{character} (retrato)', masters['walk'],
                   f'characters/{character}-walk-32.png', 4, 4, 32, 28, 30, scale,
                   feet_anchor=True, row_map=MASTER_ROW_MAP)
    build_grid('NPCs', 'npc-static-4dir-master.png',
               'npcs/npc-static-4dir-64.png', 4, 10, 64, 58, 60, stride=192, x_start=576)
    build_grid('mobs', 'mob-static-4dir-master.png',
               'mobs/mob-static-4dir-64.png', 4, 15, 64, 58, 60, stride=216, x_start=528)
    build_grid('bosses', 'boss-static-4dir-master.png',
               'bosses/boss-static-4dir-96.png', 4, 4, 96, 96, 96,
               crop_to_subject=False)

    # Partículas de efeito: 4 formas × 4 quadros de 32px.
    effects = Image.open(SOURCE / 'gu-effects-4x4-32.png').convert('RGBA')
    effect_mask(effects).save(DEST / 'characters/gu-effects-4x4-32.png', optimize=True)
    print('Efeitos de Gu: 4×4 quadros 32px -> public/assets/characters/gu-effects-4x4-32.png')

    # Efeitos de gelo: a célula inteira é reduzida (sem recorte) para manter o
    # crescimento do quadro dentro da animação de cada forma.
    build_grid('Efeitos de gelo', ICE_EFFECTS_MASTER, ICE_EFFECTS_ATLAS, 4, 4,
               ICE_EFFECTS_CELL, ICE_EFFECTS_CELL, ICE_EFFECTS_CELL, scale=1.0,
               crop_to_subject=False)
    mask_into_place(DEST / ICE_EFFECTS_ATLAS)
    print(f'Efeitos de gelo: 4×4 quadros {ICE_EFFECTS_CELL}px -> public/assets/{ICE_EFFECTS_ATLAS}')
