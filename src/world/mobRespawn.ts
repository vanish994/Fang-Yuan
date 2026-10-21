/**
 * Respawn por tempo das criaturas do mundo.
 *
 * Cada criatura morta volta entre 60 e 90 segundos depois. O atraso é
 * determinístico a partir da chave do spawn (área + id): a mesma criatura volta
 * sempre no mesmo intervalo, e criaturas diferentes não voltam todas juntas.
 * Nada aqui depende do Phaser — a cena só informa o instante atual.
 */
export const RESPAWN_MIN_MS = 60_000;
export const RESPAWN_MAX_MS = 90_000;
/**
 * Chefes demoram muito mais para voltar. Sem isso, o maior pagamento do jogo
 * (centenas de pedras + material de Rank alto) viraria farm de 90 s.
 */
export const BOSS_RESPAWN_MIN_MS = 300_000;
export const BOSS_RESPAWN_MAX_MS = 360_000;
/** Reavaliação quando a área/posição não permite o nascimento agora. */
export const RESPAWN_RETRY_MS = 5_000;
/** Distância mínima do jogador (px) para a criatura nascer. */
export const RESPAWN_MIN_PLAYER_DISTANCE = 96;

/** Intervalo da criatura, estável por chave: 60–90 s (comum) ou 5–6 min (chefe). */
export function respawnDelay(key: string, boss = false): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const min = boss ? BOSS_RESPAWN_MIN_MS : RESPAWN_MIN_MS;
  const max = boss ? BOSS_RESPAWN_MAX_MS : RESPAWN_MAX_MS;
  return min + ((hash >>> 0) % (max - min + 1));
}

/**
 * Fila de criaturas aguardando renascer. Uma chave agendada duas vezes não
 * duplica a entrada, e uma criatura só é removida quando nasce de fato.
 */
export class RespawnQueue {
  private readonly pending = new Map<string, number>();

  /** Agenda a criatura; devolve o instante previsto. */
  schedule(key: string, now: number, delayMs = respawnDelay(key)): number {
    const existing = this.pending.get(key);
    if (existing !== undefined) return existing;
    const dueAt = now + delayMs;
    this.pending.set(key, dueAt);
    return dueAt;
  }

  /** Chaves vencidas, da mais antiga para a mais nova (não remove). */
  due(now: number): string[] {
    return [...this.pending.entries()].filter(([, dueAt]) => dueAt <= now)
      .sort((a, b) => a[1] - b[1]).map(([key]) => key);
  }

  /** A criatura nasceu: sai da fila. */
  settle(key: string): void { this.pending.delete(key); }

  /** Não dá para nascer agora (área errada, tile ocupado, jogador perto). */
  postpone(key: string, now: number, extraMs = RESPAWN_RETRY_MS): void {
    if (!this.pending.has(key)) return;
    this.pending.set(key, now + extraMs);
  }

  cancel(key: string): void { this.pending.delete(key); }

  dueAt(key: string): number | undefined { return this.pending.get(key); }

  get size(): number { return this.pending.size; }

  get keys(): readonly string[] { return [...this.pending.keys()]; }

  clear(): void { this.pending.clear(); }
}
