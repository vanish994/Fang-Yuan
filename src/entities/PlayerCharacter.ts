import Phaser from 'phaser';
import { directionVector, type CardinalDirection } from './directions';
import { PLAYER_POSE_FRAME_RATE, PLAYER_POSE_MS, PLAYER_POSES, POSE_FRAME_DIRECTIONS,
  playerPoseAnimationKey, playerPoseFrameRange, poseTextureKey, type PlayerPose } from './playerPoses';

/**
 * Sprite do personagem jogável.
 *
 * A arte é só apresentação: as quatro poses (caminhada, conjuração, arremetida e
 * queda) têm 64 px na textura e 32 px no mapa, com a mesma hitbox para todos os
 * personagens. Quem resolve dano é o motor de combate; trocar de personagem troca
 * a arte, a cor das partículas e o alcance do básico, nunca as regras de Gu.
 */

export const WALK_SPEED = 105; // px/s no mundo, valor provisório para testar locomoção

/** Registra as animações de um personagem (uma por pose × direção). */
export function registerPlayerAnimations(scene: Phaser.Scene, art: string): void {
  for (const pose of PLAYER_POSES) {
    const texture = poseTextureKey(art, pose);
    for (const direction of POSE_FRAME_DIRECTIONS) {
      const key = playerPoseAnimationKey(art, pose, direction);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(texture, playerPoseFrameRange(direction)),
        frameRate: PLAYER_POSE_FRAME_RATE[pose],
        // Conjuração, arremetida e queda tocam uma vez: a última pose é a informação.
        repeat: pose === 'walk' ? -1 : 0,
      });
    }
  }
}

export class PlayerCharacter extends Phaser.Physics.Arcade.Sprite {
  private facing: CardinalDirection = 'down';
  private walking = false;
  private travelDirection: CardinalDirection | null = null;
  private pose: PlayerPose = 'walk';
  /** Instante em que a pose volta à caminhada; `null` = pose travada. */
  private poseUntil: number | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, private art = 'fang-yuan') {
    super(scene, x, y, poseTextureKey(art, 'walk'), 0);
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

  /** Troca a arte mantendo posição, corpo físico e direção: é o que a seleção faz. */
  setArt(art: string): void {
    this.art = art;
    this.anims.stop();
    this.setTexture(poseTextureKey(art, this.pose), playerPoseFrameRange(this.facing).start);
    if (this.pose === 'walk' && this.walking) {
      this.anims.play(playerPoseAnimationKey(art, 'walk', this.facing), true);
    }
  }

  get facingDirection(): CardinalDirection { return this.facing; }
  get movingDirection(): CardinalDirection | null { return this.travelDirection; }
  get currentPose(): PlayerPose { return this.pose; }

  /**
   * Troca a pose de exibição. O combate continua sendo resolvido pelo motor; a
   * pose é só leitura visual e volta para a caminhada sozinha (`durationMs`).
   * Uma pose travada (`down`) só sai com `resetPose`.
   */
  playPose(pose: PlayerPose, now: number, durationMs: number | null =
    PLAYER_POSE_MS[pose]): void {
    this.pose = pose;
    this.poseUntil = durationMs === null ? null : now + durationMs;
    this.anims.play(playerPoseAnimationKey(this.art, pose, this.facing), true);
    if (pose !== 'walk') this.walking = false;
  }

  /** Volta à caminhada parada no primeiro quadro da direção atual. */
  resetPose(): void {
    this.pose = 'walk';
    this.poseUntil = null;
    this.walking = false;
    this.anims.stop();
    this.setTexture(poseTextureKey(this.art, 'walk'), playerPoseFrameRange(this.facing).start);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.pose !== 'walk' && this.poseUntil !== null && time >= this.poseUntil) {
      this.pose = 'walk';
      this.poseUntil = null;
      if (this.travelDirection) this.anims.play(playerPoseAnimationKey(this.art, 'walk', this.facing), true);
      else {
        this.anims.stop();
        this.setTexture(poseTextureKey(this.art, 'walk'), playerPoseFrameRange(this.facing).start);
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
      if (this.pose === 'walk' || turned) this.anims.play(playerPoseAnimationKey(
        this.art, this.pose, this.facing), true);
      this.walking = true;
    } else if (this.walking) {
      if (this.pose === 'walk') {
        this.anims.stop();
        this.setTexture(poseTextureKey(this.art, 'walk'), playerPoseFrameRange(this.facing).start);
      }
      this.walking = false;
    }
    this.setDepth(this.y);
  }
}
