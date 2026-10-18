import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { CELL_SIZE, KEYS, PATHS } from '../config/assets';
import { loadMoonlightSlash } from '../effects/MoonlightSlash';
import { villageTextureFiles } from '../world/village/villageMap';

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

    // Atlas do chão (grama, terra, penhascos, escadas e trilhas): 8×5 tiles de 64 px.
    this.load.spritesheet(KEYS.villageBase, PATHS.villageBase, {
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
    this.load.spritesheet(KEYS.fangYuanAttack, PATHS.fangYuanAttack, {
      frameWidth: CELL_SIZE,
      frameHeight: CELL_SIZE,
    });
    this.load.spritesheet(KEYS.fangYuanDash, PATHS.fangYuanDash, {
      frameWidth: CELL_SIZE,
      frameHeight: CELL_SIZE,
    });

    // Efeito da habilidade (Moonlight Gu): camadas de cada direção, cada uma com seu tamanho.
    loadMoonlightSlash(this.load);

    // Vila: recortes do Harmonious Seasons (sheets inteiras) e peças do Feudal Japan.
    for (const file of villageTextureFiles()) {
      this.load.image(file.key, file.file);
    }
  }

  create(): void {
    this.scene.start('GameScene');
  }
}
