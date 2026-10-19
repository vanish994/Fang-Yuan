import type { CardinalDirection } from './directions';
import type { CultivationState } from './cultivation';

/** Identidade de Fang Yuan e área inicial. */
export const FANG_YUAN_PROFILE = {
  name: 'Fang Yuan',
  area: 'Vila Gu Yue · Montanha Qing Mao',
} as const;

/** Sem fontes de recursos nesta camada: 0 pedras e nenhum drop, não créditos fictícios. */
export const INITIAL_CULTIVATION: CultivationState = {
  rank: 1, stage: 'Inicial', spiritStones: 0, materials: {},
};

/** Estes outros sistemas ainda não têm valores ou regras aprovadas. */
export const UNCONFIGURED_CHARACTER = {
  aptitude: null, opening: null, openingCapacity: null,
} as const;

const DIRECTION_LABELS: Record<CardinalDirection, string> = {
  down: 'Sul', left: 'Oeste', right: 'Leste', up: 'Norte',
};

/** Leitura da mecânica existente, independente de Phaser e da interface. */
export function characterSheetState(facing: CardinalDirection, moving: boolean) {
  return {
    ...FANG_YUAN_PROFILE,
    activity: moving ? 'Caminhando' : 'Parado',
    direction: DIRECTION_LABELS[facing],
  };
}
