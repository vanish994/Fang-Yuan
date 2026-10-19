import type { GuId, GuSlot } from './types';

export interface CombatSettings {
  hero: { maxHealth: number; defense: number; maxEssence: number; baseEssenceRegenPerSecond: number };
  enemy: { maxHealth: number; defense: number; damage: number; attackRange: number;
    aggroRange: number; speed: number; attackCooldownMs: number; lootStones: number;
    lootMaterialId: string; lootMaterialQuantity: number };
  basic: { damage: number; range: number; cooldownMs: number };
  moonlight: { damage: number; range: number; width: number; speed: number;
    essenceCost: number; cooldownMs: number };
  liquorWorm: { bonusEssenceRegenPerSecond: number };
  stoneSkin: { defenseBonus: number };
  movement: { distance: number; essenceCost: number; cooldownMs: number;
    speedMultiplier: number; speedBonusMs: number };
  cicada: { chance: number; restoredHealthRatio: number; cooldownMs: number };
  combatLockMs: number;
}

/**
 * Balance v0.2: R1 deve derrotar fauna comum sem transformar Gu da Lua em botão de vitória.
 * Os valores de Cigarra continuam os definidos pelo GDD; o restante é balanceamento de combate.
 */
export const COMBAT_CONFIG: CombatSettings = {
  hero: { maxHealth: 100, defense: 2, maxEssence: 100, baseEssenceRegenPerSecond: 1 },
  enemy: { maxHealth: 36, defense: 1, damage: 8, attackRange: 32, aggroRange: 96,
    speed: 32, attackCooldownMs: 1450, lootStones: 8,
    lootMaterialId: 'ruptura-rank-1', lootMaterialQuantity: 1 },
  basic: { damage: 14, range: 62, cooldownMs: 600 },
  moonlight: { damage: 26, range: 224, width: 26, speed: 320,
    essenceCost: 16, cooldownMs: 1800 },
  liquorWorm: { bonusEssenceRegenPerSecond: 2 },
  stoneSkin: { defenseBonus: 4 },
  movement: { distance: 96, essenceCost: 20, cooldownMs: 5000,
    speedMultiplier: 1.5, speedBonusMs: 1800 },
  cicada: { chance: 0.05, restoredHealthRatio: 0.5, cooldownMs: 600000 },
  combatLockMs: 5000,
} as const;

/** Nomes visuais enviados pelo usuário; Whirlwind é a grafia provisória de “redemoinho”. */
export const GU_CATALOG: Readonly<Record<GuId, { label: string; slot: GuSlot }>> = {
  moonlight: { label: 'Moonlight Gu · Gu da Lua', slot: 'attack' },
  'stone-skin': { label: 'Stone Skin Gu · Pele de Pedra', slot: 'passive' },
  'liquor-worm': { label: 'Liquor Gu · Verme do Licor', slot: 'support' },
  'whirlwind': { label: 'Whirlwind Gu · Redemoinho (teste)', slot: 'movement' },
};

/** Distâncias de teste: inimigos ficam fora da detecção inicial para permitir preparar Gu. */
export const TEST_ENEMY_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [124, 0], [-115, -85], [8, 165], [180, 140], [-185, 80], [95, -175],
];

export const GU_SLOTS: readonly GuSlot[] = ['attack', 'passive', 'movement', 'support'];

/** Carregamento de teste, não distribuição narrativa: só Moonlight começa equipado. */
export const STARTING_EQUIPMENT: Readonly<Record<GuSlot, GuId | null>> = {
  attack: 'moonlight', passive: null, movement: null, support: null,
};
