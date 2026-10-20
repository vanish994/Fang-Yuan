import type { AgentTraits } from '../agents/agentBrain';

export interface MobDefinition {
  id: string; name: string; tier: 1 | 2 | 3 | 'boss';
  x: number; y: number; health: number; defense: number; damage: number;
  speed: number; aggroRange: number; attackRange: number; attackCooldownMs: number;
  fear: number; pack: boolean; memoryMs: number;
  rewardStones: number; rewardMaterialId: string; rewardMaterialQuantity: number;
  /** Instâncias adicionais compartilham a arte/perfil desta espécie do catálogo. */
  spriteId?: string;
  /** Habilidade apenas planejada: não é prometida como mecânica ativa. */
  plannedAbility?: string;
}

/** Balance v0.2: fauna comum fica em ~2–6 golpes; fauna perigosa em ~8–18; bosses exigem preparação. */
const mob = (id: string, name: string, tier: MobDefinition['tier'], tileX: number, tileY: number,
  hp: number, defense: number, damage: number, speed: number, aggro: number,
  rewardStones: number, rewardMaterialId: string, rewardMaterialQuantity: number,
  options: Partial<Pick<MobDefinition, 'fear' | 'pack' | 'memoryMs' | 'plannedAbility'>> = {},
): Readonly<MobDefinition> => ({ id: `mob-${id}`, name, tier, x: tileX * 32, y: tileY * 32,
  health: hp, defense, damage, speed, aggroRange: aggro, attackRange: 32,
  attackCooldownMs: tier === 'boss' ? 1700 : 1450, fear: 0.25, pack: false, memoryMs: 3000,
  rewardStones, rewardMaterialId, rewardMaterialQuantity, ...options });

export const TEST_MOBS: readonly Readonly<MobDefinition>[] = [
  mob('wild-boar', 'Javali Selvagem', 1, 18, 24, 45, 2, 9, 42, 80, 7, 'ruptura-rank-1', 1),
  mob('moon-rabbit', 'Coelho Lunar', 1, 31, 25, 22, 0, 4, 60, 45, 5, 'ruptura-rank-1', 1, { fear: 0.85 }),
  mob('grey-wolf', 'Lobo Cinzento', 1, 25, 17, 55, 3, 11, 52, 120, 9, 'ruptura-rank-1', 1,
    { fear: 0.35, pack: true, memoryMs: 30_000 }),
  mob('mountain-monkey', 'Macaco da Montanha', 1, 25, 32, 65, 3, 13, 48, 100, 10, 'ruptura-rank-1', 1),
  mob('green-snake', 'Serpente Verde', 1, 17, 29, 40, 2, 15, 38, 90, 9, 'ruptura-rank-1', 1),

  mob('fierce-wolf', 'Lobo Feroz', 2, 12, 18, 110, 5, 22, 55, 150, 22, 'ruptura-rank-2', 1,
    { pack: true, plannedAbility: 'investida' }),
  mob('demonic-boar', 'Javali Demoníaco', 2, 35, 18, 145, 7, 28, 40, 130, 26, 'ruptura-rank-2', 1,
    { plannedAbility: 'carga' }),
  mob('black-fang-snake', 'Serpente de Presas Negras', 2, 35, 32, 105, 5, 30, 44, 120, 24, 'ruptura-rank-2', 1,
    { plannedAbility: 'veneno' }),
  mob('shadow-spider', 'Aranha Sombria', 2, 13, 34, 95, 4, 19, 35, 110, 20, 'ruptura-rank-2', 1,
    { plannedAbility: 'lentidão' }),
  mob('stone-lizard', 'Lagarto de Pedra', 2, 20, 37, 135, 10, 18, 25, 90, 25, 'ruptura-rank-2', 1),

  mob('demon-wolf', 'Lobo Demoníaco', 3, 12, 12, 210, 8, 36, 60, 190, 65, 'ruptura-rank-3', 1,
    { pack: true, memoryMs: 30_000, plannedAbility: 'caça em grupo' }),
  mob('demon-bear', 'Urso Demoníaco', 3, 36, 12, 300, 12, 45, 32, 150, 80, 'ruptura-rank-3', 1,
    { plannedAbility: 'atordoamento' }),

  mob('grey-wolf-king', 'Rei Lobo Cinzento', 'boss', 12, 36, 450, 10, 45, 52, 160, 180, 'ruptura-rank-2', 2,
    { pack: true, plannedAbility: 'chamar lobos' }),
  mob('demonic-boar-king', 'Rei Javali Demoníaco', 'boss', 36, 36, 550, 12, 55, 40, 150, 220, 'ruptura-rank-2', 2,
    { plannedAbility: 'carga devastadora' }),
  mob('serpent-king', 'Rei Serpente', 'boss', 25, 10, 700, 15, 65, 45, 160, 320, 'ruptura-rank-3', 3,
    { plannedAbility: 'veneno e constrição' }),
  mob('ancient-demonic-beast', 'Besta Demoníaca Antiga', 'boss', 37, 24, 1000, 20, 85, 32, 160, 600, 'ruptura-rank-4', 4,
    { plannedAbility: 'encontro de endgame' }),
];

export function enemyTraits(mob: Pick<MobDefinition, 'aggroRange' | 'attackRange' | 'memoryMs' | 'fear' | 'pack'>): AgentTraits {
  return { kind: 'enemy', vision: mob.aggroRange, attackRange: mob.attackRange,
    memoryMs: mob.memoryMs, fear: mob.fear, pack: mob.pack };
}
