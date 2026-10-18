import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';

/**
 * Cena principal do jogo.
 * Por enquanto é só um "hello world" interativo: um quadrado que se move com as setas.
 * Substitua pelo gameplay real quando começarmos a prototipar.
 */
export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, 60, 'Fang-Yuan', {
        fontFamily: 'sans-serif',
        fontSize: '48px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 110, 'Use as setas para mover o quadrado', {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    this.player = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 64, 64, COLORS.accent);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Teclado não disponível neste dispositivo.');
    }
    this.cursors = keyboard.createCursorKeys();
  }

  update(_time: number, delta: number): void {
    const speed = 0.3 * delta;
    if (this.cursors.left.isDown) this.player.x -= speed;
    if (this.cursors.right.isDown) this.player.x += speed;
    if (this.cursors.up.isDown) this.player.y -= speed;
    if (this.cursors.down.isDown) this.player.y += speed;
  }
}
