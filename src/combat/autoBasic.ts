import type { Point } from './types';

/**
 * Ataque básico automático.
 *
 * Tocar num inimigo arma o golpe: o personagem repete o básico no mesmo ritmo da
 * recarga (nada de cadência nova ou acelerada) até o jogador andar ou trocar de
 * alvo. A decisão é pura para poder ser testada sem Phaser nem DOM.
 */
export type AutoBasicDecision = 'attack' | 'hold' | 'stop';

export interface AutoBasicInput {
  /** Herói vivo. */
  alive: boolean;
  /** Alvo atual do motor (`null` = ninguém selecionado ou o alvo morreu). */
  target: Point | null;
  hero: Point;
  /** Alcance do ataque básico do personagem em campo. */
  range: number;
  /** Quanto falta para o próximo golpe; `0` = pronto. */
  cooldownRemaining: number;
  /** Parede entre o corpo a corpo e o alvo (o motor recusaria o golpe). */
  blocked?: boolean;
  /** O jogador está andando: o automático não insiste. */
  moving?: boolean;
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * `stop` desarma (morto, sem alvo, ou jogador andando), `hold` mantém armado sem
 * gastar o golpe (recarga, alvo fora de alcance ou parede no meio) e `attack`
 * solta o básico agora. Fora de alcance não gasta mensagem nenhuma: o alvo pode
 * estar vindo.
 */
export function autoBasicDecision(input: AutoBasicInput): AutoBasicDecision {
  if (!input.alive || !input.target || input.moving) return 'stop';
  if (input.cooldownRemaining > 0) return 'hold';
  if (distanceBetween(input.hero, input.target) > input.range) return 'hold';
  if (input.blocked) return 'hold';
  return 'attack';
}

/**
 * Parede no caminho do golpe corpo a corpo. É a MESMA amostragem usada por
 * `CombatEngine.basicAttack`: passos de 4 px a partir do corpo, sem testar as duas
 * pontas (o herói e o alvo já estão em pé em tile livre).
 */
export function meleeLineBlocked(from: Point, to: Point,
  isFree: (x: number, y: number) => boolean, step = 4): boolean {
  const gap = distanceBetween(from, to);
  if (!(gap > 0)) return false;
  for (let walked = step; walked < gap; walked += step) {
    const t = walked / gap;
    if (!isFree(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)) return true;
  }
  return false;
}
