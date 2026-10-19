export type GuSlot = 'attack' | 'passive' | 'movement' | 'support';
export type GuId = 'moonlight' | 'stone-skin' | 'liquor-worm' | 'whirlwind';
export type Direction = 'up' | 'down' | 'left' | 'right';
export interface Point { x: number; y: number }
export interface Combatant extends Point { health: number; maxHealth: number; defense: number; alive: boolean }
export interface Enemy extends Combatant { id: string; name?: string; lastAttackAt: number; rewarded: boolean }
export interface CombatEvent {
  type: 'damage' | 'defeat' | 'reward' | 'resurrect' | 'hero-death' | 'moonlight' | 'dash';
  targetId?: string;
  amount?: number;
  x?: number;
  y?: number;
  stoneReward?: number;
  materialId?: string;
  materialQuantity?: number;
}
export type ActionResult = { ok: boolean; reason?: string; events: CombatEvent[] };
