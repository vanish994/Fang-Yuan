import type Phaser from 'phaser';
import { GU_EFFECT_COUNT, styleEffectFrames, effectScale,
  type GuEffectBurst } from './guEffects';

/**
 * Partículas de Gu no mundo.
 *
 * Cada estilo de personagem tem uma folha-máscara própria (`gu-effects` para o
 * Fang Yuan, `ice-effects` para o Bai Ning Bing): quatro formas em tons neutros,
 * quatro quadros cada. O desenho vem da folha e a cor vem do catálogo, então o
 * mesmo desenho serve para qualquer Gu novo sem precisar de arte nova.
 */
export class GuEffectView {
  private readonly scene: Phaser.Scene;
  /** Chave `folha:forma` -> emissor, para as duas folhas conviverem. */
  private readonly emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly live = new Set<Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(scene: Phaser.Scene) { this.scene = scene; }

  private emitter(texture: string, shape: string): Phaser.GameObjects.Particles.ParticleEmitter {
    const key = `${texture}:${shape}`;
    const existing = this.emitters.get(key);
    if (existing) return existing;
    const emitter = this.scene.add.particles(0, 0, texture, {
      // Quadros da forma em sequência: a partícula percorre o desenho em vez de
      // sortear um quadro solto.
      frame: { frames: styleEffectFrames(texture === 'ice-effects' ? 'ice' : 'gu', shape), cycle: true },
      lifespan: 420,
      speed: { min: 18, max: 70 },
      angle: { min: 0, max: 360 },
      scale: { start: effectScale(shape), end: 0.15 },
      alpha: { start: 0.92, end: 0 },
      rotate: { min: -30, max: 30 },
      emitting: false,
    }).setDepth(905);
    emitter.setParticleTint(0xffffff);
    this.emitters.set(key, emitter);
    this.live.add(emitter);
    return emitter;
  }

  /**
   * Estouro curto no ponto indicado. `tint` é a cor do Gu (ou a do personagem
   * quando a ação não tem Gu); nenhuma cor fica gravada na arte.
   */
  burst(kind: GuEffectBurst, x: number, y: number, shape: string, tint: number,
    texture = 'gu-effects'): void {
    const emitter = this.emitter(texture, shape);
    emitter.setDepth(y + 1);
    emitter.setParticleTint(tint);
    emitter.explode(GU_EFFECT_COUNT[kind], x, y);
  }

  /** Quantas formas já foram instanciadas (usado para diagnóstico e testes). */
  get activeShapes(): string[] {
    return [...this.emitters.keys()];
  }

  destroy(): void {
    for (const emitter of this.live) emitter.destroy();
    this.live.clear();
    this.emitters.clear();
  }
}
