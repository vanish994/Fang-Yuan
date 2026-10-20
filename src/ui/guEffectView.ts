import type Phaser from 'phaser';
import { effectFrames, effectScale, GU_EFFECT_COUNT, GU_EFFECT_SHAPES,
  type GuEffectBurst, type GuEffectShape } from './guEffects';

/**
 * Partículas de Gu no mundo.
 *
 * A folha `gu-effects-4x4-32.png` guarda quatro formas (redemoinho, corte, fumaça e
 * rastro) em tons neutros. Cada estouro escolhe a forma pela função do Gu e pinta as
 * partículas com a cor do catálogo (`setParticleTint`), então o mesmo desenho serve
 * para qualquer Gu novo sem precisar de arte nova.
 */
export class GuEffectView {
  private readonly scene: Phaser.Scene;
  private readonly emitters = new Map<GuEffectShape, Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly bursts = new Set<Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(scene: Phaser.Scene) { this.scene = scene; }

  private emitter(shape: GuEffectShape): Phaser.GameObjects.Particles.ParticleEmitter {
    const existing = this.emitters.get(shape);
    if (existing) return existing;
    const emitter = this.scene.add.particles(0, 0, 'gu-effects', {
      // Quadros da forma em sequência: a partícula percorre o desenho em vez de
      // sortear um quadro solto.
      frame: { frames: effectFrames(shape), cycle: true },
      lifespan: 420,
      speed: { min: 18, max: 70 },
      angle: { min: 0, max: 360 },
      scale: { start: effectScale(shape), end: 0.15 },
      alpha: { start: 0.92, end: 0 },
      rotate: { min: -30, max: 30 },
      emitting: false,
    }).setDepth(905);
    emitter.setParticleTint(0xffffff);
    this.emitters.set(shape, emitter);
    this.bursts.add(emitter);
    return emitter;
  }

  /** Estouro curto no ponto indicado; a cor vem do Gu quando informada. */
  burst(kind: GuEffectBurst, x: number, y: number,
    shape: GuEffectShape, tint: number): void {
    const emitter = this.emitter(shape);
    emitter.setDepth(y + 1);
    emitter.setParticleTint(tint);
    emitter.explode(GU_EFFECT_COUNT[kind], x, y);
  }

  /** Quantas formas já foram instanciadas (usado para diagnóstico e testes). */
  get activeShapes(): GuEffectShape[] {
    return GU_EFFECT_SHAPES.filter(shape => this.emitters.has(shape));
  }

  destroy(): void {
    for (const emitter of this.bursts) emitter.destroy();
    this.bursts.clear();
    this.emitters.clear();
  }
}
