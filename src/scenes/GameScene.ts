import Phaser from 'phaser';
import { BUTTON_COLORS, COLORS, TOUCH_BUTTONS } from '../config/gameConfig';
import { CELL_SIZE, KEYS } from '../config/assets';
import { CHUNK_COLS, CHUNK_ROWS, buildTestChunk } from '../world/testChunk';
import { Player, createFangYuanAnimations, type MoveVector } from '../entities/Player';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { ActionButton } from '../ui/ActionButton';

type WasdKeys = Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
type ActionKeys = Record<'attack' | 'skill' | 'dash', Phaser.Input.Keyboard.Key>;

/** Cooldown da habilidade ativa (placeholder até ela ter efeito de verdade), em ms. */
const SKILL_COOLDOWN_MS = 4000;

/**
 * Cena de teste: um chunk pequeno de chão (grama e terra) com o personagem Fang Yuan.
 *
 * Celular/tablet: joystick à esquerda; botões ATK, DASH e HAB à direita.
 * Teclado: setas ou WASD para mover; J ataque, K habilidade, Shift dash.
 */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: WasdKeys;
  private actionKeys?: ActionKeys;
  private joystick?: VirtualJoystick;
  private dashButton?: ActionButton;
  private skillButton?: ActionButton;
  private skillReadyAt = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Chão: o chunk é uma matriz de índices do atlas, desenhada como camada de tilemap.
    const mapWidth = CHUNK_COLS * CELL_SIZE;
    const mapHeight = CHUNK_ROWS * CELL_SIZE;
    const map = this.make.tilemap({
      data: buildTestChunk(),
      tileWidth: CELL_SIZE,
      tileHeight: CELL_SIZE,
    });
    const tileset = map.addTilesetImage('ground', KEYS.groundTiles, CELL_SIZE, CELL_SIZE, 0, 0);
    if (!tileset) {
      throw new Error(`Tileset '${KEYS.groundTiles}' não foi carregado.`);
    }
    map.createLayer(0, tileset, 0, 0);

    // Limites do mundo e da câmera: o chunk inteiro.
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

    // Personagem começa no meio do caminho de terra.
    createFangYuanAnimations(this);
    this.player = new Player(this, mapWidth / 2, Math.round(5.5 * CELL_SIZE));
    this.cameras.main.startFollow(this.player, true);

    // Teclado (desktop, ou tablet com teclado externo).
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      this.wasd = keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
      }) as WasdKeys;
      this.actionKeys = keyboard.addKeys({
        attack: Phaser.Input.Keyboard.KeyCodes.J,
        skill: Phaser.Input.Keyboard.KeyCodes.K,
        dash: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      }) as ActionKeys;
    }

    // Toque: joystick à esquerda e botões de ação à direita.
    const isTouch = this.game.device.input.touch;
    if (isTouch) {
      this.joystick = new VirtualJoystick(this);
      new ActionButton(this, {
        ...TOUCH_BUTTONS.attack,
        label: 'ATK',
        color: BUTTON_COLORS.attack,
        onPress: () => this.doAttack(),
      });
      this.dashButton = new ActionButton(this, {
        ...TOUCH_BUTTONS.dash,
        label: 'DASH',
        color: BUTTON_COLORS.dash,
        onPress: () => this.doDash(),
      });
      this.skillButton = new ActionButton(this, {
        ...TOUCH_BUTTONS.skill,
        label: 'HAB',
        color: BUTTON_COLORS.skill,
        onPress: () => this.doSkill(),
      });
    }

    // Legenda fixa na tela (não rola com a câmera).
    this.add
      .text(
        16,
        16,
        isTouch
          ? 'Arraste à esquerda para mover · botões à direita'
          : 'Setas/WASD mover · J ataque · K habilidade · Shift dash',
        {
          fontFamily: 'sans-serif',
          fontSize: '18px',
          color: COLORS.text,
          backgroundColor: '#00000066',
          padding: { x: 8, y: 4 },
        },
      )
      .setScrollFactor(0)
      .setDepth(100);
  }

  update(time: number): void {
    this.player.tick(time);
    this.handleActionKeys();
    this.player.move(this.readMoveVector());
    this.updateCooldownVisuals(time);
  }

  private doAttack(): void {
    this.player.attack(this.time.now);
  }

  private doDash(): void {
    this.player.dash(this.time.now);
  }

  /**
   * Habilidade ativa: placeholder. Por enquanto só mostra um anel ao redor do personagem
   * e entra em cooldown. O efeito real entra quando a habilidade for definida.
   */
  private doSkill(): void {
    const now = this.time.now;
    if (now < this.skillReadyAt) return;
    this.skillReadyAt = now + SKILL_COOLDOWN_MS;

    const ring = this.add
      .circle(this.player.x, this.player.y, 24)
      .setFillStyle(0x000000, 0)
      .setStrokeStyle(4, BUTTON_COLORS.skill)
      .setDepth(9);
    this.tweens.add({
      targets: ring,
      scale: 3,
      alpha: 0,
      duration: 500,
      onComplete: () => ring.destroy(),
    });
  }

  private handleActionKeys(): void {
    if (!this.actionKeys) return;
    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.attack)) this.doAttack();
    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.dash)) this.doDash();
    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.skill)) this.doSkill();
  }

  private updateCooldownVisuals(now: number): void {
    this.dashButton?.setCooldown(this.player.dashCooldownFraction(now));
    this.skillButton?.setCooldown(Math.max(0, (this.skillReadyAt - now) / SKILL_COOLDOWN_MS));
  }

  /** Une o joystick (quando em uso) e o teclado. O joystick tem prioridade se estiver ativo. */
  private readMoveVector(): MoveVector {
    const joy = this.joystick?.vector;
    if (joy && (joy.x !== 0 || joy.y !== 0)) {
      return joy;
    }

    const left = this.cursors?.left.isDown || this.wasd?.left.isDown;
    const right = this.cursors?.right.isDown || this.wasd?.right.isDown;
    const up = this.cursors?.up.isDown || this.wasd?.up.isDown;
    const down = this.cursors?.down.isDown || this.wasd?.down.isDown;

    return {
      x: (right ? 1 : 0) - (left ? 1 : 0),
      y: (down ? 1 : 0) - (up ? 1 : 0),
    };
  }
}
