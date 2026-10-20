import { GU_CATALOG, GU_IDS, STARTING_INVENTORY, isAssimilable, isEquippable, isGuId }
  from './guCatalog';
import { GU_SLOTS, type GuId, type GuSlot } from './types';
import { STARTING_EQUIPMENT } from './combatConfig';
import { backupUnreadable } from '../entities/storageBackup';

export const GU_STATE_STORAGE_KEY = 'fang-yuan.gu.v1';
export const GU_STATE_VERSION = 1;
export const MAX_GU_STACK = 99;

export interface GuSnapshot {
  inventory: Record<GuId, number>;
  equipment: Record<GuSlot, GuId | null>;
  assimilated: readonly GuId[];
}

export interface GuStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): GuStorage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function emptyInventory(): Record<GuId, number> {
  return Object.fromEntries(GU_IDS.map(id => [id, 0])) as Record<GuId, number>;
}

export function defaultGuSnapshot(): GuSnapshot {
  const inventory = emptyInventory();
  for (const [id, quantity] of Object.entries(STARTING_INVENTORY)) {
    if (isGuId(id) && typeof quantity === 'number') inventory[id] = Math.min(MAX_GU_STACK, quantity);
  }
  return { inventory, equipment: { ...STARTING_EQUIPMENT }, assimilated: [] };
}

function readCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? Math.min(MAX_GU_STACK, value) : 0;
}

/**
 * Sanitização total na leitura: IDs desconhecidos são descartados, quantidades
 * negativas/fraccionárias viram 0, equipamentos inválidos são desfeitos e o
 * mesmo Gu nunca ocupa dois slots. Isso também torna a migração idempotente.
 */
export function normalizeGuSnapshot(input: unknown): GuSnapshot {
  const fallback = defaultGuSnapshot();
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return fallback;
  const record = input as Record<string, unknown>;

  const inventory = emptyInventory();
  // v1 grava um objeto `inventory`. Saves anteriores ao inventário persistente
  // (formato v0) traziam só equipamento e/ou uma lista `testInventory`; nesse
  // caso preservamos exatamente o que o save comprovava possuir — nunca o
  // catálogo inteiro — e a migração é idempotente porque o resultado já sai
  // no formato v1.
  if (typeof record.inventory === 'object' && record.inventory !== null
    && !Array.isArray(record.inventory)) {
    const rawInventory = record.inventory as Record<string, unknown>;
    for (const id of GU_IDS) inventory[id] = readCount(rawInventory[id]);
  } else if (Array.isArray(record.testInventory)) {
    for (const id of record.testInventory) if (isGuId(id)) inventory[id] = 1;
  } else if (typeof record.equipment === 'object' && record.equipment !== null
    && !Array.isArray(record.equipment)) {
    for (const id of Object.values(record.equipment as Record<string, unknown>)) {
      if (isGuId(id)) inventory[id] = 1;
    }
  }

  const equipment: Record<GuSlot, GuId | null> = { attack: null, passive: null, movement: null, support: null };
  const rawEquipment = typeof record.equipment === 'object' && record.equipment !== null
    && !Array.isArray(record.equipment) ? record.equipment as Record<string, unknown> : {};
  const used = new Set<GuId>();
  for (const slot of GU_SLOTS) {
    const candidate = rawEquipment[slot];
    if (!isGuId(candidate) || used.has(candidate)) continue;
    const gu = GU_CATALOG[candidate];
    if (gu.slot !== slot || !isEquippable(gu) || inventory[candidate] <= 0) continue;
    equipment[slot] = candidate;
    used.add(candidate);
  }

  const assimilated: GuId[] = [];
  const rawAssimilated = Array.isArray(record.assimilated) ? record.assimilated : [];
  for (const candidate of rawAssimilated) {
    if (!isGuId(candidate) || assimilated.includes(candidate)) continue;
    if (!isAssimilable(GU_CATALOG[candidate])) continue;
    assimilated.push(candidate);
    // A assimilação consome o Gu; um save que contenha os dois não pode
    // conceder o benefício e manter o item para venda/segunda assimilação.
    inventory[candidate] = 0;
  }

  return { inventory, equipment, assimilated };
}

export class GuStateStore {
  constructor(private storage: GuStorage | null = browserStorage()) {}

  get persistent(): boolean { return this.storage !== null; }

  load(): GuSnapshot | null {
    if (!this.storage) return null;
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(GU_STATE_STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        backupUnreadable(this.storage, GU_STATE_STORAGE_KEY, raw);
        return null;
      }
      const record = parsed as Record<string, unknown>;
      // Save sem versão é o formato v0 (anterior ao inventário persistente) e é
      // migrado; versões futuras são ignoradas em vez de reinterpretadas, com o
      // conteúdo original preservado em backup antes de qualquer sobrescrita.
      if (record.version !== undefined && record.version !== GU_STATE_VERSION) {
        backupUnreadable(this.storage, GU_STATE_STORAGE_KEY, raw);
        return null;
      }
      return normalizeGuSnapshot(record);
    } catch {
      backupUnreadable(this.storage, GU_STATE_STORAGE_KEY, raw);
      return null;
    }
  }

  /** Grava antes de o motor publicar o novo estado; falha não deixa estado parcial. */
  save(snapshot: GuSnapshot): void {
    if (!this.storage) return;
    const normalized = normalizeGuSnapshot(snapshot);
    this.storage.setItem(GU_STATE_STORAGE_KEY, JSON.stringify({
      version: GU_STATE_VERSION,
      inventory: normalized.inventory,
      equipment: normalized.equipment,
      assimilated: normalized.assimilated,
    }));
  }
}
