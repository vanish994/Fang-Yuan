/** Só tipos: este módulo desenha, não instancia nada do Phaser. */
import type Phaser from 'phaser';
import { AREA_TILES, TILES_PER_CHUNK, INITIAL_WORLD } from './initialWorld';
import type { Side } from './initialWorld';
import type { GeneratedArea, WorldLayer } from './areaGenerator';

const VISUAL_LAYERS: readonly (readonly [WorldLayer, string, number])[] = [
  ['GROUND', 'ground', 0], ['TERRAIN', 'water', 1],
  ['TERRAIN_TRANSITIONS', 'ground', 2], ['PATHS', 'ground', 3],
  ['STRUCTURES', 'ruins', 4], ['DECORATION_BACK', 'ground-details', 5],
];

/** Phaser somente desenha o modelo puro; 3×3 chunks pertencem à mesma área. */
export function renderArea(scene: Phaser.Scene, area: GeneratedArea,
  objects: Phaser.GameObjects.Layer, player: Phaser.GameObjects.GameObject): () => void {
  const layers: Phaser.GameObjects.GameObject[] = [];
  const decorations: Phaser.GameObjects.Image[] = [];
  const signs: Phaser.GameObjects.Text[] = [];
  for (const [name, atlas, depth] of VISUAL_LAYERS) {
    // Vila não tem água; não alocar TilemapLayer para camadas inteiramente vazias.
    if (!area.layers[name].some(row => row.some(frame => frame !== -1))) continue;
    const map = scene.make.tilemap({ data: area.layers[name], tileWidth: 32, tileHeight: 32 });
    const tiles = map.addTilesetImage(atlas, atlas, 32, 32);
    if (!tiles) throw new Error(`Tileset indisponível: ${atlas}`);
    const layer = map.createLayer(0, tiles);
    if (!layer) throw new Error(`Camada indisponível: ${name}`);
    layer.setName(name).setDepth(depth);
    layers.push(layer);
  }
  for (const item of area.scenery) {
    const atlas = scene.textures.get(item.atlas);
    const frame = `area-${item.frameX}-${item.frameY}-${item.width}-${item.height}`;
    if (!atlas.has(frame)) atlas.add(frame, 0, item.frameX, item.frameY, item.width, item.height);
    const image = scene.add.image(item.x, item.y, item.atlas, frame).setName('OBJECTS')
      .setOrigin(0, 0).setDepth(item.depthY);
    objects.add(image);
    decorations.push(image);
  }
  for (const [side, destination] of Object.entries(area.definition.exits) as [Side, keyof typeof INITIAL_WORLD][]) {
    const x = side === 'west' ? 3.5 * 32 : side === 'east' ? 44.5 * 32 : 24.5 * 32;
    const y = side === 'north' ? 3.5 * 32 : side === 'south' ? 44.5 * 32 : 24.5 * 32;
    const arrow = { north: '↑', east: '→', south: '↓', west: '←' }[side];
    const sign = scene.add.text(x, y - 25, `${arrow} ${INITIAL_WORLD[destination].name}`, {
      fontSize: '8px', color: '#ffedb5', backgroundColor: '#162212cc',
    }).setOrigin(0.5).setDepth(y);
    objects.add(sign);
    signs.push(sign);
  }
  const map = scene.make.tilemap({ data: area.layers.COLLISION, tileWidth: 32, tileHeight: 32 });
  const tiles = map.addTilesetImage('ground', 'ground', 32, 32);
  if (!tiles) throw new Error('Tileset de colisão indisponível');
  const collision = map.createLayer(0, tiles);
  if (!collision) throw new Error('Camada de colisão indisponível');
  collision.setName('COLLISION').setCollision(11).setVisible(false);
  const collider = scene.physics.add.collider(player, collision);
  // A grade 48×48 é fatiável em nove chunks 16×16, mas nunca nove áreas.
  if (AREA_TILES !== 3 * TILES_PER_CHUNK) throw new Error('Chunks inconsistentes');
  return () => {
    collider.destroy();
    collision.destroy();
    decorations.forEach(image => image.destroy());
    signs.forEach(sign => sign.destroy());
    layers.forEach(layer => layer.destroy());
  };
}
