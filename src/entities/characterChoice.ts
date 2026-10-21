import { DEFAULT_PLAYER_CHARACTER, isPlayerCharacterId, type PlayerCharacterId }
  from '../combat/characterCatalog';

/**
 * Personagem jogável escolhido. Guardado à parte do estado de Gu e de cultivo: trocar
 * de personagem não mexe em inventário, pedras, estágios nem na Gu assimilada.
 *
 * A leitura sanitiza o valor — save antigo, vazio ou adulterado cai no Fang Yuan,
 * então a seleção nunca quebra o jogo nem perde progresso.
 */
export const CHARACTER_STORAGE_KEY = 'fang-yuan.character.v1';
export const CHARACTER_STORAGE_VERSION = 1;

export interface CharacterStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): CharacterStorage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Qualquer entrada vira um personagem válido; desconhecido = padrão. */
export function normalizeCharacterChoice(value: unknown): PlayerCharacterId {
  if (isPlayerCharacterId(value)) return value;
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    // `choice` é o campo gravado; `character` é aceito por tolerância a saves manuais.
    if (isPlayerCharacterId(record.choice)) return record.choice;
    if (isPlayerCharacterId(record.character)) return record.character;
  }
  return DEFAULT_PLAYER_CHARACTER;
}

export function loadCharacterChoice(storage: CharacterStorage | null = browserStorage()): PlayerCharacterId {
  if (!storage) return DEFAULT_PLAYER_CHARACTER;
  try {
    const raw = storage.getItem(CHARACTER_STORAGE_KEY);
    if (!raw) return DEFAULT_PLAYER_CHARACTER;
    return normalizeCharacterChoice(JSON.parse(raw));
  } catch {
    return DEFAULT_PLAYER_CHARACTER;
  }
}

/** Grava a escolha; falha de armazenamento não impede a troca nesta sessão. */
export function saveCharacterChoice(id: PlayerCharacterId,
  storage: CharacterStorage | null = browserStorage()): boolean {
  if (!isPlayerCharacterId(id) || !storage) return false;
  try {
    storage.setItem(CHARACTER_STORAGE_KEY,
      JSON.stringify({ version: CHARACTER_STORAGE_VERSION, choice: id }));
    return true;
  } catch {
    return false;
  }
}
