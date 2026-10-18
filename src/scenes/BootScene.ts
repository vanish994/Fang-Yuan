import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';

/**
 * Cena de inicialização: carrega assets e então passa para a cena principal.
 * Adicione aqui `this.load.image(...)`, `this.load.audio(...)`, etc.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const label = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Carregando...', {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      label.setText(`Carregando... ${Math.round(value * 100)}%`);
    });
  }

  create(): void {
    this.scene.start('GameScene');
  }
}
