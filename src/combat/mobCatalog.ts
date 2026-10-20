import type { AgentTraits } from '../agents/agentBrain';
import type { GuId } from './types';

export interface MobDefinition {
  id: string; name: string; tier: 1 | 2 | 3 | 'boss';
  /** Rank da criatura; nenhum Gu acima dele pode ser sorteado. */
  rank: number;
  x: number; y: number; health: number; defense: number; damage: number;
  speed: number; aggroRange: number; attackRange: number; attackCooldownMs: number;
  fear: number; pack: boolean; memoryMs: number;
  rewardStones: number; rewardMaterialId: string; rewardMaterialQuantity: number;
  spriteId?: string;
  /** Habilidade planejada; não é prometida como mecânica ativa neste passe. */
  plannedAbility?: string;
  /** Restringe o sorteio de Gu selvagem a opções coerentes com a criatura. */
  wildGuAffinity?: readonly GuId[];
}

/**
 * Balance v0.3: 5 mobs por tier + 4 bosses.
 * TTK é validado com a mitigação não-linear do combate; bosses dependem de
 * mecânicas e Gus de rank superior, não de transformar o Gu da Lua Rank 1 em
 * uma arma de endgame.
 */
const mob = (id: string, name: string, tier: MobDefinition['tier'], tileX: number, tileY: number,
  hp: number, defense: number, damage: number, speed: number, aggro: number,
  rewardStones: number, rewardMaterialId: string, rewardMaterialQuantity: number,
  options: Partial<Pick<MobDefinition, 'fear' | 'pack' | 'memoryMs' | 'plannedAbility'
    | 'rank' | 'wildGuAffinity'>> = {},
): Readonly<MobDefinition> => ({ id: `mob-${id}`, name, tier, rank: tier === 'boss' ? 3 : tier,
  x: tileX * 32, y: tileY * 32,
  health: hp, defense, damage, speed, aggroRange: aggro, attackRange: 32,
  attackCooldownMs: tier === 'boss' ? 1700 : 1450, fear: 0.25, pack: false, memoryMs: 3000,
  rewardStones, rewardMaterialId, rewardMaterialQuantity, ...options });

