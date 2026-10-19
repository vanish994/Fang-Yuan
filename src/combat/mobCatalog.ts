import type { AgentTraits } from '../agents/agentBrain';

export interface MobDefinition {
  id: string; name: string; tier: 1 | 2 | 3 | 'boss';
  x: number; y: number; health: number; defense: number; damage: number;
  speed: number; aggroRange: number; attackRange: number; attackCooldownMs: number;
  fear: number; pack: boolean; memoryMs: number;
  /** Instâncias adicionais compartilham a arte/perfil desta espécie do catálogo. */
  spriteId?: string;
  /** Habilidade apenas planejada: não é prometida como mecânica ativa. */
  plannedAbility?: string;
}

/** Proposta de testes, NÃO cânone da obra nem balanceamento aprovado da campanha. */
const mob = (id: string, name: string, tier: MobDefinition['tier'], tileX: number, tileY: number,
  hp: number, defense: number, damage: number, speed: number, aggro: number,
  options: Partial<Pick<MobDefinition, 'fear' | 'pack' | 'memoryMs' | 'plannedAbility'>> = {},
): Readonly<MobDefinition> => ({ id: `mob-${id}`, name, tier, x: tileX * 32, y: tileY * 32,
  health: hp, defense, damage, speed, aggroRange: aggro, attackRange: 32,
  attackCooldownMs: 1450, fear: 0.25, pack: false, memoryMs: 3000, ...options });

/** 5 mobs externos + 5 perigosos + 2 para cultivadores + 4 bosses; atlas direcionais próprios. */
export const TEST_MOBS: readonly Readonly<MobDefinition>[] = [
  mob('wild-boar', 'Javali Selvagem', 1, 18, 24, 45, 2, 9, 42, 80),
  mob('moon-rabbit', 'Coelho Lunar', 1, 31, 25, 22, 0, 4, 60, 45, { fear: 0.85 }),
  mob('grey-wolf', 'Lobo Cinzento', 1, 25, 17, 55, 3, 11, 52, 120,
    { fear: 0.35, pack: true, memoryMs: 30_000 }),
  mob('mountain-monkey', 'Macaco da Montanha', 1, 25, 32, 65, 3, 13, 48, 100),
  mob('green-snake', 'Serpente Verde', 1, 17, 29, 40, 2, 15, 38, 90),
  mob('fierce-wolf', 'Lobo Feroz', 2, 12, 18, 120, 7, 22, 55, 150,
    { pack: true, plannedAbility: 'investida' }),
  mob('demonic-boar', 'Javali Demoníaco', 2, 35, 18, 180, 10, 28, 40, 130,
    { plannedAbility: 'carga' }),
  mob('black-fang-snake', 'Serpente de Presas Negras', 2, 35, 32, 110, 6, 30, 44, 120,
    { plannedAbility: 'veneno' }),
  mob('shadow-spider', 'Aranha Sombria', 2, 13, 34, 90, 5, 19, 35, 110,
    { plannedAbility: 'lentidão' }),
  mob('stone-lizard', 'Lagarto de Pedra', 2, 20, 37, 160, 15, 18, 25, 90),
  mob('demon-wolf', 'Lobo Demoníaco', 3, 12, 12, 280, 14, 42, 60, 190,
    { pack: true, memoryMs: 30_000, plannedAbility: 'caça em grupo' }),
  mob('demon-bear', 'Urso Demoníaco', 3, 36, 12, 420, 22, 55, 32, 150,
    { plannedAbility: 'atordoamento' }),
  mob('grey-wolf-king', 'Rei Lobo Cinzento', 'boss', 12, 36, 1200, 45, 95, 52, 160,
    { pack: true, plannedAbility: 'chamar lobos' }),
  mob('demonic-boar-king', 'Rei Javali Demoníaco', 'boss', 36, 36, 1500, 55, 110, 40, 150,
    { plannedAbility: 'carga devastadora' }),
  mob('serpent-king', 'Rei Serpente', 'boss', 25, 10, 1800, 48, 125, 45, 160,
    { plannedAbility: 'veneno e constrição' }),
  mob('ancient-demonic-beast', 'Besta Demoníaca Antiga', 'boss', 37, 24, 3500, 80, 180, 32, 160,
    { plannedAbility: 'encontro de endgame' }),
];

export function enemyTraits(mob: Pick<MobDefinition, 'aggroRange' | 'attackRange' | 'memoryMs' | 'fear' | 'pack'>): AgentTraits {
  return { kind: 'enemy', vision: mob.aggroRange, attackRange: mob.attackRange,
    memoryMs: mob.memoryMs, fear: mob.fear, pack: mob.pack };
}
