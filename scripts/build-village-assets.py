#!/usr/bin/env python3
"""
Gera os dados de assets usados pelo mapa da vila (src/world/village/).

Entradas: os packs originais em public/assets/tilesets/.
Saídas:
  - public/assets/village/props/*.png : peças do Feudal Japan redimensionadas e cortadas
    (derivados; os originais continuam em tilesets/feudal-japan-props/).
  - src/world/village/assetCatalog.ts : catálogo gerado (recortes do Harmonious Seasons,
    tamanhos das peças do Feudal, máscaras do platô e do lago).

Uso (Python 3 com Pillow, numpy e scipy):
  python3 scripts/build-village-assets.py

Não editar o catálogo gerado à mão: rode o script de novo.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
HARM = ROOT / "public/assets/tilesets/harmonious-seasons"
FEUD = ROOT / "public/assets/tilesets/feudal-japan-props/Tiles"
OUT_PROPS = ROOT / "public/assets/village/props"
OUT_CATALOG = ROOT / "src/world/village/assetCatalog.ts"

# Escala das peças do Feudal (~192 px) para o grid de 64 px do jogo.
FEUDAL_SCALE = 2 / 3

# Recortes do Harmonious (32 px nativos). Cada sheet vira vários frames por componente conexo.
HARM_SHEETS = {
    "hm-trees-big": "Trees/Big_Trees/Big_NormalTrees.png",
    "hm-trees-bigger": "Trees/Bigger_Trees/Bigger_NormalTrees.png",
    "hm-trees-small": "Trees/Small_Trees/NormalTrees.png",
    "hm-bushes": "Bushes/Anim_Bush_1.png",
    "hm-rocks": "Miscellaneous/rocks.png",
    "hm-stumps": "Miscellaneous/Tree_Stumps_and_Bark.png",
    "hm-pebbles": "Miscellaneous/sticks_and_pebbles.png",
    "hm-grass": "Grasses/Anim_Grass_1.png",
    "hm-flowers": "Flowers/Anim_Flower_A.png",
}

# Peças do Feudal usadas no mapa (nome do arquivo sem .png -> chave curta).
FEUDAL_PROPS = {
    "house-machiya": "TownShops/jpn_town_shops_machiya_shop_facade_01.png",
    "house-teahouse": "TownShops/jpn_town_shops_teahouse_facade_01.png",
    "house-ryokan": "TownShops/jpn_town_shops_ryokan_inn_facade_01.png",
    "house-sake": "TownShops/jpn_town_shops_sake_shop_barrels_01.png",
    "well-stone": "TownShops/jpn_town_shops_street_stone_well_01.png",
    "notice-board": "TownShops/jpn_town_shops_town_notice_board_01.png",
    "lantern-post": "TownShops/jpn_town_shops_lantern_post_paper_01.png",
    "bench": "TownShops/jpn_town_shops_outdoor_bench_cushion_01.png",
    "firewood": "ProvisionsCamp/jpn_provisions_camp_firewood_stack_camp_01.png",
    "hay-bale": "ProvisionsCamp/jpn_provisions_camp_hay_bale_camp_01.png",
    "water-barrels": "ProvisionsCamp/jpn_provisions_camp_water_supply_barrels_01.png",
    "produce-basket": "MarketFood/jpn_market_food_produce_basket_filled_01.png",
    "vegetable-crates": "MarketFood/jpn_market_food_vegetable_crates_stack_01.png",
    "rice-bales": "MarketFood/jpn_market_food_rice_bales_tawara_01.png",
    "pottery-jars": "Props/jpn_props_pottery_jar_group_01.png",
    "bamboo-baskets": "Props/jpn_props_bamboo_basket_group_01.png",
    "bamboo-fence": "Architecture/jpn_architecture_fence_bamboo_01.png",
    "bamboo-grove": "GardenNature/jpn_garden_nature_bamboo_grove_cluster_01.png",
    "pine-tree": "GardenNature/jpn_garden_nature_pine_tree_shaped_01.png",
    "moss-rock": "GardenNature/jpn_garden_nature_moss_mound_rock_01.png",
    "stone-steps": "Architecture/jpn_architecture_stone_steps_tile_01.png",
}


def components(alpha: np.ndarray, dilate: int = 1, min_area: int = 30) -> list[tuple[int, int, int, int]]:
    """Caixas (x, y, w, h) de grupos conexos de pixels opacos, com canopy agrupado por dilatação."""
    grown = ndimage.binary_dilation(alpha, iterations=dilate)
    labels, _ = ndimage.label(grown, structure=np.ones((3, 3)))
    boxes = []
    for sl in ndimage.find_objects(labels):
        if sl is None:
            continue
        y0, x0 = sl[0].start, sl[1].start
        sub = alpha[sl]
        if sub.sum() < min_area:
            continue
        ys, xs = np.where(sub)
        boxes.append((x0 + int(xs.min()), y0 + int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)))
    boxes.sort(key=lambda b: (b[1] // 16, b[0]))
    return boxes


def cell_classes(path: Path, cs: int = 32) -> list[str]:
    """Classifica cada célula cs×cs: '.' vazio, 'g' grama, 'c' terra/falésia, 'w' água, '?' outro."""
    a = np.array(Image.open(path).convert("RGBA")).astype(float)
    H, W = a.shape[:2]
    rows = []
    for y in range(0, H, cs):
        row = []
        for x in range(0, W, cs):
            c = a[y : y + cs, x : x + cs]
            if c[..., 3].mean() / 255 < 0.5:
                row.append(".")
                continue
            r, g, b = c[..., :3][c[..., 3] > 128].mean(axis=0)
            if g > r * 1.25 and g > b:
                row.append("g")
            elif r > g * 1.1 and r > b * 1.2:
                row.append("c")
            elif b > g and b > r:
                row.append("w")
            else:
                row.append("?")
        rows.append("".join(row))
    return rows


def water_holes(rows: list[str]) -> list[str]:
    """Células transparentes que não tocam a borda: são o buraco de água do lago."""
    grid = np.array([[ch == "." for ch in r] for r in rows])
    outside = ndimage.label(grid)[0]
    border_labels = set(np.unique(np.concatenate([outside[0], outside[-1], outside[:, 0], outside[:, -1]])))
    out = []
    for y, r in enumerate(rows):
        s = ""
        for x, ch in enumerate(r):
            hole = ch == "." and outside[y, x] not in border_labels
            s += "w" if hole else ch
        out.append(s)
    return out


def main() -> None:
    OUT_PROPS.mkdir(parents=True, exist_ok=True)

    # 1) Recortes do Harmonious.
    harm_entries = []
    for key, rel in HARM_SHEETS.items():
        path = HARM / rel
        alpha = np.array(Image.open(path).convert("RGBA"))[..., 3] > 0
        frames = components(alpha)
        harm_entries.append((key, f"assets/tilesets/harmonious-seasons/{rel}", frames))

    # Tile de água do lago: primeira célula de 32 px com conteúdo opaco (a célula 0,0 é vazia).
    lake_path = HARM / "Water/WaterTilesAnimated/Lake_Water_Anim.png"
    lake_alpha = np.array(Image.open(lake_path).convert("RGBA"))[..., 3]
    water_tile = None
    for ty in range(0, lake_alpha.shape[0], 32):
        for tx in range(0, lake_alpha.shape[1], 32):
            if water_tile is None and lake_alpha[ty : ty + 32, tx : tx + 32].mean() > 128:
                water_tile = (tx, ty, 32, 32)
    assert water_tile is not None, "sem tile de água no Lake_Water_Anim"

    # 2) Peças do Feudal: corte pelo alfa e redução para FEUDAL_SCALE.
    feudal_entries = {}
    for key, rel in FEUDAL_PROPS.items():
        im = Image.open(FEUD / rel).convert("RGBA")
        bbox = im.getbbox()
        im = im.crop(bbox)
        w, h = im.size
        nw, nh = max(1, round(w * FEUDAL_SCALE)), max(1, round(h * FEUDAL_SCALE))
        im = im.resize((nw, nh), Image.LANCZOS)
        out = OUT_PROPS / f"{key}.png"
        im.save(out, optimize=True)
        feudal_entries[key] = (f"assets/village/props/{key}.png", nw, nh)

    # 3) Máscaras do platô e do lago.
    plateau_rows = cell_classes(HARM / "Cliffs/Cliffs_Grass.png")
    pond_rows = water_holes(cell_classes(HARM / "Water/WaterEdges/Deep_Water_Grass.png"))

    # 4) Catálogo TypeScript.
    lines = [
        "/**",
        " * GERADO por scripts/build-village-assets.py. Não editar à mão.",
        " *",
        " * Recortes em pixels nativos dos packs (cada frame é um componente conexo do sheet).",
        " * Máscaras: uma letra por célula de 32 px nativos (ver a legenda em cada constante).",
        " */",
        "",
        "/** Um recorte de um sheet, em pixels nativos. */",
        "export interface SheetFrame {",
        "  name: string;",
        "  x: number;",
        "  y: number;",
        "  w: number;",
        "  h: number;",
        "}",
        "",
        "export interface SheetDef {",
        "  key: string;",
        "  file: string;",
        "  frames: SheetFrame[];",
        "}",
        "",
        "/** Sheets do Harmonious Seasons (32 px nativos) recortados em componentes. */",
        "export const HARMONIOUS_SHEETS: SheetDef[] = [",
    ]
    for key, file, frames in harm_entries:
        lines.append("  {")
        lines.append(f"    key: '{key}',")
        lines.append(f"    file: '{file}',")
        lines.append("    frames: [")
        for i, (x, y, w, h) in enumerate(frames):
            lines.append(f"      {{ name: '{key}-{i}', x: {x}, y: {y}, w: {w}, h: {h} }},")
        lines.append("    ],")
        lines.append("  },")
    lines.append("];")
    lines.append("")
    lines.append(f"/** Tile de água do lago (frame 0 do Lake_Water_Anim): x, y, w, h nativos. */")
    lines.append(f"export const LAKE_WATER_TILE = {{ file: 'assets/tilesets/harmonious-seasons/Water/WaterTilesAnimated/Lake_Water_Anim.png', x: {water_tile[0]}, y: {water_tile[1]}, w: {water_tile[2]}, h: {water_tile[3]} }} as const;")
    lines.append("")
    lines.append("/** Peças do Feudal Japan já redimensionadas (FEUDAL_SCALE) e cortadas pelo alfa. */")
    lines.append("export const FEUDAL_PROPS: Record<string, { file: string; w: number; h: number }> = {")
    for key, (file, w, h) in feudal_entries.items():
        lines.append(f"  '{key}': {{ file: '{file}', w: {w}, h: {h} }},")
    lines.append("};")
    lines.append("")
    lines.append("/**")
    lines.append(" * Platô do Cliffs_Grass (30×15 células de 32 px). Legenda:")
    lines.append(" *   '.' vazio  'g' grama (andável)  'c' terra/falésia (sólido)  '?' outro (sólido)")
    lines.append(" */")
    lines.append("export const PLATEAU_ROWS: readonly string[] = [")
    for r in plateau_rows:
        lines.append(f"  '{r}',")
    lines.append("];")
    lines.append("")
    lines.append("/**")
    lines.append(" * Lago do Deep_Water_Grass (21×10 células de 32 px). Legenda:")
    lines.append(" *   'g' margem de grama (andável)  'c' terra (sólido)  'w' buraco de água (sólido)  '.' vazio")
    lines.append(" */")
    lines.append("export const POND_ROWS: readonly string[] = [")
    for r in pond_rows:
        lines.append(f"  '{r}',")
    lines.append("];")
    lines.append("")
    OUT_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    OUT_CATALOG.write_text("\n".join(lines))

    summary = {k: len(f) for k, _, f in harm_entries}
    print(json.dumps({"harmonious_frames": summary, "feudal": len(feudal_entries)}, indent=1))


if __name__ == "__main__":
    main()
