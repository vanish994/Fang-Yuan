import type { Point } from './types';

/**
 * Movimento cardinal das criaturas.
 *
 * O jogador já anda num eixo por vez (`src/world/cardinalNavigation.ts`); os
 * inimigos seguem a mesma regra: nunca na diagonal. Cada passo escolhe o eixo de
 * maior distância e, se esse eixo estiver bloqueado, tenta o outro — deslizar na
 * parede em vez de travar. Nada aqui resolve colisão de verdade: o chamador
 * continua passando o teste `isFree` do mundo.
 */

export interface CardinalStep {
  /** Posição depois do passo (igual à de origem quando `moved` é falso). */
  x: number;
  y: number;
  moved: boolean;
  /** Eixo usado no passo; `null` quando a criatura não andou. */
  axis: 'x' | 'y' | null;
}

const EPSILON = 0.5;

export function cardinalStep(from: Point, to: Point, maxStep: number,
  isFree: (x: number, y: number) => boolean, preferred: 'x' | 'y' | null = null): CardinalStep {
  const still = { x: from.x, y: from.y, moved: false, axis: null } as const;
  if (!(maxStep > 0) || !Number.isFinite(from.x) || !Number.isFinite(from.y)
    || !Number.isFinite(to.x) || !Number.isFinite(to.y)) return still;
  const dx = to.x - from.x, dy = to.y - from.y;
  const dominant: 'x' | 'y' = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  // Histerese: quem já está andando num eixo continua nele até encostar no alvo.
  // Sem isso o passo trocaria de eixo a cada quadro e o desenho viraria escada.
  const keep = preferred && Math.abs(preferred === 'x' ? dx : dy) >= EPSILON
    ? preferred : dominant;
  const order: Array<'x' | 'y'> = keep === 'x' ? ['x', 'y'] : ['y', 'x'];
  for (const axis of order) {
    const delta = axis === 'x' ? dx : dy;
    // Eixo já alinhado: andar nele seria passo lateral sem motivo.
    if (Math.abs(delta) < EPSILON) continue;
    const amount = Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
    const x = axis === 'x' ? from.x + amount : from.x;
    const y = axis === 'y' ? from.y + amount : from.y;
    if (isFree(x, y)) return { x, y, moved: true, axis };
  }
  return still;
}
