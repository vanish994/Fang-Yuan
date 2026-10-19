import { INITIAL_CULTIVATION } from './characterProfile';
import { CULTIVATION_RULES } from './cultivationBalance';
import {
  advanceRequirement, attemptAdvance, isValidCultivationState,
  type AdvanceRequirement, type AdvanceResult, type CultivationState,
} from './cultivation';

export const CULTIVATION_STORAGE_KEY = 'fang-yuan.cultivation.v1';
/** Crédito somente do protótipo para experimentar os custos; não faz parte da história. */
export const TEST_STONE_GRANT = 1_000_000;
const SAVE_VERSION = 1;

/** Adaptador mínimo: no navegador usa localStorage; testes usam memória. */
export interface CultivationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): CultivationStorage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

interface StoredCultivation {
  state: CultivationState;
  testStonesGranted: boolean;
}

function load(storage: CultivationStorage | null): StoredCultivation | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CULTIVATION_STORAGE_KEY);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return null;
    const record = saved as Record<string, unknown>;
    if (record.version !== SAVE_VERSION || !isValidCultivationState(record.state)) return null;
    const state = record.state;
    // Saves anteriores não trazem a marca; recebem o bônus só na próxima abertura do jogo.
    return { state: { ...state, materials: { ...state.materials } },
      testStonesGranted: record.testStonesGranted === true };
  } catch { return null; }
}

export type SessionAdvanceResult = AdvanceResult | { status: 'stale'; state: CultivationState };

/** Estado da campanha local: nenhum gasto entra na sessão antes de salvar com sucesso. */
export class CharacterCultivation {
  private current: CultivationState;
  private version = 0;
  private inFlight = false;
  private storage: CultivationStorage | null;
  private testStonesGranted = false;

  constructor(storage: CultivationStorage | null = browserStorage()) {
    this.storage = storage;
    const saved = load(storage);
    this.current = saved?.state ?? { ...INITIAL_CULTIVATION, materials: {} };
    this.testStonesGranted = saved?.testStonesGranted ?? false;
  }

  get state(): CultivationState {
    return { ...this.current, materials: { ...this.current.materials } };
  }

  get revision(): number { return this.version; }
  get persistent(): boolean { return this.storage !== null; }
  get hasTestStones(): boolean { return this.testStonesGranted; }

  get requirement(): AdvanceRequirement {
    return advanceRequirement(this.current, CULTIVATION_RULES);
  }

  private commit(next: CultivationState, testStonesGranted = this.testStonesGranted): void {
    if (this.storage) {
      // Grava saldo e marca do bônus juntos: falha não duplica nem publica créditos parciais.
      this.storage.setItem(CULTIVATION_STORAGE_KEY,
        JSON.stringify({ version: SAVE_VERSION, state: next, testStonesGranted }));
    }
    this.current = next;
    this.testStonesGranted = testStonesGranted;
    this.version++;
  }

  /** Concedido na entrada do jogo, inclusive sobre um save antigo, apenas uma vez por save. */
  grantTestStonesOnce(): boolean {
    if (this.testStonesGranted) return false;
    const amount = Math.min(TEST_STONE_GRANT, Number.MAX_SAFE_INTEGER - this.current.spiritStones);
    if (amount <= 0) return false;
    const next = { ...this.current, spiritStones: this.current.spiritStones + amount };
    try {
      this.commit(next, true);
    } catch {
      // Sem localStorage gravável, permite testar na sessão sem fingir persistência.
      this.storage = null;
      this.commit(next, true);
    }
    return true;
  }

  receiveStones(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount <= 0
      || !Number.isSafeInteger(this.current.spiritStones + amount)) {
      throw new RangeError('Quantidade de pedras inválida');
    }
    this.commit({ ...this.current, spiritStones: this.current.spiritStones + amount });
  }

  /** Um único commit persistido para pedras + material do mesmo inimigo derrotado. */
  receiveLoot(stones: number, materialId: string, quantity: number): void {
    if (!Number.isSafeInteger(stones) || stones <= 0
      || !Number.isSafeInteger(this.current.spiritStones + stones)
      || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(materialId)
      || !Number.isSafeInteger(quantity) || quantity <= 0
      || !Number.isSafeInteger((this.current.materials[materialId] ?? 0) + quantity)) {
      throw new RangeError('Recompensa inválida');
    }
    this.commit({ ...this.current, spiritStones: this.current.spiritStones + stones,
      materials: { ...this.current.materials,
        [materialId]: (this.current.materials[materialId] ?? 0) + quantity } });
  }

  receiveMaterial(id: string, amount: number): void {
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id)
      || !Number.isSafeInteger(amount) || amount <= 0
      || !Number.isSafeInteger((this.current.materials[id] ?? 0) + amount)) {
      throw new RangeError('Quantidade de material inválida');
    }
    this.commit({ ...this.current, materials: {
      ...this.current.materials, [id]: (this.current.materials[id] ?? 0) + amount,
    } });
  }

  /** A revisão vincula a confirmação aos requisitos exibidos; repetição fica obsoleta. */
  advance(expectedRevision: number = this.version, random?: () => number): SessionAdvanceResult {
    if (this.inFlight || expectedRevision !== this.version) return { status: 'stale', state: this.state };
    this.inFlight = true;
    try {
      const result = attemptAdvance(this.current, CULTIVATION_RULES, random);
      if (result.status === 'advanced' || result.status === 'failed') this.commit(result.state);
      return { ...result, state: this.state };
    } finally {
      this.inFlight = false;
    }
  }
}
