import type { GuId } from './types';

/**
 * Registro dos Gu selvagens deixados pelas criaturas mortas.
 *
 * Vive fora do `CombatEngine` porque é um log puro: garante que o Gu exato da
 * criatura seja entregue **uma vez**, que a entrega seja idempotente (processar
 * a mesma morte duas vezes não duplica) e que uma falha de gravação possa ser
 * repetida sem perder o drop.
 */
export class WildGuDropLog {
  private readonly drops = new Map<string, GuId>();
  private readonly delivered = new Set<string>();

  /** Registra o Gu da criatura. Não sobrescreve um drop ainda não coletado. */
  register(enemyId: string, guId: GuId): void {
    if (this.drops.has(enemyId)) return;
    this.drops.set(enemyId, guId);
  }

  /** Gu exato que a criatura deixou e o jogador ainda não recebeu. */
  pending(enemyId: string): GuId | null { return this.drops.get(enemyId) ?? null; }

  /** `true` quando este Gu já entrou no inventário. */
  wasDelivered(enemyId: string): boolean { return this.delivered.has(enemyId); }

  /** Marca a entrega bem-sucedida e libera o drop pendente. */
  markDelivered(enemyId: string): void {
    this.drops.delete(enemyId);
    this.delivered.add(enemyId);
  }

  /** Quantos Gu continuam no chão (usado pelo HUD/testes). */
  get pendingCount(): number { return this.drops.size; }

  /** Drops pendentes por criatura; cópia para leitura. */
  entries(): readonly [string, GuId][] { return [...this.drops.entries()]; }
}
