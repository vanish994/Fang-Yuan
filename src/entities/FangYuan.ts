import Phaser from 'phaser';
import { directionVector, type CardinalDirection } from './directions';

// Ordem do animation.json enviado: não é a mesma ordem das direções de entrada.
export const FANG_YUAN_FRAME_DIRECTIONS: readonly CardinalDirection[] = ['down', 'left', 'up', 'right'];
export const FANG_YUAN_FRAMES_PER_DIRECTION = 4;
export const WALK_SPEED = 105; // px/s no mundo, valor provisório para testar locomoção

/** Atlas do usuário: quatro linhas (baixo, esquerda, cima, direita), quatro quadros 64×64 (32px no mapa). */
export function registerWalkAnimations(scene: Phaser.Scene): void {
  FANG_YUAN_FRAME_DIRECTIONS.forEach((direction, row) => {
    const key = `fang-yuan-walk-${direction}`;
    if (scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers('fang-yuan-walk', {
        start: row * FANG_YUAN_FRAMES_PER_DIRECTION,
        end: row * FANG_YUAN_FRAMES_PER_DIRECTION + FANG_YUAN_FRAMES_PER_DIRECTION - 1,
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
    // Arte em 64px, aparência e pés ainda em 32px do mundo.
    this.setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // Offset em pixels da TEXTURA: com escala 0,5, base real 14×10 e (9,20).
    // Não alterar sem atualizar src/world/footprint.ts.
    body.setSize(28, 20).setOffset(18, 40).setCollideWorldBounds(true);
    body.updateFromGameObject();
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
      this.setFrame(FANG_YUAN_FRAME_DIRECTIONS.indexOf(this.facing) * FANG_YUAN_FRAMES_PER_DIRECTION);
      this.walking = false;
    }
    this.setDepth(this.y);
  }
}
