import type Phaser from 'phaser';
import { PlayerCharacter, WALK_SPEED, registerPlayerAnimations } from './PlayerCharacter';

/**
 * Nomes históricos do primeiro personagem jogável. O sprite em si virou
 * `PlayerCharacter`, que também desenha o Bai Ning Bing com a mesma hitbox;
 * este módulo continua existindo para quem já importava daqui (main.ts e testes).
 */
export { WALK_SPEED, registerPlayerAnimations };
export { FANG_YUAN_FRAME_DIRECTIONS, FANG_YUAN_FRAMES_PER_DIRECTION, FANG_YUAN_POSE_MS,
  FANG_YUAN_POSES, poseAnimationKey, poseFrameRange } from './fangYuanPoses';
export type { FangYuanPose } from './fangYuanPoses';

/** As animações do Fang Yuan, registradas com as chaves `fang-yuan-*`. */
export function registerWalkAnimations(scene: Phaser.Scene): void {
  registerPlayerAnimations(scene, 'fang-yuan');
}

/** Fang Yuan: o personagem jogável original, com a arte e a hitbox de sempre. */
export class FangYuan extends PlayerCharacter {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'fang-yuan');
  }
}
