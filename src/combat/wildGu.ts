import { GU_CATALOG, GU_IDS, isEquippable } from './guCatalog';
import type { ActiveEffect, GuDefinition, GuId } from './types';

/**
 * Gu selvagens: criaturas raras nascem com um Gu, usam-no em combate e
 * deixam exatamente esse Gu ao morrer.
 *
 * As chances são parâmetros de balanceamento iniciais, não regras canônicas.
 * São aplicadas uma única vez, no nascimento (`rollWildGu`), e nunca de novo
 * durante a luta.
 */
export const WILD_GU_CHANCES = Object.freeze({
  rank1: 0.02,
  rank2: 0.04,
  rank3: 0.06,
  boss: 0.15,
});

/** Chefes usam a chance própria; tiers normais usam a chance do Rank. */
export function wildGuChance(rank: number, isBoss: boolean): number {
  if (isBoss) return WILD_GU_CHANCES.boss;
  if (rank <= 1) return WILD_GU_CHANCES.rank1;
  if (rank === 2) return WILD_GU_CHANCES.rank2;
  return WILD_GU_CHANCES.rank3;
}

/**
 * Só entra no sorteio o Gu que a criatura consegue usar de fato: equipável e
 * com efeito ativo ou passivo de combate. Consumíveis (Flash Blink) e Gu cujo
 * único efeito é regenerar essência (Liquor Worm) ficam fora — a criatura não
 * tem reserva de essência própria, então o efeito não seria observável.
 */
export function isWildGuCandidate(gu: GuDefinition | undefined): boolean {
  if (!gu || !isEquippable(gu)) return false;
  const passive = gu.passive;
  const combatPassive = passive !== undefined && (
    passive.defense !== undefined || passive.lowHealthDefense !== undefined
    || passive.maxHealthMultiplier !== undefined || passive.movementMultiplier !== undefined);
  return gu.active !== undefined || combatPassive;
}

/**
 * Pool elegível: nunca acima do Rank da criatura. Se existir Gu do mesmo Rank,
 * ele é preferido; caso contrário usa o Rank mais alto disponível abaixo
 * (importante para Rank 3/4, ainda sem Gu próprios no catálogo).
 */
export function wildGuPool(rank: number, affinity?: readonly GuId[]): readonly GuId[] {
  const eligible = GU_IDS.filter(id => {
    const gu = GU_CATALOG[id];
    return isWildGuCandidate(gu) && gu.rank <= rank;
  });
  const sameRank = eligible.filter(id => GU_CATALOG[id].rank === rank);
  const ranked = sameRank.length > 0 ? sameRank : eligible;
  if (!affinity || affinity.length === 0) return ranked;
  const preferred = ranked.filter(id => affinity.includes(id));
  return preferred.length > 0 ? preferred : ranked;
}

/**
 * Sorteia o Gu no nascimento. `random` é injetável para testes determinísticos.
 * Retorna `null` na maioria dos casos — a raridade é parte da mecânica.
 */
export function rollWildGu(rank: number, isBoss: boolean, random: () => number = Math.random,
  affinity?: readonly GuId[]): GuId | null {
  const chance = wildGuChance(rank, isBoss);
  if (!(random() < chance)) return null;
  const pool = wildGuPool(rank, affinity);
  if (pool.length === 0) return null;
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
  return pool[index];
}

export interface WildSpawnOptions {
  /** Injeção de aleatoriedade para testes; não é usada depois do nascimento. */
  random?: () => number;
  /** `undefined` = sorteia; `null` = garante sem Gu; GuId = força o Gu. */
  forcedWildGu?: GuId | null;
}

export type WildBehaviorKind = 'projectile' | 'dash' | 'heal' | 'buff' | 'passive';

export interface WildBehavior {
  kind: WildBehaviorKind;
  cooldownMs: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Traduz o efeito já existente do Gu para uma ação de criatura. Nada é
 * inventado: o comportamento vem do `active.kind`/passivo do catálogo.
 */
export function wildBehavior(gu: GuDefinition): WildBehavior {
  const active = gu.active;
  if (active?.kind === 'projectile') {
    return { kind: 'projectile', cooldownMs: clamp(Math.round(gu.usage.cooldownMs * 1.4), 2600, 7000) };
  }
  if (active?.kind === 'dash') {
    return { kind: 'dash', cooldownMs: clamp(Math.round(gu.usage.cooldownMs * 1.4), 5000, 9000) };
  }
  if (active?.kind === 'heal') {
    return { kind: 'heal', cooldownMs: clamp(Math.round(gu.usage.cooldownMs * 1.5), 8000, 14000) };
  }
  if (active?.kind === 'buff' || active?.kind === 'empower') {
    return { kind: 'buff', cooldownMs: clamp(Math.round(gu.usage.cooldownMs * 1.5), 8000, 12000) };
  }
  return { kind: 'passive', cooldownMs: 0 };
}

/**
 * Dano de um projétil selvagem: fração da vida máxima do herói (não do dano
 * bruto do Gu), limitada para que um único golpe nunca seja letal nem trivial.
 * A identidade do Gu sobrevive no alcance/velocidade e no multiplicador.
 */
export function wildProjectileDamage(heroMaxHealth: number, guDamage: number): number {
  const ratio = clamp(guDamage / 26, 0.55, 1.25);
  return Math.max(1, Math.round(heroMaxHealth * 0.14 * ratio));
}

/** Cura relativa: 18% da vida máxima da criatura, sem ultrapassar o teto. */
export function wildHealAmount(enemyMaxHealth: number): number {
  return Math.max(1, Math.round(enemyMaxHealth * 0.18));
}

/** Buff de dano corpo a corpo: usa o multiplicador do próprio Gu, com teto. */
export function wildDamageBonus(active: ActiveEffect | undefined): number {
  if (!active) return 0;
  if (active.kind === 'buff') return clamp(active.damageMultiplier - 1, 0, 0.3);
  if (active.kind === 'empower') return clamp(active.effectMultiplier - 1, 0, 0.3);
  return 0;
}

export function wildBuffDuration(active: ActiveEffect | undefined): number {
  return active && (active.kind === 'buff' || active.kind === 'empower') ? active.durationMs : 0;
}

/**
 * Nome curto para o rótulo no mundo (o `label` completo, ex. "Moonlight Gu ·
 * Gu da Lua", não cabe acima do sprite). Vem do catálogo, não de um
 * `split('·')`: o label é texto de exibição e pode variar sem quebrar a UI.
 */
export function wildGuShortLabel(gu: GuDefinition): string {
  return gu.short;
}

/** Alcance efetivo do projétil selvagem (um pouco menor que o do jogador). */
export function wildProjectileRange(gu: GuDefinition): number {
  const active = gu.active;
  if (!active || active.kind !== 'projectile') return 0;
  return Math.round(active.range * 0.85);
}

export function wildProjectileSpeed(gu: GuDefinition): number {
  const active = gu.active;
  if (!active || active.kind !== 'projectile') return 0;
  return clamp(Math.round(active.speed * 0.8), 150, 360);
}
