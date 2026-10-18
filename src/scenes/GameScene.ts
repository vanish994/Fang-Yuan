import Phaser from 'phaser';
import {
  BUTTON_COLORS,
  COLORS,
  TOUCH_BUTTONS,
  WORLD_ZOOM,
} from '../config/gameConfig';
import { CELL_SIZE, KEYS } from '../config/assets';
import { buildVillageMap, type Rect } from '../world/village/villageMap';
import { registerVillageFrames } from '../world/village/villageTextures';
import { Player, createFangYuanAnimations, type MoveVector } from '../entities/Player';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { ActionButton } from '../ui/ActionButton';
import { MoonlightSlash, createMoonlightAnimations } from '../effects/MoonlightSlash';

type WasdKeys = Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
type ActionKeys = Record<'attack' | 'skill' | 'dash', Phaser.Input.Keyboard.Key>;

/** Cooldown da habilidade ativa, em ms. Valor provisório: o GDD ainda não fixou o número. */
const SKILL_COOLDOWN_MS = 4000;

/**
 * Vila Inicial da Montanha: mapa com chão, objetos e colisões, e o personagem Fang Yuan.
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
  private attackButton?: ActionButton;
  private dashButton?: ActionButton;
  private skillButton?: ActionButton;
  private cameraUpButton?: ActionButton;
  private cameraDownButton?: ActionButton;
  private hintText?: Phaser.GameObjects.Text;
  private cameraZoom = WORLD_ZOOM;
  private skillReadyAt = 0;
  private skillFx?: MoonlightSlash;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Chão e vila: camadas e objetos vêm de buildVillageMap() (ver src/world/village/villageMap.ts).
    const village = buildVillageMap();
    const mapWidth = village.cols * CELL_SIZE;
    const mapHeight = village.rows * CELL_SIZE;
    registerVillageFrames(this);
    this.buildGroundLayer(village.ground, 0);
    this.buildGroundLayer(village.overlay, 0.2);
    for (const img of village.images) {
      this.add
        .image(img.x, img.y, img.texture, img.frame)
        .setOrigin(0, 0)
        .setScale(img.scale)
        .setDepth(img.depth);
    }
    for (const d of village.decor) {
      // Base do objeto no centro inferior. Objetos no chão ficam sob o personagem.
      const img = this.add.image(d.x, d.y, d.texture, d.frame).setOrigin(0.5, 1);
      img.setScale(d.w / img.width, d.h / img.height);
      img.setDepth(d.flat ? 0.5 : d.y);
    }

    // Limites do mundo e da câmera: o mapa inteiro.
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

    // Personagem começa na praça da vila.
    createFangYuanAnimations(this);
    createMoonlightAnimations(this);
    this.player = new Player(this, village.spawn.x, village.spawn.y);
    this.cameras.main.startFollow(this.player, true);

    // Colisões: falésia, água e bases de árvores, casas e objetos.
    const solids = village.solids.map((r) => this.addSolid(r));
    this.physics.add.collider(this.player, solids);

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
      this.attackButton = new ActionButton(this, {
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
      // Controles de zoom: a câmera continua centralizada no personagem.
      this.cameraUpButton = new ActionButton(this, {
        x: this.scale.width - 68, y: 72, radius: 34, label: '+', color: 0x566b80,
        onPress: () => this.adjustCameraZoom(0.2),
      });
      this.cameraDownButton = new ActionButton(this, {
        x: this.scale.width - 68, y: 150, radius: 34, label: '−', color: 0x566b80,
        onPress: () => this.adjustCameraZoom(-0.2),
      });
    }

    // Legenda fixa na tela (não rola com a câmera).
    this.hintText = this.add
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

    // Zoom: a câmera principal aproxima o mundo. A interface não pode ser ampliada junto.
    this.cameraZoom = WORLD_ZOOM;
    this.cameras.main.setZoom(this.cameraZoom);
  }

  /** Uma camada de tiles do ground-atlas, com a matriz de índices dada (-1 é vazio). */
  private buildGroundLayer(data: number[][], depth: number): void {
    const map = this.make.tilemap({ data, tileWidth: CELL_SIZE, tileHeight: CELL_SIZE });
    const tileset = map.addTilesetImage('ground', KEYS.groundTiles, CELL_SIZE, CELL_SIZE, 0, 0);
    if (!tileset) {
      throw new Error(`Tileset '${KEYS.groundTiles}' não foi carregado.`);
    }
    map.createLayer(0, tileset, 0, 0)?.setDepth(depth);
  }

  /** Retângulo sólido invisível para a colisão do personagem (corpo estático). */
  private addSolid(r: Rect): Phaser.GameObjects.Zone {
    const zone = this.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h);
    this.physics.add.existing(zone, true);
    return zone;
  }

  /** Ajusta o zoom sem alterar o seguimento: o centro da câmera continua no personagem. */
  private adjustCameraZoom(delta: number): void {
    this.cameraZoom = Phaser.Math.Clamp(this.cameraZoom + delta, 1, 3.2);
    this.cameras.main.setZoom(this.cameraZoom);
  }

  update(time: number): void {
    this.player.tick(time);
    this.handleActionKeys();
    this.player.move(this.readMoveVector());
    // Ordenação pelo y dos pés: o personagem passa atrás ou na frente dos objetos.
    this.player.setDepth(this.player.feetY);
    if (this.skillFx) this.skillFx.follow(this.player.feetX, this.player.feetY);
    this.updateCooldownVisuals(time);
  }

  private doAttack(): void {
    this.player.attack(this.time.now);
  }

  private doDash(): void {
    this.player.dash(this.time.now);
  }

  /**
   * Habilidade ativa: Moonlight Gu, corte em meia-lua na direção em que o personagem está virado.
   * Por enquanto só desenha o efeito e entra em cooldown. Dano e hitbox entram com os inimigos.
   */
  private doSkill(): void {
    const now = this.time.now;
    if (now < this.skillReadyAt) return;
    this.skillReadyAt = now + SKILL_COOLDOWN_MS;

    // Só um corte por vez: o cooldown é maior que a duração do efeito, então o anterior já acabou.
    this.skillFx?.destroy();
    this.skillFx = new MoonlightSlash(this, this.player.facingDirection);
    this.skillFx.follow(this.player.feetX, this.player.feetY);
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
