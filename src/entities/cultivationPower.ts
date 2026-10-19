/**
 * Curva de poder de cultivo usada pelo balanceamento.
 * Não cria XP/níveis: o GDD continua usando somente Rank + estágio.
 *
 * power é uma unidade relativa ao Rank 1 Inicial.
 * Os campos derivados são referências de balanceamento e serão ligados ao
 * estado de combate quando a ficha passar a aplicar atributos de cultivo.
 */
import type { Stage } from './cultivation';

export interface CultivationPower {
  rank: number;
  stage: Stage;
  power: number;
  maxHealthMultiplier: number;
  attackMultiplier: number;
  defenseMultiplier: number;
  maxEssenceMultiplier: number;
}

const ROWS: readonly (readonly [number, Stage, number])[] = [
  [1, 'Inicial', 1.00], [1, 'Médio', 1.08], [1, 'Superior', 1.16], [1, 'Pico', 1.25],
  [2, 'Inicial', 1.38], [2, 'Médio', 1.48], [2, 'Superior', 1.59], [2, 'Pico', 1.72],
  [3, 'Inicial', 1.90], [3, 'Médio', 2.04], [3, 'Superior', 2.19], [3, 'Pico', 2.35],
  [4, 'Inicial', 2.60], [4, 'Médio', 2.78], [4, 'Superior', 2.97], [4, 'Pico', 3.18],
  [5, 'Inicial', 3.50], [5, 'Médio', 3.75], [5, 'Superior', 4.02], [5, 'Pico', 4.30],
  [6, 'Inicial', 4.75], [6, 'Médio', 5.10], [6, 'Superior', 5.45], [6, 'Pico', 5.85],
  [7, 'Inicial', 6.45], [7, 'Médio', 6.90], [7, 'Superior', 7.35], [7, 'Pico', 7.85],
  [8, 'Inicial', 8.70], [8, 'Médio', 9.30], [8, 'Superior', 9.90], [8, 'Pico', 10.55],
  [9, 'Inicial', 11.70], [9, 'Médio', 12.50], [9, 'Superior', 13.30], [9, 'Pico', 14.20],
];

export const CULTIVATION_POWER_CURVE: readonly CultivationPower[] = ROWS.map(([rank, stage, power]) => ({
  rank,
  stage,
  power,
  maxHealthMultiplier: Number(power ** 0.80.toFixed?.() ?? 0),
  attackMultiplier: power,
  defenseMultiplier: power ** 0.60,
  maxEssenceMultiplier: power,
}));

// Evita expor uma fórmula estranha no runtime: a tabela acima é a fonte dos dados.
for (const row of CULTIVATION_POWER_CURVE as CultivationPower[]) {
  row.maxHealthMultiplier = Number(row.power ** 0.80);
}

export function cultivationPower(rank: number, stage: Stage): CultivationPower {
  const row = CULTIVATION_POWER_CURVE.find((entry) => entry.rank === rank && entry.stage === stage);
  if (!row) throw new RangeError(`Estágio de cultivo inválido: Rank ${rank} ${stage}`);
  return row;
}
