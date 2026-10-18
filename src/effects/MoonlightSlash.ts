import Phaser from 'phaser';
import type { Direction } from '../config/assets';
import {
  MOONLIGHT_DIRECTIONS,
  MOONLIGHT_FRAME_MS,
  MOONLIGHT_TOTAL_FRAMES,
  type MoonlightLayer,
} from '../config/moonlightSlash';

/** Pasta dos PNGs do efeito, relativa a public/. */
const BASE_PATH = 'assets/effects/moonlight-gu';

type LayerName = 'behind' | 'front';

/** Profundidade: a camada de trás fica abaixo do personagem (10) e a da frente acima. */
const DEPTH: Record<LayerName, number> = { behind: 9, front: 11 };

export function moonlightTextureKey(dir: Direction, layer: LayerName): string {
  return `moonlight-${dir}-${layer}`;
}

function moonlightAnimKey(dir: Direction, layer: LayerName): string {
  return `${moonlightTextureKey(dir, layer)}-play`;
}

/**
 * Carrega as camadas do Moonlight Gu (8 direções, behind/front). Chamar no preload.
 * Só as camadas que existem para cada direção são carregadas (algumas direções não têm `behind`).
 */
export function loadMoonlightSlash(loader: Phaser.Loader.LoaderPlugin): void {
  for (const [dir, def] of Object.entries(MOONLIGHT_DIRECTIONS)) {
    const layers: Array<[LayerName, MoonlightLayer | null]> = [
      ['behind', def.behind],
      ['front', def.front],
    ];
    for (const [name, layer] of layers) {
      if (!layer) continue;
      loader.spritesheet(
        moonlightTextureKey(dir as Direction, name),
        `${BASE_PATH}/${def.folder}/${layer.file}`,
        { frameWidth: layer.width, frameHeight: layer.height },
      );
    }
  }
}

/** Cria as animações das camadas. Chamar uma vez, depois do carregamento. */
export function createMoonlightAnimations(scene: Phaser.Scene): void {
  for (const [dir, def] of Object.entries(MOONLIGHT_DIRECTIONS)) {
    const layers: Array<[LayerName, MoonlightLayer | null]> = [
      ['behind', def.behind],
      ['front', def.front],
    ];
    for (const [name, layer] of layers) {
      if (!layer) continue;
      const key = moonlightAnimKey(dir as Direction, name);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(moonlightTextureKey(dir as Direction, name), {
          start: 0,
          end: layer.frames - 1,
        }),
        frameRate: 1000 / MOONLIGHT_FRAME_MS,
        repeat: 0,
        hideOnComplete: true,
      });
    }
  }
}

/**
 * Uma execução do corte em meia-lua, numa direção fixa. Só desenha: não causa dano nem tem
 * hitbox ainda (o GDD prevê hitbox real, que entra junto com os inimigos).
 *
 * O efeito segue os pés do personagem enquanto dura. Quando termina, remove os próprios objetos.
 */
export class MoonlightSlash {
  private readonly parts: Array<{ sprite: Phaser.GameObjects.Sprite; layer: MoonlightLayer }> = [];
  private readonly timers: Phaser.Time.TimerEvent[] = [];

  constructor(scene: Phaser.Scene, dir: Direction) {
    const def = MOONLIGHT_DIRECTIONS[dir];
    const layers: Array<[LayerName, MoonlightLayer | null]> = [
      ['behind', def.behind],
      ['front', def.front],
    ];

    for (const [name, layer] of layers) {
      if (!layer) continue;
      // Origem no canto superior esquerdo: a posição é pés + offset, como no manifesto.
      const sprite = scene.add
        .sprite(0, 0, moonlightTextureKey(dir, name), 0)
        .setOrigin(0, 0)
        .setDepth(DEPTH[name])
        .setVisible(false);
      this.parts.push({ sprite, layer });

      // Cada camada começa no seu frame (`start`), não necessariamente no primeiro.
      this.timers.push(
        scene.time.delayedCall(layer.start * MOONLIGHT_FRAME_MS, () => {
          sprite.setVisible(true);
          sprite.play(moonlightAnimKey(dir, name));
        }),
      );
    }

    this.timers.push(
      scene.time.delayedCall(MOONLIGHT_TOTAL_FRAMES * MOONLIGHT_FRAME_MS, () => this.destroy()),
    );
  }

  /** Objetos de jogo do efeito (para a câmera de interface ignorá-los). */
  get gameObjects(): Phaser.GameObjects.GameObject[] {
    return this.parts.map((part) => part.sprite);
  }

  /** Reposiciona o efeito nos pés do personagem. Chamar a cada frame enquanto existir. */
  follow(feetX: number, feetY: number): void {
    for (const { sprite, layer } of this.parts) {
      sprite.setPosition(feetX + layer.offsetX, feetY + layer.offsetY);
    }
  }

  destroy(): void {
    for (const timer of this.timers) timer.remove(false);
    this.timers.length = 0;
    for (const { sprite } of this.parts) sprite.destroy();
    this.parts.length = 0;
  }
}
