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

/** Balance v0.2: valores ajustados por TTK e risco; habilidades continuam pendentes de implementação. */
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
  mob('fierce-wolf', 'Lobo Feroz', 2, 12, 18, 100, 5, 22, 55, 150,
    { pack: true, plannedAbility: 'investida' }),
  mob('demonic-boar', 'Javali Demoníaco', 2, 35, 18, 135, 6, 28, 40, 130,
    { plannedAbility: 'carga' }),
  mob('black-fang-snake', 'Serpente de Presas Negras', 2, 35, 32, 100, 5, 30, 44, 120,
    { plannedAbility: 'veneno' }),
  mob('shadow-spider', 'Aranha Sombria', 2, 13, 34, 90, 4, 19, 35, 110,
    { plannedAbility: 'lentidão' }),
  mob('stone-lizard', 'Lagarto de Pedra', 2, 20, 37, 125, 9, 18, 25, 90),
  mob('demon-wolf', 'Lobo Demoníaco', 3, 12, 12, 180, 7, 36, 60, 190,
    { pack: true, memoryMs: 30_000, plannedAbility: 'caça em grupo' }),
  mob('demon-bear', 'Urso Demoníaco', 3, 36, 12, 240, 9, 45, 32, 150,
    { plannedAbility: 'atordoamento' }),
  mob('grey-wolf-king', 'Rei Lobo Cinzento', 'boss', 12, 36, 300, 7, 45, 52, 160,
    { pack: true, plannedAbility: 'chamar lobos' }),
  mob('demonic-boar-king', 'Rei Javali Demoníaco', 'boss', 36, 36, 360, 8, 55, 40, 150,
    { plannedAbility: 'carga devastadora' }),
  mob('serpent-king', 'Rei Serpente', 'boss', 25, 10, 450, 9, 65, 45, 160,
    { plannedAbility: 'veneno e constrição' }),
  mob('ancient-demonic-beast', 'Besta Demoníaca Antiga', 'boss', 37, 24, 600, 10, 85, 32, 160,
    { plannedAbility: 'encontro de endgame' }),
];

export function enemyTraits(mob: Pick<MobDefinition, 'aggroRange' | 'attackRange' | 'memoryMs' | 'fear' | 'pack'>): AgentTraits {
  return { kind: 'enemy', vision: mob.aggroRange, attackRange: mob.attackRange,
    memoryMs: mob.memoryMs, fear: mob.fear, pack: mob.pack };
}
