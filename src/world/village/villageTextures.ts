import Phaser from 'phaser';
import { HARMONIOUS_SHEETS, LAKE_WATER_TILE } from './assetCatalog';
import { LAKE_FRAME, LAKE_KEY } from './villageMap';

/**
 * Registra os recortes do Harmonious Seasons como frames nas texturas carregadas.
 * Os sheets são imagens inteiras; cada componente (árvore, arbusto, pedra...) vira um frame.
 * Chamar depois do carregamento. Seguro de chamar mais de uma vez (ignora frames existentes).
 */
export function registerVillageFrames(scene: Phaser.Scene): void {
  for (const sheet of HARMONIOUS_SHEETS) {
    const texture = scene.textures.get(sheet.key);
    for (const f of sheet.frames) {
      if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
    }
  }
  const lake = scene.textures.get(LAKE_KEY);
  if (!lake.has(LAKE_FRAME)) {
    lake.add(LAKE_FRAME, 0, LAKE_WATER_TILE.x, LAKE_WATER_TILE.y, LAKE_WATER_TILE.w, LAKE_WATER_TILE.h);
  }
}
