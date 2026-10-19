/** Cultivo por Rank e estágio; não há XP nem nível numérico. */
export const MAX_RANK = 9;
export const STAGES = ['Inicial', 'Médio', 'Superior', 'Pico'] as const;
export type Stage = (typeof STAGES)[number];

export interface CultivationState {
  rank: number;
  stage: Stage;
  spiritStones: number;
  materials: Readonly<Record<string, number>>;
}

export interface MaterialRequirement { id: string; quantity: number }
export interface RankRequirement {
  stones: number;
  materials: readonly MaterialRequirement[];
  successChance: number;
  materialLossChance: number;
}

/** Chaves de stageCosts: estágio atual -> custo para chegar ao próximo. Pico usa rankCosts. */
export interface CultivationRules {
  stageCosts: Readonly<Record<number, Partial<Record<Stage, number>>>>;
  rankCosts: Readonly<Record<number, RankRequirement>>;
}

export type AdvanceRequirement =
  | { kind: 'maximum'; canAdvance: false }
  | { kind: 'unconfigured'; canAdvance: false }
  | { kind: 'stage'; stones: number; nextStage: Stage; missingStones: number; canAdvance: boolean }
  | { kind: 'rank'; stones: number; materials: readonly MaterialRequirement[];
      successChance: number; materialLossChance: number; missingStones: number;
      missingMaterials: readonly MaterialRequirement[]; canAdvance: boolean };

export type AdvanceResult = {
  status: 'advanced' | 'failed' | 'insufficient-stones' | 'missing-materials'
    | 'unconfigured' | 'maximum';
  state: CultivationState;
  lostMaterials?: Readonly<Record<string, number>>;
};

function validAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validChance(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function isValidCultivationState(input: unknown): input is CultivationState {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return false;
  const state = input as Record<string, unknown>;
  if (typeof state.rank !== 'number' || !Number.isInteger(state.rank)
    || state.rank < 1 || state.rank > MAX_RANK
    || typeof state.stage !== 'string' || !STAGES.includes(state.stage as Stage)
    || typeof state.spiritStones !== 'number' || !validAmount(state.spiritStones)) return false;
  const materials = state.materials;
  if (typeof materials !== 'object' || materials === null || Array.isArray(materials)) return false;
  return Object.entries(materials).every(([id, amount]) =>
    /^[a-z0-9][a-z0-9._-]{0,63}$/.test(id) && typeof amount === 'number' && validAmount(amount));
}

function assertState(state: CultivationState): void {
  if (!isValidCultivationState(state)) throw new RangeError('Estado de cultivo inválido');
}

function assertStageCost(cost: number, rules: CultivationRules, rank: number, stage: Stage): void {
  if (!Number.isSafeInteger(cost) || cost <= 0) throw new RangeError('Custo de estágio inválido');
  const index = STAGES.indexOf(stage);
  // Uma etapa mais alta custa mais pedras do que a etapa anterior do mesmo Rank.
  const previous = rules.stageCosts[rank]?.[STAGES[index - 1]!];
  const next = rules.stageCosts[rank]?.[STAGES[index + 1]!];
  if ((previous !== undefined && cost <= previous) || (next !== undefined && cost >= next)) {
    throw new RangeError('Custos de estágios devem ser crescentes');
  }
}

function assertRankRequirement(requirement: RankRequirement): void {
  if (!Number.isSafeInteger(requirement.stones) || requirement.stones <= 0
    || !validChance(requirement.successChance) || !validChance(requirement.materialLossChance)
    || requirement.materials.length === 0
    || new Set(requirement.materials.map(({ id }) => id)).size !== requirement.materials.length
    || requirement.materials.some(({ id, quantity }) => !id || !Number.isSafeInteger(quantity) || quantity <= 0)) {
    throw new RangeError('Requisitos de ruptura inválidos');
  }
}

function spendMaterials(materials: CultivationState['materials'], requirements: readonly MaterialRequirement[]) {
  const remaining = { ...materials };
  for (const { id, quantity } of requirements) remaining[id] = (remaining[id] ?? 0) - quantity;
  return remaining;
}

/** Consulta somente leitura para exibir custo e motivo do bloqueio na ficha. */
export function advanceRequirement(state: CultivationState, rules: CultivationRules): AdvanceRequirement {
  assertState(state);
  if (state.rank === MAX_RANK && state.stage === 'Pico') return { kind: 'maximum', canAdvance: false };
  const stageIndex = STAGES.indexOf(state.stage);
  if (stageIndex < STAGES.length - 1) {
    const stones = rules.stageCosts[state.rank]?.[state.stage];
    if (stones === undefined) return { kind: 'unconfigured', canAdvance: false };
    assertStageCost(stones, rules, state.rank, state.stage);
    const missingStones = Math.max(0, stones - state.spiritStones);
    return { kind: 'stage', nextStage: STAGES[stageIndex + 1]!, stones,
      missingStones, canAdvance: missingStones === 0 };
  }
  const requirement = rules.rankCosts[state.rank];
  if (!requirement) return { kind: 'unconfigured', canAdvance: false };
  assertRankRequirement(requirement);
  const missingStones = Math.max(0, requirement.stones - state.spiritStones);
  const missingMaterials = requirement.materials.flatMap(({ id, quantity }) => {
    const missing = Math.max(0, quantity - (state.materials[id] ?? 0));
    return missing > 0 ? [{ id, quantity: missing }] : [];
  });
  return { kind: 'rank', stones: requirement.stones, materials: requirement.materials,
    successChance: requirement.successChance, materialLossChance: requirement.materialLossChance,
    missingStones, missingMaterials, canAdvance: missingStones === 0 && missingMaterials.length === 0 };
}

/** A chance é independente em cada tentativa: nenhum histórico de falhas é armazenado. */
export function attemptAdvance(
  state: CultivationState,
  rules: CultivationRules,
  random: () => number = Math.random,
): AdvanceResult {
  const next = advanceRequirement(state, rules);
  if (next.kind === 'maximum') return { status: 'maximum', state };
  if (next.kind === 'unconfigured') return { status: 'unconfigured', state };
  if (next.missingStones > 0) return { status: 'insufficient-stones', state };
  if (next.kind === 'stage') {
    return { status: 'advanced', state: { ...state, stage: next.nextStage,
      spiritStones: state.spiritStones - next.stones } };
  }
  if (next.missingMaterials.length > 0) return { status: 'missing-materials', state };

  const stones = state.spiritStones - next.stones;
  const roll = () => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('Sorteio inválido');
    return value;
  };
  if (roll() < next.successChance) {
    return {
      status: 'advanced',
      state: { ...state, rank: state.rank + 1, stage: 'Inicial', spiritStones: stones,
        materials: spendMaterials(state.materials, next.materials) },
    };
  }

  // Cada tipo de material exigido recebe um sorteio independente na falha.
  const lost = next.materials.filter(() => roll() < next.materialLossChance);
  const lostMaterials = Object.fromEntries(lost.map(({ id, quantity }) => [id, quantity]));
  return {
    status: 'failed', lostMaterials,
    state: { ...state, spiritStones: stones,
      materials: spendMaterials(state.materials, lost) },
  };
}
