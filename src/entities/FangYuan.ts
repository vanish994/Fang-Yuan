import Phaser from 'phaser';
import { directionVector, type CardinalDirection } from './directions';
import { FANG_YUAN_FRAME_DIRECTIONS, FANG_YUAN_POSE_FRAME_RATE,
  FANG_YUAN_POSE_MS, FANG_YUAN_POSE_TEXTURE, FANG_YUAN_POSES, poseAnimationKey, poseFrameRange,
  type FangYuanPose } from './fangYuanPoses';

// Reexportados para quem já importava daqui (main.ts, testes de arte).
export { FANG_YUAN_FRAME_DIRECTIONS, FANG_YUAN_FRAMES_PER_DIRECTION, FANG_YUAN_POSE_MS,
  FANG_YUAN_POSES, poseAnimationKey, poseFrameRange } from './fangYuanPoses';
export type { FangYuanPose } from './fangYuanPoses';

export const WALK_SPEED = 105; // px/s no mundo, valor provisório para testar locomoção

/** Atlas do usuário: quatro linhas (baixo, esquerda, cima, direita), quatro quadros 64×64. */
export function registerWalkAnimations(scene: Phaser.Scene): void {
  for (const pose of FANG_YUAN_POSES) {
    const texture = FANG_YUAN_POSE_TEXTURE[pose];
    for (const direction of FANG_YUAN_FRAME_DIRECTIONS) {
      const key = poseAnimationKey(pose, direction);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(texture, poseFrameRange(direction)),
        frameRate: FANG_YUAN_POSE_FRAME_RATE[pose],
        // Conjuração, arremetida e queda tocam uma vez: a última pose é a informação.
        repeat: pose === 'walk' ? -1 : 0,
      });
    }
  }
}

export class FangYuan extends Phaser.Physics.Arcade.Sprite {
  private facing: CardinalDirection = 'down';
  private walking = false;
  private travelDirection: CardinalDirection | null = null;
  private pose: FangYuanPose = 'walk';
  /** Instante em que a pose volta à caminhada; `null` = pose travada. */
  private poseUntil: number | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, FANG_YUAN_POSE_TEXTURE.walk, 0);
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
  get currentPose(): FangYuanPose { return this.pose; }

  /**
   * Troca a pose de exibição. O combate continua sendo resolvido pelo motor; a
   * pose é só leitura visual e volta para a caminhada sozinha (`durationMs`).
   * Uma pose travada (`down`) só sai com `resetPose`.
   */
  playPose(pose: FangYuanPose, now: number, durationMs: number | null =
    FANG_YUAN_POSE_MS[pose]): void {
    this.pose = pose;
    this.poseUntil = durationMs === null ? null : now + durationMs;
    this.anims.play(poseAnimationKey(pose, this.facing), true);
    if (pose !== 'walk') this.walking = false;
  }

  /** Volta à caminhada parada no primeiro quadro da direção atual. */
  resetPose(): void {
    this.pose = 'walk';
    this.poseUntil = null;
    this.walking = false;
    this.anims.stop();
    this.setTexture(FANG_YUAN_POSE_TEXTURE.walk, poseFrameRange(this.facing).start);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.pose !== 'walk' && this.poseUntil !== null && time >= this.poseUntil) {
      this.pose = 'walk';
      this.poseUntil = null;
      if (this.travelDirection) this.anims.play(poseAnimationKey('walk', this.facing), true);
      else {
        this.anims.stop();
        this.setTexture(FANG_YUAN_POSE_TEXTURE.walk, poseFrameRange(this.facing).start);
      }
    }
  }

  move(direction: CardinalDirection | null, turn = true, speed = WALK_SPEED): void {
    this.travelDirection = direction;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const { x, y } = directionVector(direction);
    body.setVelocity(x * speed, y * speed);

    if (direction) {
      // Ajustes muito curtos ainda movem o corpo, mas não fazem o sprite girar.
      const turned = turn && this.facing !== direction;
      if (turn) this.facing = direction;
      // Pose de ação em andamento manda no desenho; a caminhada volta depois dela.
      // Girar durante a pose troca só a linha da direção, sem cortar a animação.
      if (this.pose === 'walk' || turned) this.anims.play(poseAnimationKey(
        this.pose, this.facing), true);
      this.walking = true;
    } else if (this.walking) {
      if (this.pose === 'walk') {
        this.anims.stop();
        this.setTexture(FANG_YUAN_POSE_TEXTURE.walk, poseFrameRange(this.facing).start);
      }
      this.walking = false;
    }
    this.setDepth(this.y);
  }
}
