import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './config/gameConfig';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.background,
  // Sprites e tiles de pixel art ficam nítidos ao escalar (sem filtro borrado).
  pixelArt: true,
  // Permite mais de um dedo ao mesmo tempo (joystick + futuros botões).
  input: {
    activePointers: 3,
  },
  scale: {
    // Resize para usar toda a área disponível em landscape, sem faixas vazias.
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Física Arcade sem gravidade: jogo visto de cima.
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  // Ordem das cenas: a primeira é iniciada automaticamente.
  scene: [BootScene, GameScene],
};

new Phaser.Game(config);
