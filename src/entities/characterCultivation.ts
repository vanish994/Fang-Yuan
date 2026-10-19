import { INITIAL_CULTIVATION } from './characterProfile';
import { CULTIVATION_RULES } from './cultivationBalance';
import {
  advanceRequirement, attemptAdvance, isValidCultivationState,
  type AdvanceRequirement, type AdvanceResult, type CultivationState,
} from './cultivation';

export const CULTIVATION_STORAGE_KEY = 'fang-yuan.cultivation.v1';
const SAVE_VERSION = 1;

/** Adaptador mínimo: no navegador usa localStorage; testes usam memória. */
export interface CultivationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): CultivationStorage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function load(storage: CultivationStorage | null): CultivationState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CULTIVATION_STORAGE_KEY);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return null;
    const record = saved as Record<string, unknown>;
    if (record.version !== SAVE_VERSION || !isValidCultivationState(record.state)) return null;
    const state = record.state;
    return { ...state, materials: { ...state.materials } };
  } catch { return null; }
}

export type SessionAdvanceResult = AdvanceResult | { status: 'stale'; state: CultivationState };

/** Estado da campanha local: nenhum gasto entra na sessão antes de salvar com sucesso. */
export class CharacterCultivation {
  private current: CultivationState;
  private version = 0;
  private inFlight = false;
  private readonly storage: CultivationStorage | null;

  constructor(storage: CultivationStorage | null = browserStorage()) {
    this.storage = storage;
    this.current = load(storage) ?? { ...INITIAL_CULTIVATION, materials: {} };
  }

  get state(): CultivationState {
    return { ...this.current, materials: { ...this.current.materials } };
  }

  get revision(): number { return this.version; }
  get persistent(): boolean { return this.storage !== null; }

  get requirement(): AdvanceRequirement {
    return advanceRequirement(this.current, CULTIVATION_RULES);
  }

  private commit(next: CultivationState): void {
    if (this.storage) {
      // Grava antes de publicar o novo estado: falha de armazenamento não gasta recursos.
      this.storage.setItem(CULTIVATION_STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, state: next }));
    }
    this.current = next;
    this.version++;
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
