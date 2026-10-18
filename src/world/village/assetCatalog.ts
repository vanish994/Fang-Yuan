/**
 * GERADO por scripts/build-village-assets.py. Não editar à mão.
 *
 * Recortes em pixels nativos dos packs (cada frame é um componente conexo do sheet).
 * Máscaras: uma letra por célula de 32 px nativos (ver a legenda em cada constante).
 */

/** Um recorte de um sheet, em pixels nativos. */
export interface SheetFrame {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SheetDef {
  key: string;
  file: string;
  frames: SheetFrame[];
}

/** Sheets do Harmonious Seasons (32 px nativos) recortados em componentes. */
export const HARMONIOUS_SHEETS: SheetDef[] = [
  {
    key: 'hm-trees-big',
    file: 'assets/tilesets/harmonious-seasons/Trees/Big_Trees/Big_NormalTrees.png',
    frames: [
      { name: 'hm-trees-big-0', x: 34, y: 9, w: 60, h: 87 },
      { name: 'hm-trees-big-1', x: 97, y: 9, w: 61, h: 87 },
      { name: 'hm-trees-big-2', x: 161, y: 4, w: 61, h: 92 },
      { name: 'hm-trees-big-3', x: 228, y: 1, w: 58, h: 95 },
      { name: 'hm-trees-big-4', x: 289, y: 4, w: 61, h: 92 },
    ],
  },
  {
    key: 'hm-trees-bigger',
    file: 'assets/tilesets/harmonious-seasons/Trees/Bigger_Trees/Bigger_NormalTrees.png',
    frames: [
      { name: 'hm-trees-bigger-0', x: 36, y: 0, w: 88, h: 128 },
      { name: 'hm-trees-bigger-1', x: 131, y: 1, w: 90, h: 127 },
      { name: 'hm-trees-bigger-2', x: 228, y: 2, w: 83, h: 126 },
      { name: 'hm-trees-bigger-3', x: 328, y: 0, w: 76, h: 128 },
      { name: 'hm-trees-bigger-4', x: 420, y: 2, w: 83, h: 126 },
    ],
  },
  {
    key: 'hm-trees-small',
    file: 'assets/tilesets/harmonious-seasons/Trees/Small_Trees/NormalTrees.png',
    frames: [
      { name: 'hm-trees-small-0', x: 224, y: 45, w: 31, h: 51 },
      { name: 'hm-trees-small-1', x: 32, y: 51, w: 32, h: 45 },
      { name: 'hm-trees-small-2', x: 96, y: 49, w: 32, h: 47 },
      { name: 'hm-trees-small-3', x: 160, y: 48, w: 32, h: 48 },
      { name: 'hm-trees-small-4', x: 288, y: 50, w: 32, h: 46 },
    ],
  },
  {
    key: 'hm-bushes',
    file: 'assets/tilesets/harmonious-seasons/Bushes/Anim_Bush_1.png',
    frames: [
      { name: 'hm-bushes-0', x: 40, y: 42, w: 18, h: 19 },
      { name: 'hm-bushes-1', x: 72, y: 42, w: 18, h: 19 },
    ],
  },
  {
    key: 'hm-rocks',
    file: 'assets/tilesets/harmonious-seasons/Miscellaneous/rocks.png',
    frames: [
      { name: 'hm-rocks-0', x: 138, y: 46, w: 45, h: 48 },
      { name: 'hm-rocks-1', x: 201, y: 38, w: 49, h: 57 },
      { name: 'hm-rocks-2', x: 66, y: 72, w: 27, h: 18 },
      { name: 'hm-rocks-3', x: 98, y: 70, w: 23, h: 19 },
      { name: 'hm-rocks-4', x: 33, y: 81, w: 9, h: 7 },
      { name: 'hm-rocks-5', x: 45, y: 81, w: 16, h: 12 },
    ],
  },
  {
    key: 'hm-stumps',
    file: 'assets/tilesets/harmonious-seasons/Miscellaneous/Tree_Stumps_and_Bark.png',
    frames: [
      { name: 'hm-stumps-0', x: 35, y: 50, w: 28, h: 13 },
      { name: 'hm-stumps-1', x: 72, y: 48, w: 14, h: 13 },
      { name: 'hm-stumps-2', x: 109, y: 50, w: 14, h: 11 },
      { name: 'hm-stumps-3', x: 137, y: 49, w: 14, h: 13 },
      { name: 'hm-stumps-4', x: 168, y: 48, w: 14, h: 13 },
    ],
  },
  {
    key: 'hm-pebbles',
    file: 'assets/tilesets/harmonious-seasons/Miscellaneous/sticks_and_pebbles.png',
    frames: [
      { name: 'hm-pebbles-0', x: 40, y: 44, w: 18, h: 12 },
      { name: 'hm-pebbles-1', x: 72, y: 44, w: 18, h: 11 },
      { name: 'hm-pebbles-2', x: 100, y: 44, w: 23, h: 14 },
      { name: 'hm-pebbles-3', x: 136, y: 41, w: 24, h: 21 },
    ],
  },
  {
    key: 'hm-grass',
    file: 'assets/tilesets/harmonious-seasons/Grasses/Anim_Grass_1.png',
    frames: [
      { name: 'hm-grass-0', x: 42, y: 40, w: 14, h: 21 },
      { name: 'hm-grass-1', x: 73, y: 40, w: 13, h: 21 },
      { name: 'hm-grass-2', x: 104, y: 40, w: 14, h: 21 },
    ],
  },
  {
    key: 'hm-flowers',
    file: 'assets/tilesets/harmonious-seasons/Flowers/Anim_Flower_A.png',
    frames: [
      { name: 'hm-flowers-0', x: 43, y: 46, w: 11, h: 15 },
      { name: 'hm-flowers-1', x: 75, y: 46, w: 10, h: 15 },
    ],
  },
];

/** Tile de água do lago (frame 0 do Lake_Water_Anim): x, y, w, h nativos. */
export const LAKE_WATER_TILE = { file: 'assets/tilesets/harmonious-seasons/Water/WaterTilesAnimated/Lake_Water_Anim.png', x: 32, y: 32, w: 32, h: 32 } as const;

/** Peças do Feudal Japan já redimensionadas (FEUDAL_SCALE) e cortadas pelo alfa. */
export const FEUDAL_PROPS: Record<string, { file: string; w: number; h: number }> = {
  'house-machiya': { file: 'assets/village/props/house-machiya.png', w: 116, h: 116 },
  'house-teahouse': { file: 'assets/village/props/house-teahouse.png', w: 117, h: 110 },
  'house-ryokan': { file: 'assets/village/props/house-ryokan.png', w: 117, h: 111 },
  'house-sake': { file: 'assets/village/props/house-sake.png', w: 101, h: 116 },
  'well-stone': { file: 'assets/village/props/well-stone.png', w: 95, h: 113 },
  'notice-board': { file: 'assets/village/props/notice-board.png', w: 115, h: 93 },
  'lantern-post': { file: 'assets/village/props/lantern-post.png', w: 53, h: 115 },
  'bench': { file: 'assets/village/props/bench.png', w: 115, h: 52 },
  'firewood': { file: 'assets/village/props/firewood.png', w: 117, h: 92 },
  'hay-bale': { file: 'assets/village/props/hay-bale.png', w: 115, h: 109 },
  'water-barrels': { file: 'assets/village/props/water-barrels.png', w: 106, h: 116 },
  'produce-basket': { file: 'assets/village/props/produce-basket.png', w: 119, h: 96 },
  'vegetable-crates': { file: 'assets/village/props/vegetable-crates.png', w: 116, h: 117 },
  'rice-bales': { file: 'assets/village/props/rice-bales.png', w: 116, h: 107 },
  'pottery-jars': { file: 'assets/village/props/pottery-jars.png', w: 116, h: 109 },
  'bamboo-baskets': { file: 'assets/village/props/bamboo-baskets.png', w: 116, h: 107 },
  'bamboo-fence': { file: 'assets/village/props/bamboo-fence.png', w: 117, h: 91 },
  'bamboo-grove': { file: 'assets/village/props/bamboo-grove.png', w: 79, h: 117 },
  'pine-tree': { file: 'assets/village/props/pine-tree.png', w: 109, h: 116 },
  'moss-rock': { file: 'assets/village/props/moss-rock.png', w: 115, h: 107 },
  'stone-steps': { file: 'assets/village/props/stone-steps.png', w: 115, h: 107 },
};

/**
 * Platô do Cliffs_Grass (30×15 células de 32 px). Legenda:
 *   '.' vazio  'g' grama (andável)  'c' terra/falésia (sólido)  '?' outro (sólido)
 */
export const PLATEAU_ROWS: readonly string[] = [
  '..............................',
  '......ggggggggggggggggg.......',
  '.....ggggggggggggggggggg......',
  '....ggggggggggggggggggggg.....',
  '...ggggggggggggggggggggggg....',
  '...ggggggggggggggggggggggg....',
  '...ggggggggggggggggggggggg....',
  '...ggggggggggggggggggggggg....',
  '...ggggggggggggggggggggggg....',
  '...ggggggggggggggggggggggg....',
  '....ggggggggggggggggggggg.....',
  '.....ggggggggggggggggggg......',
  '......ggggggggggggggggg.......',
  '....?..???c?ccccc?c???..?.....',
  '..............................',
];

/**
 * Lago do Deep_Water_Grass (21×10 células de 32 px). Legenda:
 *   'g' margem de grama (andável)  'c' terra (sólido)  'w' buraco de água (sólido)  '.' vazio
 */
export const POND_ROWS: readonly string[] = [
  '..ggggggg...ggggggg..',
  '.ggwwwwwgg.ggwwwwwgg.',
  '.gwwwwwwwg.gwwwwwwwg.',
  '.gwwwwwwwg.gwwwwwwwg.',
  '.gwwwwwwwg..ggggggg..',
  '.gwwwwwwwg...........',
  '.gwwwwwwwg...........',
  '.gwwwwwwwg...........',
  '.gwwwwwwwg...........',
  '..ggggggg............',
];
