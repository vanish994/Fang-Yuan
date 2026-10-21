import type { CardinalDirection } from './directions';

/**
 * Dados das poses do Fang Yuan, sem Phaser: os testes carregam este módulo
 * diretamente e o `FangYuan.ts` usa os mesmos valores para registrar animações.
 *
 * As quatro poses enviadas pelo usuário (caminhada, conjuração, arremetida e queda)
 * usam a mesma grade 4×4 — quatro direções × quatro quadros — e o mesmo fator de
 * escala na geração dos atlas, então o corpo não muda de tamanho entre animações.
 */
export type FangYuanPose = 'walk' | 'cast' | 'dash' | 'down';

// Ordem das linhas dos ATLAS publicados (igual a NPCs, mobs e bosses).
// Os masters enviados vêm com as laterais trocadas (down, right, up, left): quem
// faz a troca é `scripts/build-sprite-atlases.py` (FANG_YUAN_MASTER_ROWS).
export const FANG_YUAN_FRAME_DIRECTIONS: readonly CardinalDirection[] = ['down', 'left', 'up', 'right'];
export const FANG_YUAN_FRAMES_PER_DIRECTION = 4;

export const FANG_YUAN_POSES: readonly FangYuanPose[] = ['walk', 'cast', 'dash', 'down'];
export const FANG_YUAN_POSE_TEXTURE: Readonly<Record<FangYuanPose, string>> = {
  walk: 'fang-yuan-walk', cast: 'fang-yuan-cast', dash: 'fang-yuan-dash', down: 'fang-yuan-down',
};
/** Duração de cada pose antes de voltar à caminhada; `null` = fica no último quadro. */
export const FANG_YUAN_POSE_MS: Readonly<Record<FangYuanPose, number | null>> = {
  walk: null, cast: 380, dash: 420, down: null,
};
export const FANG_YUAN_POSE_FRAME_RATE: Readonly<Record<FangYuanPose, number>> = {
  walk: 8, cast: 10, dash: 12, down: 8,
};

/** Nome estável da animação de uma pose em uma direção. */
export function poseAnimationKey(pose: FangYuanPose, direction: CardinalDirection): string {
  return `fang-yuan-${pose}-${direction}`;
}

/** Quadros de uma direção dentro de qualquer pose (todas usam a mesma grade 4×4). */
export function poseFrameRange(direction: CardinalDirection): { start: number; end: number } {
  const row = FANG_YUAN_FRAME_DIRECTIONS.indexOf(direction);
  const start = row * FANG_YUAN_FRAMES_PER_DIRECTION;
  return { start, end: start + FANG_YUAN_FRAMES_PER_DIRECTION - 1 };
}
