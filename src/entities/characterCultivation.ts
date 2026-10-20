import { INITIAL_CULTIVATION } from './characterProfile';
import { CULTIVATION_RULES } from './cultivationBalance';
import { backupUnreadable } from './storageBackup';
import {
  advanceRequirement, attemptAdvance, isValidCultivationState,
  type AdvanceRequirement, type AdvanceResult, type CultivationState,
} from './cultivation';

export const CULTIVATION_STORAGE_KEY = 'fang-yuan.cultivation.v1';
export const TEST_STONE_GRANT = 1_000_000;
const SAVE_VERSION = 1;

type CultivationListener = (state: CultivationState) => void;

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
  let raw: string | null = null;
  try {
    raw = storage.getItem(CULTIVATION_STORAGE_KEY);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) {
      backupUnreadable(storage, CULTIVATION_STORAGE_KEY, raw);
      return null;
    }
    const record = saved as Record<string, unknown>;
    if (record.version !== SAVE_VERSION || !isValidCultivationState(record.state)) {
      // Versão futura ou estado inválido: preserva o original antes de o jogo
      // gravar o estado padrão por cima.
      backupUnreadable(storage, CULTIVATION_STORAGE_KEY, raw);
      return null;
    }
    const state = record.state;
    return { state: { ...state, materials: { ...state.materials } },
      testStonesGranted: record.testStonesGranted === true };
  } catch {
    backupUnreadable(storage, CULTIVATION_STORAGE_KEY, raw);
    return null;
  }
}

export type SessionAdvanceResult = AdvanceResult | { status: 'stale'; state: CultivationState };

/** Estado da campanha local: nenhum gasto entra na sessão antes de salvar com sucesso. */
export class CharacterCultivation {
  private static readonly listeners = new Set<CultivationListener>();
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
    CharacterCultivation.publish(this.current);
  }

  /** Permite que sistemas de combate reajustem atributos imediatamente após uma ruptura. */
  static subscribe(listener: CultivationListener): () => void {
    CharacterCultivation.listeners.add(listener);
    return () => CharacterCultivation.listeners.delete(listener);
  }

  private static publish(state: CultivationState): void {
    const snapshot = { ...state, materials: { ...state.materials } };
    for (const listener of CharacterCultivation.listeners) listener(snapshot);
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
      this.storage.setItem(CULTIVATION_STORAGE_KEY,
        JSON.stringify({ version: SAVE_VERSION, state: next, testStonesGranted }));
    }
    this.current = next;
    this.testStonesGranted = testStonesGranted;
    this.version++;
    CharacterCultivation.publish(this.current);
  }

  grantTestStonesOnce(): boolean {
    if (this.testStonesGranted) return false;
    const amount = Math.min(TEST_STONE_GRANT, Number.MAX_SAFE_INTEGER - this.current.spiritStones);
    if (amount <= 0) return false;
    const next = { ...this.current, spiritStones: this.current.spiritStones + amount };
    try {
      this.commit(next, true);
    } catch {
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

  /**
   * Drops podem trazer só pedras ou só material: zero é válido desde que a
   * recompensa total não seja vazia. Rejeitar zero travava a fila de
   * recompensas em retry infinito na primeira criatura sem pedras.
   */
  receiveLoot(stones: number, materialId: string, quantity: number): void {
    const validStones = Number.isSafeInteger(stones) && stones >= 0
      && Number.isSafeInteger(this.current.spiritStones + stones);
    const validMaterial = Number.isSafeInteger(quantity) && quantity >= 0
      && (quantity === 0 || /^[a-z0-9][a-z0-9._-]{0,63}$/.test(materialId))
      && Number.isSafeInteger((this.current.materials[materialId] ?? 0) + quantity);
    if (!validStones || !validMaterial || (stones === 0 && quantity === 0)) {
      throw new RangeError('Recompensa inválida');
    }
    const materials = { ...this.current.materials };
    if (quantity > 0) materials[materialId] = (materials[materialId] ?? 0) + quantity;
    this.commit({ ...this.current, spiritStones: this.current.spiritStones + stones, materials });
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
