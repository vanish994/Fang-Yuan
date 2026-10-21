import type { CardinalDirection } from './directions';

/**
 * Dados de pose comuns aos personagens jogáveis, sem Phaser: os testes carregam
 * este módulo diretamente e o sprite usa os mesmos valores para registrar animações.
 *
 * Todo personagem jogável usa a mesma grade 4×4 — quatro direções × quatro quadros —
 * e o mesmo fator de escala na geração dos atlas, então ninguém muda de tamanho ao
 * trocar de animação nem fica maior que o outro.
 */
export type PlayerPose = 'walk' | 'cast' | 'dash' | 'down';

/** Ordem das linhas dos ATLAS publicados (igual a NPCs, mobs e bosses). */
export const POSE_FRAME_DIRECTIONS: readonly CardinalDirection[] = ['down', 'left', 'up', 'right'];
export const POSES_PER_DIRECTION = 4;

export const PLAYER_POSES: readonly PlayerPose[] = ['walk', 'cast', 'dash', 'down'];
/** Duração de cada pose antes de voltar à caminhada; `null` = fica no último quadro. */
export const PLAYER_POSE_MS: Readonly<Record<PlayerPose, number | null>> = {
  walk: null, cast: 380, dash: 420, down: null,
};
export const PLAYER_POSE_FRAME_RATE: Readonly<Record<PlayerPose, number>> = {
  walk: 8, cast: 10, dash: 12, down: 8,
};

/** Chave de textura de uma pose: `fang-yuan-walk`, `bai-ning-bing-cast`… */
export function poseTextureKey(character: string, pose: PlayerPose): string {
  return `${character}-${pose}`;
}

/** Nome estável da animação de um personagem numa pose e direção. */
export function playerPoseAnimationKey(character: string, pose: PlayerPose,
  direction: CardinalDirection): string {
  return `${poseTextureKey(character, pose)}-${direction}`;
}

/** Quadros de uma direção dentro de qualquer pose (todas usam a mesma grade 4×4). */
export function playerPoseFrameRange(direction: CardinalDirection): { start: number; end: number } {
  const row = POSE_FRAME_DIRECTIONS.indexOf(direction);
  const start = row * POSES_PER_DIRECTION;
  return { start, end: start + POSES_PER_DIRECTION - 1 };
}
