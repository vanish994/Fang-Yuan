import Phaser from 'phaser';
import { COLORS } from '../config/gameConfig';
import { CELL_SIZE, KEYS } from '../config/assets';
import { CHUNK_COLS, CHUNK_ROWS, buildTestChunk } from '../world/testChunk';
import { Player, createFangYuanAnimations, type MoveInput } from '../entities/Player';

/**
 * Cena de teste: um chunk pequeno de chão (grama e terra) com o personagem Fang Yuan.
 * Use WASD ou as setas para mover.
 */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

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

    // Controles: setas e WASD.
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
    }) as GameScene['wasd'];

    // Legenda fixa na tela (não rola com a câmera).
    this.add
      .text(16, 16, 'Setas ou WASD para mover', {
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
    const input: MoveInput = {
      left: this.cursors.left.isDown || this.wasd.left.isDown,
      right: this.cursors.right.isDown || this.wasd.right.isDown,
      up: this.cursors.up.isDown || this.wasd.up.isDown,
      down: this.cursors.down.isDown || this.wasd.down.isDown,
    };
    this.player.move(input);
  }
}
