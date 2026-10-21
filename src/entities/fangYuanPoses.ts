import type { CardinalDirection } from './directions';
import { PLAYER_POSE_FRAME_RATE, PLAYER_POSE_MS, PLAYER_POSES, POSE_FRAME_DIRECTIONS,
  POSES_PER_DIRECTION, playerPoseAnimationKey, playerPoseFrameRange, poseTextureKey,
  type PlayerPose } from './playerPoses';

/**
 * Nomes históricos do Fang Yuan. A grade de poses em si vive em `playerPoses`, que
 * também serve o Bai Ning Bing: as duas artes têm o mesmo formato e a mesma escala.
 * Este módulo continua existindo para quem já importava daqui (main.ts, testes de arte).
 */
export type FangYuanPose = PlayerPose;

export const FANG_YUAN_FRAME_DIRECTIONS: readonly CardinalDirection[] = POSE_FRAME_DIRECTIONS;
export const FANG_YUAN_FRAMES_PER_DIRECTION = POSES_PER_DIRECTION;

export const FANG_YUAN_POSES: readonly FangYuanPose[] = PLAYER_POSES;
export const FANG_YUAN_POSE_TEXTURE: Readonly<Record<FangYuanPose, string>> = {
  walk: poseTextureKey('fang-yuan', 'walk'),
  cast: poseTextureKey('fang-yuan', 'cast'),
  dash: poseTextureKey('fang-yuan', 'dash'),
  down: poseTextureKey('fang-yuan', 'down'),
};
export const FANG_YUAN_POSE_MS: Readonly<Record<FangYuanPose, number | null>> = PLAYER_POSE_MS;
export const FANG_YUAN_POSE_FRAME_RATE: Readonly<Record<FangYuanPose, number>> =
  PLAYER_POSE_FRAME_RATE;

/** Nome estável da animação de uma pose do Fang Yuan em uma direção. */
export function poseAnimationKey(pose: FangYuanPose, direction: CardinalDirection): string {
  return playerPoseAnimationKey('fang-yuan', pose, direction);
}

/** Quadros de uma direção dentro de qualquer pose (todas usam a mesma grade 4×4). */
export function poseFrameRange(direction: CardinalDirection): { start: number; end: number } {
  return playerPoseFrameRange(direction);
}
