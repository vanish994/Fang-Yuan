/**
 * Efeito do Moonlight Gu (corte em meia-lua), uma pasta por direção.
 *
 * Gerado a partir dos manifestos em public/assets/effects/moonlight-gu/<pasta>/manifest.json
 * (PixelLab VFX Creator, pack "Slash arc"). Não editar à mão: se o pack mudar, gere de novo.
 *
 * Cada camada é uma spritesheet em colunas × linhas. `behind` desenha atrás do personagem
 * e `front` na frente. `start` é o frame do efeito em que a camada aparece. O offset é
 * relativo aos pés do personagem: o canto superior esquerdo do frame fica em pés + offset.
 */

/** Duração de cada frame do efeito (ms) e quantidade de frames na linha do tempo. */
export const MOONLIGHT_FRAME_MS = 50;
export const MOONLIGHT_TOTAL_FRAMES = 7;

export interface MoonlightLayer {
  /** Primeiro frame do efeito em que a camada aparece. */
  start: number;
  /** Quantidade de frames da camada. */
  frames: number;
  /** Tamanho de um frame, em pixels. */
  width: number;
  height: number;
  /** Canto superior esquerdo do frame, relativo aos pés do personagem. */
  offsetX: number;
  offsetY: number;
  /** Nome do arquivo PNG dentro da pasta da direção. */
  file: string;
}

export interface MoonlightDirection {
  folder: string;
  behind: MoonlightLayer | null;
  front: MoonlightLayer;
}

/** Uma entrada por direção canônica do personagem (mesma ordem de DIRECTIONS). */
export const MOONLIGHT_DIRECTIONS: Record<string, MoonlightDirection> = {
  'up': {
    folder: 'north',
    behind: { start: 0, frames: 6, width: 38, height: 15, offsetX: -20, offsetY: -26, file: 'behind.png' },
    front: { start: 2, frames: 2, width: 24, height: 16, offsetX: -12, offsetY: -6, file: 'front.png' },
  },
  'up-right': {
    folder: 'north-east',
    behind: { start: 0, frames: 6, width: 40, height: 15, offsetX: -2, offsetY: -21, file: 'behind.png' },
    front: { start: 2, frames: 2, width: 21, height: 15, offsetX: -11, offsetY: -4, file: 'front.png' },
  },
  'right': {
    folder: 'east',
    behind: { start: 0, frames: 6, width: 37, height: 16, offsetX: 9, offsetY: -8, file: 'behind.png' },
    front: { start: 2, frames: 2, width: 16, height: 17, offsetX: -7, offsetY: -5, file: 'front.png' },
  },
  'down-right': {
    folder: 'south-east',
    behind: null,
    front: { start: 0, frames: 6, width: 46, height: 27, offsetX: -8, offsetY: -7, file: 'front.png' },
  },
  'down': {
    folder: 'south',
    behind: null,
    front: { start: 0, frames: 6, width: 38, height: 33, offsetX: -18, offsetY: -7, file: 'front.png' },
  },
  'down-left': {
    folder: 'south-west',
    behind: null,
    front: { start: 0, frames: 6, width: 50, height: 25, offsetX: -38, offsetY: -4, file: 'front.png' },
  },
  'left': {
    folder: 'west',
    behind: { start: 0, frames: 6, width: 37, height: 16, offsetX: -46, offsetY: -8, file: 'behind.png' },
    front: { start: 2, frames: 2, width: 17, height: 11, offsetX: -8, offsetY: -2, file: 'front.png' },
  },
  'up-left': {
    folder: 'north-west',
    behind: { start: 0, frames: 6, width: 34, height: 16, offsetX: -38, offsetY: -20, file: 'behind.png' },
    front: { start: 2, frames: 2, width: 19, height: 12, offsetX: -9, offsetY: -3, file: 'front.png' },
  },
};
