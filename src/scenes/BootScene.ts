import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { CELL_SIZE, KEYS, PATHS } from '../config/assets';

/**
 * Cena de inicialização: carrega assets e então passa para a cena principal.
 * Novos assets entram aqui, com a chave e o caminho definidos em config/assets.ts.
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

    // Atlas do chão: 6×2 tiles de 64 px (grama e terra).
    this.load.spritesheet(KEYS.groundTiles, PATHS.groundTiles, {
      frameWidth: CELL_SIZE,
      frameHeight: CELL_SIZE,
    });

    // Personagem: walk é 6 colunas × 8 direções; idle é 8 direções em uma linha.
    this.load.spritesheet(KEYS.fangYuanWalk, PATHS.fangYuanWalk, {
      frameWidth: CELL_SIZE,
      frameHeight: CELL_SIZE,
    });
    this.load.spritesheet(KEYS.fangYuanIdle, PATHS.fangYuanIdle, {
      frameWidth: CELL_SIZE,
      frameHeight: CELL_SIZE,
    });
  }

  create(): void {
    this.scene.start('GameScene');
  }
}
