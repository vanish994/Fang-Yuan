import { GU_CATALOG } from './guCatalog';
import { breakthroughMaterialLabel } from '../entities/cultivationBalance';
import type { CombatEvent, GuId } from './types';

/**
 * Fluxo de recompensa, extraído do cenário Phaser para poder ser testado.
 *
 * Regras:
 * - o Gu entregue é sempre o registrado na criatura (`guReward`), nunca sorteado aqui;
 * - pedras/material e Gu são entregues separadamente;
 * - processar o mesmo evento duas vezes não duplica nada (o motor deduplica);
 * - falha de gravação mantém a recompensa na fila, com backoff exponencial;
 * - depois de `MAX_REWARD_ATTEMPTS` falhas, a persistência é desligada e a sessão
 *   continua em memória — em vez de repetir a mesma tentativa para sempre.
 */

export interface RewardEngine {
  claimWildGu(enemyId: string): {
    ok: boolean; guId?: GuId; reason?: string; alreadyClaimed?: boolean; retryable?: boolean;
  };
  disablePersistence(): void;
}

export interface RewardSink {
  receiveLoot(stones: number, materialId: string, quantity: number): void;
  disablePersistence(): void;
}

export type RewardMessage =
  /** Recompensa entregue; `text` é a mensagem pronta para o HUD. */
  | { kind: 'loot'; text: string }
  /** O Gu não entrou (ex.: inventário cheio), mas os outros drops foram entregues. */
  | { kind: 'gu-unclaimed'; text: string }
  /** Gravação falhou; a fila tenta de novo em `delayMs`. */
  | { kind: 'retry'; delayMs: number; attempts: number; notify: boolean; text: string }
  /** Persistência desligada: a sessão segue em memória até o fim. */
  | { kind: 'degraded'; text: string }
  /** Nem em memória foi possível entregar; a fila foi pausada. */
  | { kind: 'stalled'; text: string };

export const MAX_REWARD_ATTEMPTS = 5;
export const BASE_RETRY_DELAY_MS = 2_000;
export const MAX_RETRY_DELAY_MS = 30_000;

/** Backoff exponencial com teto: 2 s, 4 s, 8 s, 16 s, 30 s, 30 s… */
export function retryDelay(attempt: number): number {
  const safe = Math.max(1, Math.floor(attempt));
  return Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** (safe - 1));
}

function lootText(reward: CombatEvent, guId?: GuId): string {
  const parts: string[] = [];
  if (reward.stoneReward) parts.push(`+${reward.stoneReward} pedras espirituais`);
  if (reward.materialQuantity && reward.materialId) {
    parts.push(`+${reward.materialQuantity} ${breakthroughMaterialLabel(reward.materialId)}`);
  }
  if (guId) parts.push(`+1 ${GU_CATALOG[guId].label}`);
  return parts.join(' · ') || 'Recompensa recebida.';
}

export class RewardQueue {
  private readonly pending: CombatEvent[] = [];
  private attempts = 0;
  private degraded = false;
  /** Instante a partir do qual a UI pode tentar de novo. */
  private retryAt = 0;

  enqueue(event: CombatEvent): void {
    if (event.type === 'reward') this.pending.push(event);
  }

  get size(): number { return this.pending.length; }
  get isDegraded(): boolean { return this.degraded; }
  get failures(): number { return this.attempts; }
  get nextRetryAt(): number { return this.retryAt; }

  /** Descarta a fila e o histórico; usado apenas no encerramento da cena. */
  clear(): void {
    this.pending.length = 0;
    this.attempts = 0;
    this.retryAt = 0;
  }

  private fail(now: number, reason: string):
    { messages: RewardMessage[]; stop: boolean; degrade: boolean } {
    // Depois de degradar não há mais gravação: uma falha aqui é definitiva e
    // não deve reiniciar o ciclo de tentativas (isso seria laço infinito).
    if (this.degraded) {
      this.retryAt = now + MAX_RETRY_DELAY_MS;
      return {
        messages: [{ kind: 'stalled', text: 'A recompensa não pôde ser entregue agora e continua na fila.' }],
        stop: true,
        degrade: false,
      };
    }
    this.attempts += 1;
    if (this.attempts < MAX_REWARD_ATTEMPTS) {
      const delay = retryDelay(this.attempts);
      this.retryAt = now + delay;
      return {
        messages: [{
          kind: 'retry', delayMs: delay, attempts: this.attempts,
          // Só a primeira e a penúltima tentativa merecem barulho no HUD.
          notify: this.attempts === 1 || this.attempts === MAX_REWARD_ATTEMPTS - 1,
          text: this.attempts === 1
            ? `${reason} Nova tentativa em ${Math.round(delay / 1000)} s.`
            : `${reason} Última tentativa automática em ${Math.round(delay / 1000)} s.`,
        }],
        stop: true,
        degrade: false,
      };
    }
    this.attempts = 0;
    this.retryAt = now;
    return {
      messages: [{
        kind: 'degraded',
        text: 'Armazenamento indisponível: o progresso desta sessão não será salvo. Recompensas seguem em memória.',
      }],
      stop: false,
      degrade: true,
    };
  }

  /**
   * Processa a fila até esvaziar, falhar de forma definitiva ou chegar em
   * `MAX_REWARD_ATTEMPTS`. Retorna mensagens prontas para o HUD.
   */
  drain(engine: RewardEngine, sink: RewardSink, now: number): RewardMessage[] {
    const messages: RewardMessage[] = [];
    while (this.pending.length > 0) {
      const reward = this.pending[0]!;
      let guId: GuId | undefined;

      if (reward.guReward && reward.targetId) {
        const claim = engine.claimWildGu(reward.targetId);
        if (!claim.ok && claim.retryable) {
          const outcome = this.fail(now, 'Não foi possível salvar o Gu.');
          messages.push(...outcome.messages);
          if (outcome.degrade) this.degrade(engine, sink);
          if (outcome.stop) return messages;
          continue;
        }
        if (!claim.ok) {
          messages.push({
            kind: 'gu-unclaimed',
            text: `Gu não coletado: ${claim.reason ?? 'indisponível.'} Os outros drops foram entregues.`,
          });
        }
        if (claim.ok && claim.guId && !claim.alreadyClaimed) guId = claim.guId;
      }

      try {
        sink.receiveLoot(reward.stoneReward ?? 0, reward.materialId ?? '', reward.materialQuantity ?? 0);
      } catch {
        const outcome = this.fail(now, 'Não foi possível salvar o drop.');
        messages.push(...outcome.messages);
        if (outcome.degrade) this.degrade(engine, sink);
        if (outcome.stop) return messages;
        continue;
      }

      this.pending.shift();
      this.attempts = 0;
      this.retryAt = 0;
      messages.push({ kind: 'loot', text: lootText(reward, guId) });
    }
    return messages;
  }

  /**
   * Desliga a persistência nos dois lados. Chamado quando a fila degrada:
   * a sessão continua jogável e as recompensas não se perdem.
   */
  degrade(engine: RewardEngine, sink: RewardSink): void {
    engine.disablePersistence();
    sink.disablePersistence();
    this.degraded = true;
  }
}