export const TEST_MOBS: readonly Readonly<MobDefinition>[] = [
  // Tier 1 — fauna comum.
  mob('wild-boar', 'Javali Selvagem', 1, 18, 24, 45, 2, 9, 42, 80, 7, 'ruptura-rank-1', 1,
    { wildGuAffinity: ['rock-skin', 'bone-spear', 'exploding-egg'] }),
  mob('moon-rabbit', 'Coelho Lunar', 1, 31, 25, 22, 0, 4, 60, 45, 5, 'ruptura-rank-1', 1,
    { fear: 0.85, wildGuAffinity: ['clear-wind-wheel', 'star-dart', 'beast-skin'] }),
  mob('grey-wolf', 'Lobo Cinzento', 1, 25, 17, 55, 3, 11, 52, 120, 9, 'ruptura-rank-1', 1,
    { fear: 0.35, pack: true, memoryMs: 30_000,
      wildGuAffinity: ['whirlwind', 'star-arrow', 'bone-spear', 'beast-skin'] }),
  mob('mountain-monkey', 'Macaco da Montanha', 1, 25, 32, 65, 3, 13, 48, 100, 10, 'ruptura-rank-1', 1,
    { wildGuAffinity: ['dragonpill-cricket', 'stone-skin', 'star-arrow'] }),
  mob('green-snake', 'Serpente Verde', 1, 17, 29, 40, 2, 15, 38, 90, 9, 'ruptura-rank-1', 1,
    { wildGuAffinity: ['ghost-fire', 'bone-spear', 'iron-skin'] }),

  // Tier 2 — fauna perigosa.
  mob('fierce-wolf', 'Lobo Feroz', 2, 12, 18, 120, 7, 22, 55, 150, 22, 'ruptura-rank-2', 1,
    { pack: true, plannedAbility: 'investida', wildGuAffinity: ['moonglow'] }),
  mob('demonic-boar', 'Javali Demoníaco', 2, 35, 18, 180, 10, 28, 40, 130, 26, 'ruptura-rank-2', 1,
    { plannedAbility: 'carga', wildGuAffinity: ['white-jade'] }),
  mob('black-fang-snake', 'Serpente de Presas Negras', 2, 35, 32, 110, 6, 30, 44, 120, 24, 'ruptura-rank-2', 1,
    { plannedAbility: 'veneno', wildGuAffinity: ['moonglow'] }),
  mob('shadow-spider', 'Aranha Sombria', 2, 13, 34, 90, 5, 19, 35, 110, 20, 'ruptura-rank-2', 1,
    { plannedAbility: 'lentidão', wildGuAffinity: ['white-jade'] }),
  mob('stone-lizard', 'Lagarto de Pedra', 2, 20, 37, 160, 15, 18, 25, 90, 25, 'ruptura-rank-2', 1,
    { wildGuAffinity: ['white-jade'] }),

  // Tier 3 — elites; o jogador ainda precisa de preparação.
  mob('demon-wolf', 'Lobo Demoníaco', 3, 12, 12, 280, 14, 42, 60, 190, 65, 'ruptura-rank-3', 1,
    { pack: true, memoryMs: 30_000, plannedAbility: 'caça em grupo', wildGuAffinity: ['moonglow'] }),
  mob('demon-bear', 'Urso Demoníaco', 3, 36, 12, 420, 22, 55, 32, 150, 80, 'ruptura-rank-3', 1,
    { plannedAbility: 'atordoamento', wildGuAffinity: ['white-jade'] }),
  mob('jade-serpent', 'Serpente de Jade', 3, 40, 16, 260, 12, 65, 50, 170, 75, 'ruptura-rank-3', 1,
    { plannedAbility: 'veneno', wildGuAffinity: ['white-jade'] }),
  mob('demon-tiger', 'Tigre Demoníaco', 3, 39, 24, 500, 25, 70, 58, 200, 110, 'ruptura-rank-3', 1,
    { plannedAbility: 'emboscada', wildGuAffinity: ['moonglow'] }),
  mob('boar-king', 'Rei Javali', 3, 38, 34, 700, 30, 85, 45, 220, 140, 'ruptura-rank-3', 1,
    { plannedAbility: 'carga e rugido', wildGuAffinity: ['white-jade', 'rock-skin'] }),

  // Bosses — encounters de preparação, não testes de DPS do Gu da Lua Rank 1.
  mob('grey-wolf-king', 'Rei Lobo Cinzento', 'boss', 12, 36, 1200, 45, 95, 52, 220, 180, 'ruptura-rank-2', 2,
    { pack: true, plannedAbility: 'chamar lobos', rank: 2, wildGuAffinity: ['moonglow'] }),
  mob('demonic-boar-king', 'Rei Javali Demoníaco', 'boss', 36, 36, 1500, 55, 110, 40, 220, 220, 'ruptura-rank-2', 2,
    { plannedAbility: 'carga devastadora', rank: 2, wildGuAffinity: ['white-jade'] }),
  mob('serpent-king', 'Rei Serpente', 'boss', 25, 10, 1800, 48, 125, 45, 220, 320, 'ruptura-rank-3', 3,
    { plannedAbility: 'veneno e constrição', rank: 3, wildGuAffinity: ['moonglow'] }),
  mob('ancient-demonic-beast', 'Besta Demoníaca Antiga', 'boss', 37, 24, 3500, 80, 180, 32, 220, 600, 'ruptura-rank-4', 4,
    { plannedAbility: 'encontro de endgame', rank: 4, wildGuAffinity: ['white-jade'] }),
];

export function enemyTraits(mob: Pick<MobDefinition, 'aggroRange' | 'attackRange' | 'memoryMs' | 'fear' | 'pack'>): AgentTraits {
  return { kind: 'enemy', vision: mob.aggroRange, attackRange: mob.attackRange,
    memoryMs: mob.memoryMs, fear: mob.fear, pack: mob.pack };
}
