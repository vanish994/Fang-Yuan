import Phaser from 'phaser';
import { DIRECTIONS, directionVector, type CardinalDirection } from './directions';

const FRAMES_PER_DIRECTION = 6;
export const WALK_SPEED = 105; // px/s no mundo, valor provisório para testar locomoção

/** Atlas de 4 linhas (baixo, esquerda, direita, cima), 6 quadros de 32 px cada. */
export function registerWalkAnimations(scene: Phaser.Scene): void {
  DIRECTIONS.forEach((direction, row) => {
    const key = `fang-yuan-walk-${direction}`;
    if (scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers('fang-yuan-walk', {
        start: row * FRAMES_PER_DIRECTION,
        end: row * FRAMES_PER_DIRECTION + FRAMES_PER_DIRECTION - 1,
      }),
      frameRate: 8,
      repeat: -1,
    });
  });
}

export class FangYuan extends Phaser.Physics.Arcade.Sprite {
  private facing: CardinalDirection = 'down';
  private walking = false;
  private travelDirection: CardinalDirection | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'fang-yuan-walk', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // Somente a base do personagem colide, não a roupa/cabelo acima dos pés.
    body.setSize(14, 10).setOffset(9, 20).setCollideWorldBounds(true);
  }

  get facingDirection(): CardinalDirection { return this.facing; }
  get movingDirection(): CardinalDirection | null { return this.travelDirection; }

  move(direction: CardinalDirection | null, turn = true, speed = WALK_SPEED): void {
    this.travelDirection = direction;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const { x, y } = directionVector(direction);
    body.setVelocity(x * speed, y * speed);

    if (direction) {
      // Ajustes muito curtos ainda movem o corpo, mas não fazem o sprite girar.
      if (turn) this.facing = direction;
      this.anims.play(`fang-yuan-walk-${this.facing}`, true);
      this.walking = true;
    } else if (this.walking) {
      this.anims.stop();
      this.setFrame(DIRECTIONS.indexOf(this.facing) * FRAMES_PER_DIRECTION);
      this.walking = false;
    }
    this.setDepth(this.y);
  }
}
