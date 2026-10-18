import Phaser from 'phaser';
import { COLORS } from '../config/gameConfig';
import { CELL_SIZE, KEYS } from '../config/assets';
import { CHUNK_COLS, CHUNK_ROWS, buildTestChunk } from '../world/testChunk';
import { Player, createFangYuanAnimations, type MoveVector } from '../entities/Player';
import { VirtualJoystick } from '../ui/VirtualJoystick';

type WasdKeys = Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

/**
 * Cena de teste: um chunk pequeno de chão (grama e terra) com o personagem Fang Yuan.
 * Teclado: setas ou WASD. Celular/tablet: joystick virtual no lado esquerdo da tela.
 */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: WasdKeys;
  private joystick?: VirtualJoystick;

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

    // Entrada: dispositivos com toque ganham o joystick; os demais, o teclado.
    const isTouch = this.game.device.input.touch;
    if (isTouch) {
      this.joystick = new VirtualJoystick(this);
    } else {
      const keyboard = this.input.keyboard;
      if (!keyboard) {
        throw new Error('Teclado não disponível neste dispositivo.');
      }
      this.cursors = keyboard.createCursorKeys();
      this.wasd = keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
      }) as WasdKeys;
    }

    // Legenda fixa na tela (não rola com a câmera).
    this.add
      .text(16, 16, isTouch ? 'Arraste no lado esquerdo para mover' : 'Setas ou WASD para mover', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: COLORS.text,
        backgroundColor: '#00000066',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(100);
  }

  update(): void {
    this.player.move(this.readMoveVector());
  }

  /** Une o joystick (quando ativo) e o teclado. O joystick tem prioridade se estiver em uso. */
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
