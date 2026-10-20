/**
 * Mitigação não-linear: defesa reduz dano sem criar uma barreira absoluta
 * contra cultivadores de rank inferior. Isso mantém chefes perigosos sem
 * transformar uma diferença de defesa em centenas de golpes de 1 dano.
 */
export function mitigatedDamage(amount: number, defense: number): number {
  if (amount <= 0) return 0;
  return Math.max(1, Math.floor(amount * 100 / (100 + Math.max(0, defense))));
}
