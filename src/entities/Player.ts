import Phaser from 'phaser';
import {
  CELL_SIZE,
  DIRECTIONS,
  KEYS,
  WALK_FRAMES_PER_DIRECTION,
  type Direction,
} from '../config/assets';

/** Velocidade do personagem em px/s. */
const SPEED = 160;

/** Duração de cada frame de walk (ms), conforme o manifesto do pack. */
const WALK_FRAME_MS = 120;

/** Ângulo (graus, eixo y para baixo) de cada direção do atlas. */
const DIRECTION_ANGLES: Record<Direction, number> = {
  up: -90,
  'up-right': -45,
  right: 0,
  'down-right': 45,
  down: 90,
  'down-left': 135,
  left: 180,
  'up-left': -135,
};

export interface MoveInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

/** Cria as animações do personagem uma única vez por jogo. */
export function createFangYuanAnimations(scene: Phaser.Scene): void {
  const anims = scene.anims;
  DIRECTIONS.forEach((dir, index) => {
    const walkKey = `walk-${dir}`;
    if (!anims.exists(walkKey)) {
      const start = index * WALK_FRAMES_PER_DIRECTION;
      anims.create({
        key: walkKey,
        frames: anims.generateFrameNumbers(KEYS.fangYuanWalk, {
          start,
          end: start + WALK_FRAMES_PER_DIRECTION - 1,
        }),
        frameRate: 1000 / WALK_FRAME_MS,
        repeat: -1,
      });
    }
  });
}

/** Direção mais próxima do ângulo dado (em graus). */
export function directionFromAngle(angle: number): Direction {
  let best: Direction = 'down';
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const dir of DIRECTIONS) {
    // Diferença angular com wrap-around em 360°.
    const diff = Math.abs(((angle - DIRECTION_ANGLES[dir] + 540) % 360) - 180);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = dir;
    }
  }
  return best;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  private facing: Direction = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, KEYS.fangYuanIdle, DIRECTIONS.indexOf('down'));
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    // Hitbox menor que a célula (64×64) para o personagem não "prender" nas quinas.
    body.setSize(24, 24);
    body.setOffset((CELL_SIZE - 24) / 2, CELL_SIZE - 24 - 6);

    this.setDepth(10);
  }

  /** Aplica a direção de movimento (já vinda do teclado) e troca a animação. */
  move(input: MoveInput): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);

    if (dx === 0 && dy === 0) {
      body.setVelocity(0, 0);
      this.idle();
      return;
    }

    // Normaliza para que a diagonal não seja mais rápida.
    const length = Math.hypot(dx, dy);
    body.setVelocity((dx / length) * SPEED, (dy / length) * SPEED);

    this.facing = directionFromAngle((Math.atan2(dy, dx) * 180) / Math.PI);
    this.anims.play(`walk-${this.facing}`, true);
  }

  private idle(): void {
    this.anims.stop();
    this.setTexture(KEYS.fangYuanIdle, DIRECTIONS.indexOf(this.facing));
  }
}
