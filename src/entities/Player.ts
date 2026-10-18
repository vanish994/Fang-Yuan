import Phaser from 'phaser';
import {
  CELL_SIZE,
  DIRECTIONS,
  FRAMES_PER_DIRECTION,
  KEYS,
  type Direction,
} from '../config/assets';

/** Velocidade do personagem andando, em px/s. */
const SPEED = 160;
/** Velocidade durante o deslocamento do dash, em px/s. */
const DASH_SPEED = 620;
/** Tempo em que o dash desloca o personagem (ms). O resto da animação fica travado. */
const DASH_MOVE_MS = 220;
/** Tempo de cooldown entre dashes (ms). */
const DASH_COOLDOWN_MS = 900;

/** Duração de cada frame, conforme o manifesto do pack (ms). */
const WALK_FRAME_MS = 120;
const ATTACK_FRAME_MS = 120;
const DASH_FRAME_MS = 100;

/** Abaixo desta magnitude o personagem está parado. */
const MIN_MAGNITUDE = 0.01;

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

/**
 * Direção de movimento: x e y em [-1, 1]. Teclado entrega -1/0/1; o joystick entrega valores
 * analógicos, e a magnitude controla a velocidade.
 */
export interface MoveVector {
  x: number;
  y: number;
}

type Action = 'none' | 'attack' | 'dash';

/** Cria as animações do personagem uma única vez por jogo. */
export function createFangYuanAnimations(scene: Phaser.Scene): void {
  const anims = scene.anims;
  DIRECTIONS.forEach((dir, index) => {
    const start = index * FRAMES_PER_DIRECTION;
    const end = start + FRAMES_PER_DIRECTION - 1;

    const walkKey = `walk-${dir}`;
    if (!anims.exists(walkKey)) {
      anims.create({
        key: walkKey,
        frames: anims.generateFrameNumbers(KEYS.fangYuanWalk, { start, end }),
        frameRate: 1000 / WALK_FRAME_MS,
        repeat: -1,
      });
    }

    const attackKey = `attack-${dir}`;
    if (!anims.exists(attackKey)) {
      anims.create({
        key: attackKey,
        frames: anims.generateFrameNumbers(KEYS.fangYuanAttack, { start, end }),
        frameRate: 1000 / ATTACK_FRAME_MS,
        repeat: 0,
      });
    }

    const dashKey = `dash-${dir}`;
    if (!anims.exists(dashKey)) {
      anims.create({
        key: dashKey,
        frames: anims.generateFrameNumbers(KEYS.fangYuanDash, { start, end }),
        frameRate: 1000 / DASH_FRAME_MS,
        repeat: 0,
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
  private action: Action = 'none';
  /** Quando a ação atual termina (ms, relógio da cena). */
  private actionEndsAt = 0;
  /** Quando o deslocamento do dash termina (ms, relógio da cena). */
  private dashMoveEndsAt = 0;
  /** Quando o próximo dash pode ser usado (ms, relógio da cena). */
  private dashReadyAt = 0;

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

  /** True enquanto um ataque ou dash está em andamento (o movimento fica travado). */
  get isBusy(): boolean {
    return this.action !== 'none';
  }

  /** Atualiza o estado das ações. Chamar a cada frame, com o tempo da cena. */
  tick(now: number): void {
    if (this.action === 'dash' && now >= this.dashMoveEndsAt) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }
    if (this.action !== 'none' && now >= this.actionEndsAt) {
      this.action = 'none';
      this.idle();
    }
  }

  /** Aplica o vetor de movimento (teclado ou joystick) e troca a animação. */
  move(dir: MoveVector): void {
    if (this.isBusy) return;
    const body = this.body as Phaser.Physics.Arcade.Body;

    // A magnitude é limitada a 1: diagonal do teclado não fica mais rápida que o normal.
    const magnitude = Math.min(1, Math.hypot(dir.x, dir.y));
    if (magnitude < MIN_MAGNITUDE) {
      body.setVelocity(0, 0);
      this.idle();
      return;
    }

    const angle = Math.atan2(dir.y, dir.x);
    body.setVelocity(Math.cos(angle) * SPEED * magnitude, Math.sin(angle) * SPEED * magnitude);

    this.facing = directionFromAngle((angle * 180) / Math.PI);
    this.anims.play(`walk-${this.facing}`, true);
  }

  /** Ataque básico na direção atual. Trava o movimento durante a animação. */
  attack(now: number): boolean {
    if (this.isBusy) return false;

    this.action = 'attack';
    this.actionEndsAt = now + FRAMES_PER_DIRECTION * ATTACK_FRAME_MS;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.anims.play(`attack-${this.facing}`, true);
    return true;
  }

  /**
   * Dash curto na direção atual. Desloca o personagem por DASH_MOVE_MS e depois fica travado
   * até o fim da animação. Retorna false se ainda estiver em cooldown ou ocupado.
   */
  dash(now: number): boolean {
    if (this.isBusy || now < this.dashReadyAt) return false;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const angle = (DIRECTION_ANGLES[this.facing] * Math.PI) / 180;

    this.action = 'dash';
    this.actionEndsAt = now + FRAMES_PER_DIRECTION * DASH_FRAME_MS;
    this.dashMoveEndsAt = now + DASH_MOVE_MS;
    this.dashReadyAt = now + DASH_COOLDOWN_MS;
    body.setVelocity(Math.cos(angle) * DASH_SPEED, Math.sin(angle) * DASH_SPEED);
    this.anims.play(`dash-${this.facing}`, true);
    return true;
  }

  /** Fração do cooldown do dash restante, de 0 (pronto) a 1 (acabou de usar). */
  dashCooldownFraction(now: number): number {
    const remaining = this.dashReadyAt - now;
    return remaining > 0 ? Math.min(1, remaining / DASH_COOLDOWN_MS) : 0;
  }

  private idle(): void {
    this.anims.stop();
    this.setTexture(KEYS.fangYuanIdle, DIRECTIONS.indexOf(this.facing));
  }
}
