import type { CultivationRules } from './cultivation';

/** Balanceamento inicial aprovado; tudo em dados para permitir revisão posterior. */
const RANK_BALANCE = [
  // Rank, Inicial→Médio, Médio→Superior, Superior→Pico, pedras da ruptura,
  // chance de sucesso, chance de perda de cada tipo de material na falha.
  [1, 20, 35, 55, 90, 0.80, 0.10],
  [2, 45, 75, 115, 180, 0.75, 0.15],
  [3, 90, 150, 230, 360, 0.70, 0.20],
  [4, 180, 300, 460, 720, 0.65, 0.25],
  [5, 360, 600, 920, 1440, 0.60, 0.30],
  [6, 720, 1200, 1840, 2880, 0.55, 0.35],
  [7, 1440, 2400, 3680, 5760, 0.50, 0.40],
  [8, 2880, 4800, 7360, 11520, 0.45, 0.45],
  [9, 5760, 9600, 14720, null, null, null],
] as const;

/** Identificador neutro até a escolha dos drops e de seus inimigos, sem inventar lore. */
export function breakthroughMaterialId(rank: number): string {
  return `ruptura-rank-${rank}`;
}

export function breakthroughMaterialName(rank: number): string {
  return `Material de ruptura · Rank ${rank}`;
}

/** Nome de exibição a partir do id persistido; ids desconhecidos aparecem como estão. */
export function breakthroughMaterialLabel(id: string): string {
  const match = /^ruptura-rank-(\d+)$/.exec(id);
  return match ? breakthroughMaterialName(Number(match[1])) : id;
}

export const CULTIVATION_RULES: CultivationRules = {
  stageCosts: Object.fromEntries(RANK_BALANCE.map(([rank, initial, middle, superior]) =>
    [rank, { Inicial: initial, Médio: middle, Superior: superior }])),
  rankCosts: Object.fromEntries(RANK_BALANCE.slice(0, -1).map(
    ([rank, , , , stones, successChance, materialLossChance]) => {
      if (stones === null || successChance === null || materialLossChance === null) {
        throw new Error('Rank sem requisitos de ruptura na tabela');
      }
      return [rank, { stones, successChance, materialLossChance,
        materials: [{ id: breakthroughMaterialId(rank), quantity: rank }] }];
    },
  )),
};
