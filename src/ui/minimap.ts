import type { GeneratedArea } from '../world/areaGenerator';
import { buildMinimapSnapshot, minimapPosition, MINIMAP_CELL, type MinimapCell } from './minimapModel';

const PIXELS = 96;
const COLORS: Readonly<Record<MinimapCell, string>> = {
  [MINIMAP_CELL.grass]: '#9ab037',
  [MINIMAP_CELL.trees]: '#476e3c',
  [MINIMAP_CELL.trail]: '#c69c6d',
  [MINIMAP_CELL.stone]: '#999596',
  [MINIMAP_CELL.water]: '#73aa9e',
  [MINIMAP_CELL.blocked]: '#344a32',
  [MINIMAP_CELL.exit]: '#f2d38d',
};

/** Painel fixo independente da câmera: uma área de cada vez, sem clique que desvie Fang Yuan. */
export class MinimapView {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  private readonly base: HTMLCanvasElement;
  private areaSize = 48;
  private lastX = -1;
  private lastY = -1;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('aside');
    this.root.className = 'combat-minimap';
    this.root.setAttribute('aria-label', 'Minimapa da área atual');
    const title = document.createElement('strong');
    title.className = 'minimap-title';
    title.textContent = 'Mapa';
    this.root.append(title);
    this.canvas = document.createElement('canvas');
    this.canvas.width = PIXELS;
    this.canvas.height = PIXELS;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Posição de Fang Yuan, trilhas, obstáculos e saídas');
    this.root.append(this.canvas);
    this.base = document.createElement('canvas');
    this.base.width = PIXELS;
    this.base.height = PIXELS;
    parent.append(this.root);
  }

  setArea(area: GeneratedArea): void {
    const snapshot = buildMinimapSnapshot(area);
    this.areaSize = snapshot.size;
    const context = this.base.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, PIXELS, PIXELS);
    const unit = PIXELS / snapshot.size;
    for (let y = 0; y < snapshot.size; y++) for (let x = 0; x < snapshot.size; x++) {
      context.fillStyle = COLORS[snapshot.cells[y * snapshot.size + x] as MinimapCell];
      context.fillRect(x * unit, y * unit, unit, unit);
    }
    this.root.querySelector('.minimap-title')!.textContent = area.definition.name;
    this.root.setAttribute('aria-label', `Minimapa: ${area.definition.name}`);
    this.lastX = -1;
    this.lastY = -1;
  }

  update(worldX: number, worldY: number): void {
    const position = minimapPosition(worldX, worldY, this.areaSize, PIXELS);
    if (position.x === this.lastX && position.y === this.lastY) return;
    this.lastX = position.x;
    this.lastY = position.y;
    const context = this.canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, PIXELS, PIXELS);
    context.drawImage(this.base, 0, 0);
    context.fillStyle = '#172327';
    context.fillRect(position.x - 2, position.y - 2, 5, 5);
    context.fillStyle = '#fff8da';
    context.fillRect(position.x - 1, position.y - 1, 3, 3);
  }

  destroy(): void { this.root.remove(); }
}
