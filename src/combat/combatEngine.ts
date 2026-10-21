import { COMBAT_CONFIG, STARTING_EQUIPMENT, type CombatSettings } from './combatConfig';
import { GU_CATALOG, GU_IDS, isAssimilable, isEquippable, isUsable } from './guCatalog';
import { GU_RECIPES, recipeById } from './guRecipes';
import { GuStateStore, MAX_GU_STACK, defaultGuSnapshot, emptyInventory,
  type GuSnapshot } from './guState';
import { GU_SLOTS, type ActionResult, type CombatEvent, type Direction, type Enemy,
  type EnemyProjectile, type GuId, type GuSlot, type GuUsage, type Point } from './types';
import { AgentBrain } from '../agents/agentBrain';
import type { MobDefinition } from './mobCatalog';
import type { CultivationState } from '../entities/cultivation';
import { CharacterCultivation } from '../entities/characterCultivation';
import { cultivationCombatStats, primordialEssenceQualityMultiplier,
  type CultivationCombatStats } from '../entities/cultivationCombat';
import { mitigatedDamage } from './damageFormula';
import { isWildGuCandidate, rollWildGu, type WildSpawnOptions } from './wildGu';
import { stepEnemyProjectiles, useWildGu, wildMeleeMultiplier } from './enemyAbilities';
import { meleeLineBlocked } from './autoBasic';
import { cardinalStep } from './enemyMovement';
import { distance, vectors } from './geometry';
import { WildGuDropLog } from './wildGuDrops';
import { PLAYER_CHARACTERS, playerCharacter, type PlayerCharacterId,
  type PlayerCharacterProfile } from './characterCatalog';
const deny = (reason: string): ActionResult => ({ ok: false, reason, events: [] });
/** Cor do Gu em inteiro (a arte do efeito não guarda cor: o tint vem daqui). */
const colorOf = (id: GuId): number => {
  const parsed = Number.parseInt(GU_CATALOG[id].visual.color.replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : 0xffffff;
};
const positive = (value: number) => Number.isFinite(value) && value > 0;

/** Aparência do projétil do jogador: lâmina de Gu (Fang Yuan) ou estilhaço (Bai Ning Bing). */
export type ProjectileStyle = 'blade' | 'ice';

interface Projectile {
  /** `null` no ataque básico à distância, que não pertence a nenhum Gu. */
  guId: GuId | null;
  style: ProjectileStyle;
  /** Cor já resolvida: do catálogo do Gu ou do personagem. Nunca vem da arte. */
  tint: number;
  x: number; y: number; direction: Direction; traveled: number; hit: Set<string>;
  damage: number; range: number; width: number; speed: number; pierce: boolean;
  splashRadius: number; splashDone: boolean;
}

export interface WildGuClaim {
  ok: boolean;
  guId?: GuId;
  reason?: string;
  /** O Gu já havia sido entregue; repetir o processamento não duplica nada. */
  alreadyClaimed?: boolean;
  /** Falha de gravação: vale tentar de novo; inventário cheio não vale. */
  retryable?: boolean;
}

type TimedKey = 'damage' | 'speed' | 'defense';
interface TimedEffect {
  key: TimedKey; value: number; expiresAt: number; source: GuId; label: string;
}
export interface ActiveEffectView {
  kind: TimedKey; label: string; source: GuId; value: number; remainingMs: number;
}
interface Barrier { amount: number; expiresAt: number; source: GuId; label: string }

export interface CombatStats {
  base: { maxHealth: number; attack: number; defense: number; maxEssence: number; essenceRegen: number };
  equipped: { defense: number; maxHealth: number; essenceRegen: number; movementMultiplier: number };
  temporary: { damageBonus: number; movementBonus: number; defenseBonus: number; barrier: number };
  permanent: { physicalDamageBonus: number; meleeDamageBonus: number; maxHealthBonus: number };
  total: { maxHealth: number; attack: number; defense: number; maxEssence: number;
    essenceRegen: number; movementMultiplier: number };
}

export class CombatEngine {
  readonly enemies = new Map<string, Enemy>();
  readonly equipment: Record<GuSlot, GuId | null> = { ...STARTING_EQUIPMENT };
  /** Preservado para a UI/testes legados; derivado do inventário (quantidade > 0). */
  readonly testInventory = new Set<GuId>();
  readonly assimilated = new Set<GuId>();
  inventory: Record<GuId, number> = emptyInventory();
  /** Personagem jogável atual: muda arte, vida, defesa, passo e básico — não as regras de Gu. */
  private profile: PlayerCharacterProfile;
  readonly hero: Point & { health: number; maxHealth: number; alive: boolean };
  essence: number;
  selectedId: string | null = null;
  autoTarget = false;
  combatUntil = 0;
  /** Compatibilidade com a UI antiga: fim do bônus do Gu de movimento. */
  speedBonusUntil = 0;
  private dashSpeedMultiplier = 1;
  private lastNow = 0;
  private cultivationStats: CultivationCombatStats;
  private cultivationState: CultivationState;
  private readonly unsubscribeCultivation: () => void;
  private readonly cooldowns = new Map<string, number>();
  private readonly projectiles: Projectile[] = [];
  private readonly enemyProjectiles: EnemyProjectile[] = [];
  /** Gu registrado na criatura no nascimento, aguardando coleta. */
  private readonly wildDrops = new WildGuDropLog();
  private readonly processedHits = new Set<string>();
  private readonly recentHits: string[] = [];
  private readonly processedRewards = new Set<string>();
  private readonly agentBrains = new Map<string, AgentBrain>();
  private readonly enemyHomes = new Map<string, Point>();
  /** Eixo em que cada criatura está andando: dá o trajeto em L, sem escada. */
  private readonly chaseAxes = new Map<string, 'x' | 'y'>();
  private readonly enemyStats = new Map<string, CombatSettings['enemy']>();
  private readonly roaming = new Set<string>();
  private readonly effects = new Map<TimedKey, TimedEffect>();
  private barrier: Barrier | null = null;
  private empowerUntil = 0;
  private empowerEffectMultiplier = 1.5;
  private empowerCostMultiplier = 1.5;

  /** Fonte de aleatoriedade do motor: decisões da IA, esquiva/revive e sorteios. */
  private readonly random: () => number;
  /** Só existe quando o chamador injetou um RNG; sem ele, o nascimento é determinístico. */
  private readonly injectedRandom: (() => number) | null;

  constructor(readonly config: CombatSettings = COMBAT_CONFIG, x = 0, y = 0,
    cultivation?: CultivationState, private readonly store: GuStateStore | null = new GuStateStore(),
    random?: () => number, character: PlayerCharacterId = 'fang-yuan') {
    this.profile = playerCharacter(character);
    // Injetar um RNG torna a simulação inteira reprodutível (testes, replay,
    // depuração). Sem injeção, o motor usa Math.random como sempre.
    this.injectedRandom = random ?? null;
    this.random = random ?? Math.random;
    this.cultivationState = cultivation ?? { rank: 1, stage: 'Inicial', spiritStones: 0, materials: {} };
    this.cultivationStats = cultivationCombatStats(this.cultivationState);
    const saved = this.store?.load() ?? null;
    // Fonte única do inventário inicial: `defaultGuSnapshot` (guState).
    this.adoptSnapshot(saved ?? defaultGuSnapshot());
    const maxHealth = this.maxHealthFor(this.assimilated, this.equipment.passive);
    this.hero = { x, y, health: maxHealth, maxHealth, alive: true };
    this.essence = this.cultivationStats.maxEssence;
    this.unsubscribeCultivation = CharacterCultivation.subscribe(state => this.applyCultivation(state));
  }

  // ── Estado persistente ────────────────────────────────────────────────────
  private adoptSnapshot(snapshot: GuSnapshot): void {
    this.inventory = { ...snapshot.inventory };
    this.equipment.attack = snapshot.equipment.attack;
    this.equipment.passive = snapshot.equipment.passive;
    this.equipment.movement = snapshot.equipment.movement;
    this.equipment.support = snapshot.equipment.support;
    this.assimilated.clear();
    for (const id of snapshot.assimilated) this.assimilated.add(id);
    this.syncInventorySet();
  }

  private snapshot(): GuSnapshot {
    return { inventory: { ...this.inventory }, equipment: { ...this.equipment },
      assimilated: [...this.assimilated] };
  }

  private syncInventorySet(): void {
    this.testInventory.clear();
    for (const id of GU_IDS) if (this.inventory[id] > 0) this.testInventory.add(id);
  }

  private commit(next: GuSnapshot): boolean {
    try {
      this.store?.save(next);
    } catch { return false; }
    this.adoptSnapshot(next);
    return true;
  }

  /** `false` quando a sessão roda só em memória (sem localStorage ou degradada). */
  get persistent(): boolean { return this.store?.persistent ?? false; }

  /** Para de gravar e segue em memória; usado pelo fluxo de recompensa degradado. */
  disablePersistence(): void { this.store?.disablePersistence(); }

  private owned(id: GuId): number { return this.inventory[id] ?? 0; }
  inventoryCount(id: GuId): number { return this.owned(id); }
  assimilatedList(): readonly GuId[] { return [...this.assimilated]; }
  isEquipped(id: GuId): boolean { return GU_SLOTS.some(slot => this.equipment[slot] === id); }

  // ── Cultivo e atributos ───────────────────────────────────────────────────
  applyCultivation(state: CultivationState): void {
    const previousRatio = this.hero.maxHealth > 0 ? this.hero.health / this.hero.maxHealth : 1;
    this.cultivationState = state;
    this.cultivationStats = cultivationCombatStats(state);
    this.refreshMaxHealth(false);
    this.hero.health = this.hero.alive
      ? Math.max(1, Math.min(this.hero.maxHealth, Math.round(this.hero.maxHealth * previousRatio)))
      : 0;
    this.essence = Math.min(this.cultivationStats.maxEssence, this.essence);
  }

  private passive() {
    const id = this.equipment.passive;
    return id ? GU_CATALOG[id].passive : undefined;
  }

  private maxHealthFor(assimilated: ReadonlySet<GuId>, passiveId: GuId | null): number {
    let bonus = 0;
    for (const id of assimilated) bonus += GU_CATALOG[id].assimilation?.maxHealthBonus ?? 0;
    const passive = passiveId ? GU_CATALOG[passiveId].passive : undefined;
    const multiplier = passive?.maxHealthMultiplier ?? 1;
    const base = Math.max(1, Math.round((this.cultivationStats.maxHealth + bonus) * multiplier)
      + (passive?.maxHealthBonus ?? 0));
    return Math.max(1, Math.round(base * this.profile.combat.maxHealthMultiplier));
  }

  private refreshMaxHealth(keepRatio = true): void {
    const ratio = this.hero.maxHealth > 0 ? this.hero.health / this.hero.maxHealth : 1;
    this.hero.maxHealth = this.maxHealthFor(this.assimilated, this.equipment.passive);
    this.hero.health = this.hero.alive
      ? Math.max(1, Math.min(this.hero.maxHealth, Math.round(this.hero.maxHealth * (keepRatio ? ratio : 1))))
      : 0;
  }

  destroy(): void { this.unsubscribeCultivation(); }

  // ── Personagem jogável ──────────────────────────────────────────────────
  get character(): PlayerCharacterProfile { return this.profile; }

  /**
   * Troca de personagem mantendo cultivo, Gu, pedras e materiais: só a arte, os
   * números de combate e o formato do básico mudam. A vida é reescalada pela
   * proporção atual, então ninguém morre (nem cura) só por trocar.
   */
  setCharacter(id: PlayerCharacterId): boolean {
    if (!(id in PLAYER_CHARACTERS) || id === this.profile.id) return false;
    this.profile = PLAYER_CHARACTERS[id];
    this.refreshMaxHealth();
    this.projectiles.length = 0;
    return true;
  }

  get attack(): number { return this.cultivationStats.attack; }
  get baseDefense(): number { return this.cultivationStats.defense; }
  get cultivationRank(): number { return this.cultivationState.rank; }
  get cultivationMaxEssence(): number { return this.cultivationStats.maxEssence; }

  /** Qualidade da essência primordial: fortalece o Gu sem mudar o Rank dele. */
  get essenceQuality(): number { return primordialEssenceQualityMultiplier(this.cultivationState); }

  get moonlightDamage(): number {
    return this.projectileDamage('moonlight', this.lastNow);
  }

  get defense(): number { return this.defenseAt(this.lastNow); }

  defenseAt(now: number): number {
    this.pruneEffects(now);
    let value = this.cultivationStats.defense + (this.passive()?.defense ?? 0)
      + this.profile.combat.defenseBonus;
    const low = this.passive()?.lowHealthDefense;
    if (low && this.hero.maxHealth > 0 && this.hero.health / this.hero.maxHealth <= low.healthRatio) {
      value += low.defense;
    }
    value += this.maxEffect('defense');
    return Math.max(0, value);
  }

  get essenceRegen(): number {
    const passive = this.passive();
    const flat = this.config.hero.baseEssenceRegenPerSecond + (passive?.essenceRegenBonus ?? 0)
      + (this.equipment.support === 'liquor-worm' ? this.config.liquorWorm.bonusEssenceRegenPerSecond : 0);
    return Math.max(0, flat * (passive?.essenceRegenMultiplier ?? 1));
  }

  get activeProjectiles(): readonly Readonly<Projectile>[] { return this.projectiles; }
  cooldownRemaining(id: string, now: number): number { return Math.max(0, (this.cooldowns.get(id) ?? 0) - now); }
  inCombat(now: number): boolean { return this.hero.alive && now < this.combatUntil; }

  speedMultiplier(now: number): number {
    this.pruneEffects(now);
    const passive = this.passive()?.movementMultiplier ?? 1;
    const dash = now < this.speedBonusUntil ? this.dashSpeedMultiplier : 1;
    return Math.max(0.1, passive * dash * this.profile.combat.speedMultiplier
      * (1 + this.maxEffect('speed')));
  }

  private maxEffect(key: TimedKey): number {
    return this.effects.get(key)?.value ?? 0;
  }

  private permanentDamageBonus(): number {
    let bonus = 0;
    for (const id of this.assimilated) bonus += GU_CATALOG[id].assimilation?.physicalDamageBonus ?? 0;
    return bonus;
  }

  private permanentMeleeBonus(): number {
    let bonus = 0;
    for (const id of this.assimilated) bonus += GU_CATALOG[id].assimilation?.meleeDamageBonus ?? 0;
    return bonus;
  }

  damageMultiplier(now: number, type: 'physical' | 'spirit' = 'physical'): number {
    this.pruneEffects(now);
    const permanent = type === 'physical' ? this.permanentDamageBonus() : 0;
    return 1 + permanent + this.maxEffect('damage');
  }

  meleeDamageMultiplier(now: number): number {
    return this.damageMultiplier(now, 'physical') * (1 + this.permanentMeleeBonus());
  }

  projectileDamage(id: GuId, now: number): number {
    const gu = GU_CATALOG[id];
    const active = gu.active;
    if (!active || active.kind !== 'projectile') return 0;
    return Math.max(1, Math.round(active.damage * this.essenceQuality
      * this.damageMultiplier(now, active.damageType)));
  }

  stats(now: number): CombatStats {
    this.pruneEffects(now);
    const passive = this.passive();
    const maxHealth = this.maxHealthFor(this.assimilated, this.equipment.passive);
    const equippedMaxHealth = maxHealth - this.cultivationStats.maxHealth;
    const barrier = this.barrier && this.barrier.expiresAt > now ? this.barrier.amount : 0;
    return {
      base: { maxHealth: this.cultivationStats.maxHealth, attack: this.attack,
        defense: this.cultivationStats.defense, maxEssence: this.cultivationStats.maxEssence,
        essenceRegen: this.config.hero.baseEssenceRegenPerSecond },
      equipped: { defense: (passive?.defense ?? 0)
        + (passive?.lowHealthDefense && this.hero.maxHealth > 0
          && this.hero.health / this.hero.maxHealth <= passive.lowHealthDefense.healthRatio
          ? passive.lowHealthDefense.defense : 0),
        maxHealth: equippedMaxHealth,
        essenceRegen: this.essenceRegen - this.config.hero.baseEssenceRegenPerSecond,
        movementMultiplier: passive?.movementMultiplier ?? 1 },
      temporary: { damageBonus: this.maxEffect('damage'), movementBonus: this.maxEffect('speed'),
        defenseBonus: this.maxEffect('defense'), barrier },
      permanent: { physicalDamageBonus: this.permanentDamageBonus(),
        meleeDamageBonus: this.permanentMeleeBonus(), maxHealthBonus: 0 },
      total: { maxHealth, attack: this.attack, defense: this.defenseAt(now),
        maxEssence: this.cultivationStats.maxEssence, essenceRegen: this.essenceRegen,
        movementMultiplier: this.speedMultiplier(now) },
    };
  }

  activeEffects(now: number): readonly ActiveEffectView[] {
    this.pruneEffects(now);
    return [...this.effects.values()].map(effect => ({ kind: effect.key, label: effect.label,
      source: effect.source, value: effect.value,
      remainingMs: Math.max(0, effect.expiresAt - now) }));
  }

  barrierAmount(now: number): number {
    return this.barrier && this.barrier.expiresAt > now ? this.barrier.amount : 0;
  }

  empowerRemaining(now: number): number { return Math.max(0, this.empowerUntil - now); }

  // ── Inimigos e alvo ───────────────────────────────────────────────────────
  addEnemy(id: string, x: number, y: number, health = this.config.enemy.maxHealth,
    mob?: Readonly<MobDefinition>, wild: WildSpawnOptions = {}): Enemy {
    if (this.enemies.has(id)) throw new Error(`Inimigo duplicado: ${id}`);
    // Loot por criatura: o catálogo já declara pedras/materiais por Rank; sem
    // `mob` (inimigos de teste) vale a configuração global.
    const settings = { ...(mob ? { ...this.config.enemy, maxHealth: health, defense: mob.defense,
      damage: mob.damage, speed: mob.speed, aggroRange: mob.aggroRange,
      attackRange: mob.attackRange, attackCooldownMs: mob.attackCooldownMs,
      lootStones: mob.rewardStones, lootMaterialId: mob.rewardMaterialId,
      lootMaterialQuantity: mob.rewardMaterialQuantity } : this.config.enemy) };
    // O sorteio acontece aqui e só aqui: nasce uma vez, fica registrado na
    // instância e nunca é recalculado durante a luta.
    const rank = mob?.rank ?? 1;
    const wildGu = this.rollSpawnGu(rank, mob?.tier === 'boss', mob?.wildGuAffinity, wild);
    const passive = wildGu ? GU_CATALOG[wildGu].passive : undefined;
    if (passive?.defense) settings.defense += passive.defense;
    if (passive?.movementMultiplier) settings.speed *= passive.movementMultiplier;
    const maxHealth = passive?.maxHealthMultiplier
      ? Math.max(1, Math.round(health * passive.maxHealthMultiplier)) : health;
    const enemy: Enemy = { id, name: mob?.name, x, y, health: maxHealth, maxHealth,
      defense: settings.defense, alive: true, rewarded: false, lastAttackAt: -Infinity,
      // Sem `nextAt`: o primeiro tick agenda uma pequena espera (ver useWildGu).
      wild: wildGu ? { gu: wildGu, casts: 0, lowHealthDefense: passive?.lowHealthDefense?.defense }
        : undefined };
    this.enemies.set(id, enemy);
    this.enemyHomes.set(id, { x, y });
    this.enemyStats.set(id, settings);
    this.agentBrains.set(id, new AgentBrain({ kind: 'enemy', vision: settings.aggroRange,
      attackRange: settings.attackRange, memoryMs: mob?.memoryMs ?? 0,
      fear: mob?.fear ?? 0, pack: mob?.pack ?? false }));
    if (mob) this.roaming.add(id);
    return enemy;
  }

  private rollSpawnGu(rank: number, isBoss: boolean, affinity: readonly GuId[] | undefined,
    options: WildSpawnOptions): GuId | null {
    if (options.forcedWildGu === null) return null;
    if (options.forcedWildGu !== undefined) {
      const gu = GU_CATALOG[options.forcedWildGu];
      // Um teste/dev não pode criar criatura com Gu acima do Rank nem com
      // item que ela não saberia usar; nesse caso nasce sem Gu.
      return gu && gu.rank <= rank && isWildGuCandidate(gu) ? gu.id : null;
    }
    // Precisa de uma fonte explícita: `addEnemy` ou o RNG injetado no motor.
    // Sem nenhuma das duas a criatura nasce sem Gu, o que mantém determinísticos
    // os combates montados pelos testes.
    const random = options.random ?? this.injectedRandom;
    if (!random) return null;
    return rollWildGu(rank, isBoss, random, affinity);
  }

  clearAreaEnemies(): void {
    this.enemies.clear(); this.agentBrains.clear(); this.enemyHomes.clear();
    this.enemyStats.clear(); this.roaming.clear(); this.chaseAxes.clear();
    this.projectiles.length = 0;
    this.enemyProjectiles.length = 0;
    // Drops de Gu já registrados sobrevivem à troca de área: a criatura morreu
    // e o jogador ainda pode recebê-los. Recompensas nunca são recriadas.
    this.selectedId = null; this.combatUntil = 0;
  }

  /** Gu exato que a criatura deixou ao morrer, ainda não coletado. */
  pendingWildGu(enemyId: string): GuId | null { return this.wildDrops.pending(enemyId); }

  /**
   * Entrega o Gu registrado na criatura. Idempotente: processar a mesma morte
   * duas vezes não adiciona duas unidades. Falha de save não remove o drop.
   */
  claimWildGu(enemyId: string): WildGuClaim {
    if (this.wildDrops.wasDelivered(enemyId) && this.wildDrops.pending(enemyId) === null) {
      return { ok: true, alreadyClaimed: true };
    }
    const guId = this.wildDrops.pending(enemyId);
    if (!guId) return { ok: false, reason: 'Esta criatura não deixou Gu.' };
    if (this.owned(guId) >= MAX_GU_STACK) {
      return { ok: false, reason: 'Inventário de Gu cheio; a recompensa continua registrada.' };
    }
    const nextInventory = { ...this.inventory, [guId]: this.owned(guId) + 1 };
    if (!this.commit({ ...this.snapshot(), inventory: nextInventory })) {
      return { ok: false, retryable: true, reason: 'Não foi possível salvar o Gu.' };
    }
    this.wildDrops.markDelivered(enemyId);
    return { ok: true, guId };
  }

  /**
   * Entrega uma Gu comprada na banca: grava antes de publicar o inventário e
   * respeita o limite de pilha. Não equipa nada automaticamente.
   */
  grantGu(id: GuId): { ok: boolean; reason?: string } {
    if (!GU_CATALOG[id]) return { ok: false, reason: 'Gu desconhecida.' };
    if (this.owned(id) >= MAX_GU_STACK) return { ok: false, reason: 'Inventário cheio para esta Gu.' };
    const nextInventory = { ...this.inventory, [id]: this.owned(id) + 1 };
    if (!this.commit({ ...this.snapshot(), inventory: nextInventory })) {
      return { ok: false, reason: 'Não foi possível salvar a Gu; pedras devolvidas.' };
    }
    return { ok: true };
  }

  agentMemory(id: string): Readonly<AgentBrain['memory']> | null { return this.agentBrains.get(id)?.memory ?? null; }

  private engage(now: number): void { this.combatUntil = Math.max(this.combatUntil, now + this.config.combatLockMs); }

  select(id: string | null): boolean {
    if (id && !this.enemies.get(id)?.alive) return false;
    this.selectedId = id; return true;
  }

  get target(): Enemy | null {
    const manual = this.selectedId ? this.enemies.get(this.selectedId) : null;
    if (manual?.alive) return manual;
    if (!this.autoTarget) return null;
    return [...this.enemies.values()].filter(e => e.alive)
      .sort((a, b) => distance(this.hero, a) - distance(this.hero, b) || a.id.localeCompare(b.id))[0] ?? null;
  }

  // ── Equipamento ───────────────────────────────────────────────────────────
  equip(slot: GuSlot, id: GuId | null, now: number): ActionResult {
    if (!this.hero.alive || this.inCombat(now)) return deny('Troca bloqueada durante o combate.');
    if (!GU_SLOTS.includes(slot)) return deny('Slot de Gu inválido.');
    if (id === null) {
      const next = { ...this.equipment, [slot]: null };
      if (!this.commit({ ...this.snapshot(), equipment: next })) {
        return deny('Não foi possível salvar o inventário; nada foi alterado.');
      }
      this.refreshMaxHealth();
      return { ok: true, events: [] };
    }
    const gu = GU_CATALOG[id];
    if (!gu || !isEquippable(gu) || gu.slot !== slot || this.owned(id) <= 0) {
      return deny('Gu incompatível ou indisponível.');
    }
    if (gu.usage.requiresRank > this.cultivationState.rank) {
      return deny(`Rank insuficiente: ${gu.label} exige Rank ${gu.usage.requiresRank}.`);
    }
    if (GU_SLOTS.some(other => other !== slot && this.equipment[other] === id)) {
      return deny('Gu já equipado.');
    }
    const next = { ...this.equipment, [slot]: id };
    if (!this.commit({ ...this.snapshot(), equipment: next })) {
      return deny('Não foi possível salvar o inventário; nada foi alterado.');
    }
    this.refreshMaxHealth();
    return { ok: true, events: [] };
  }

  // ── Ativação genérica ─────────────────────────────────────────────────────
  activate(id: GuId, now: number, direction: Direction,
    isFree: (x: number, y: number) => boolean = () => true): ActionResult {
    this.lastNow = now;
    if (!this.hero.alive) return deny(`${this.profile.name} está derrotado.`);
    const gu = GU_CATALOG[id];
    if (!gu || !this.isEquipped(id)) return deny('Gu não equipado.');
    if (!isUsable(gu) || gu.categories.includes('consumable')) return deny('Este Gu não é ativável.');
    if (gu.usage.requiresRank > this.cultivationState.rank) {
      return deny(`Rank insuficiente: ${gu.label} exige Rank ${gu.usage.requiresRank}.`);
    }
    const active = gu.active;
    if (!active) return deny('Este Gu não possui ativação.');
    if (this.cooldownRemaining(id, now) > 0) return deny(`${gu.label} em recarga.`);
    const empowered = this.empowerUntil > now && id !== 'amplify-effect';
    const usage: GuUsage = gu.usage;
    const cost = Math.ceil(usage.essenceCost * (empowered ? this.empowerCostMultiplier : 1));
    if (this.essence < cost) return deny('Essência primordial insuficiente.');

    if (active.kind === 'dash') {
      const travel = this.dashTravel(direction,
        active.distance * (empowered ? this.empowerEffectMultiplier : 1), isFree);
      if (travel <= 0) return deny('Caminho bloqueado.');
      this.essence -= cost;
      this.cooldowns.set(id, now + usage.cooldownMs);
      const from = { ...this.hero };
      const vector = vectors[direction];
      this.hero.x += vector.x * travel;
      this.hero.y += vector.y * travel;
      this.speedBonusUntil = now + active.durationMs;
      this.dashSpeedMultiplier = active.speedMultiplier;
      this.engage(now);
      this.consumeEmpower(now, id);
      return { ok: true, events: [{ type: 'dash', x: from.x, y: from.y, guId: id }] };
    }

    if (active.kind === 'heal') {
      if (this.hero.health >= this.hero.maxHealth) return deny('Vida já está cheia.');
      this.essence -= cost;
      this.cooldowns.set(id, now + usage.cooldownMs);
      const amount = Math.round(active.amount * (empowered ? this.empowerEffectMultiplier : 1));
      const healed = Math.min(amount, this.hero.maxHealth - this.hero.health);
      this.hero.health += healed;
      this.consumeEmpower(now, id);
      return { ok: true, events: [{ type: 'heal', amount: healed, guId: id, x: this.hero.x, y: this.hero.y }] };
    }

    if (active.kind === 'buff') {
      this.essence -= cost;
      this.cooldowns.set(id, now + usage.cooldownMs);
      if (active.damageMultiplier > 1) {
        this.applyEffect('damage', active.damageMultiplier - 1, active.durationMs, now, id,
          `${gu.label}: +${Math.round((active.damageMultiplier - 1) * 100)}% dano`);
      }
      if (active.movementMultiplier > 1) {
        this.applyEffect('speed', active.movementMultiplier - 1, active.durationMs, now, id,
          `${gu.label}: +${Math.round((active.movementMultiplier - 1) * 100)}% velocidade`);
      }
      if (active.defenseBonus !== 0) {
        this.applyEffect('defense', active.defenseBonus, active.durationMs, now, id,
          `${gu.label}: ${active.defenseBonus > 0 ? '+' : ''}${active.defenseBonus} defesa`);
      }
      this.consumeEmpower(now, id);
      return { ok: true, events: [{ type: 'activate', guId: id, x: this.hero.x, y: this.hero.y }] };
    }

    if (active.kind === 'empower') {
      this.essence -= cost;
      this.cooldowns.set(id, now + usage.cooldownMs);
      this.empowerUntil = now + active.durationMs;
      this.empowerEffectMultiplier = active.effectMultiplier;
      this.empowerCostMultiplier = active.costMultiplier;
      return { ok: true, events: [{ type: 'activate', guId: id, x: this.hero.x, y: this.hero.y }] };
    }

    if (active.kind === 'blind') return deny('Este Gu não é ativável em combate.');

    // Projéteis
    this.essence -= cost;
    this.cooldowns.set(id, now + usage.cooldownMs);
    const damage = Math.max(1, Math.round(active.damage * this.essenceQuality
      * this.damageMultiplier(now, active.damageType)
      * (empowered ? this.empowerEffectMultiplier : 1)));
    this.spawnProjectiles(id, direction, damage, active.range, active.width, active.speed,
      active.count, active.pierce, active.splashRadius);
    this.engage(now);
    this.consumeEmpower(now, id);
    return { ok: true, events: [{ type: 'activate', guId: id, x: this.hero.x, y: this.hero.y }] };
  }

  private consumeEmpower(now: number, id: GuId): void {
    if (id !== 'amplify-effect' && this.empowerUntil > now) this.empowerUntil = 0;
  }

  private spawnProjectiles(id: GuId, direction: Direction, damage: number, range: number,
    width: number, speed: number, count: number, pierce: boolean, splashRadius: number): void {
    const lateral = direction === 'up' || direction === 'down';
    for (let index = 0; index < Math.max(1, count); index++) {
      const offset = count > 1 ? (index - (count - 1) / 2) * 14 : 0;
      this.projectiles.push({
        guId: id, style: 'blade', tint: colorOf(id),
        x: this.hero.x + (lateral ? offset : 0),
        y: this.hero.y - 12 + (lateral ? 0 : offset), direction, traveled: 0, hit: new Set(),
        damage, range, width, speed, pierce, splashRadius, splashDone: false,
      });
    }
  }

  private dashTravel(direction: Direction, distanceWanted: number,
    isFree: (x: number, y: number) => boolean): number {
    const v = vectors[direction];
    let traveled = 0;
    for (let d = 4; d <= distanceWanted; d += 4) {
      if (!isFree(this.hero.x + v.x * d, this.hero.y + v.y * d)) break;
      traveled = d;
    }
    return traveled;
  }

  private applyEffect(key: TimedKey, value: number, durationMs: number, now: number,
    source: GuId, label: string): void {
    const existing = this.effects.get(key);
    if (!existing) {
      this.effects.set(key, { key, value, expiresAt: now + durationMs, source, label });
      return;
    }
    // Regra previsível: maior valor prevalece; a duração é renovada pelo maior prazo.
    existing.value = Math.max(existing.value, value);
    existing.expiresAt = Math.max(existing.expiresAt, now + durationMs);
    if (value >= existing.value) { existing.source = source; existing.label = label; }
  }

  private pruneEffects(now: number): void {
    for (const [key, effect] of this.effects) if (effect.expiresAt <= now) this.effects.delete(key);
    if (this.barrier && this.barrier.expiresAt <= now) this.barrier = null;
    if (this.empowerUntil <= now) this.empowerUntil = 0;
  }

  /** Compatibilidade: o HUD antigo e os testes chamam estes dois wrappers. */
  castMoonlight(now: number, direction: Direction): ActionResult {
    if (!this.hero.alive || this.equipment.attack !== 'moonlight') return deny('Gu da Lua não equipado.');
    if (this.cooldownRemaining('moonlight', now) > 0) return deny('Gu da Lua em recarga.');
    if (this.essence < GU_CATALOG.moonlight.usage.essenceCost) return deny('Essência primordial insuficiente.');
    const result = this.activate('moonlight', now, direction);
    if (!result.ok) return result;
    return { ok: true, events: [{ type: 'moonlight', x: this.hero.x, y: this.hero.y - 12, guId: 'moonlight' }] };
  }

  dash(now: number, direction: Direction, isFree: (x: number, y: number) => boolean): ActionResult {
    if (!this.hero.alive) return deny(`${this.profile.name} está derrotado.`);
    const id = this.equipment.movement;
    if (!id) return deny('Equipe o Gu de movimento.');
    return this.activate(id, now, direction, isFree);
  }

  /** Consumível: só desconta do inventário depois de o save ser concluído. */
  useItem(id: GuId, now: number): ActionResult {
    this.lastNow = now;
    if (!this.hero.alive) return deny(`${this.profile.name} está derrotado.`);
    const gu = GU_CATALOG[id];
    if (!gu || !gu.categories.includes('consumable')) return deny('Este item não é consumível.');
    if (this.owned(id) <= 0) return deny('Item indisponível.');
    const effect = gu.active;
    if (!effect || effect.kind !== 'blind') return deny('Efeito de consumível não implementado.');
    const nextInventory = { ...this.inventory, [id]: this.owned(id) - 1 };
    if (!this.commit({ ...this.snapshot(), inventory: nextInventory })) {
      return deny('Não foi possível salvar o inventário; o item não foi consumido.');
    }
    const events: CombatEvent[] = [{ type: 'blind', guId: id, x: this.hero.x, y: this.hero.y }];
    for (const enemy of this.enemies.values()) {
      if (!enemy.alive || distance(enemy, this.hero) > effect.radius) continue;
      enemy.blindedUntil = Math.max(enemy.blindedUntil ?? 0, now + effect.durationMs);
      events.push({ type: 'blind', targetId: enemy.id, guId: id, x: enemy.x, y: enemy.y });
    }
    this.engage(now);
    return { ok: true, events };
  }

  // ── Assimilação ───────────────────────────────────────────────────────────
  assimilate(id: GuId, now: number): ActionResult {
    this.lastNow = now;
    if (!this.hero.alive) return deny(`${this.profile.name} está derrotado.`);
    if (this.inCombat(now)) return deny('Assimilação bloqueada durante o combate.');
    const gu = GU_CATALOG[id];
    if (!gu || !isAssimilable(gu)) return deny('Este Gu não pode ser assimilado.');
    if (this.assimilated.has(id)) return deny('Este benefício já foi assimilado.');
    if (this.owned(id) <= 0) return deny('Gu indisponível no inventário.');
    const nextInventory = { ...this.inventory, [id]: this.owned(id) - 1 };
    const nextEquipment = { ...this.equipment };
    for (const slot of GU_SLOTS) if (nextEquipment[slot] === id) nextEquipment[slot] = null;
    const nextAssimilated = [...this.assimilated, id];
    if (!this.commit({ inventory: nextInventory, equipment: nextEquipment, assimilated: nextAssimilated })) {
      return deny('Não foi possível salvar a assimilação; o Gu não foi perdido.');
    }
    this.refreshMaxHealth();
    return { ok: true, events: [{ type: 'assimilate', guId: id, x: this.hero.x, y: this.hero.y }] };
  }

  // ── Refino ────────────────────────────────────────────────────────────────
  refine(recipeId: string, now: number): ActionResult {
    this.lastNow = now;
    if (!this.hero.alive) return deny(`${this.profile.name} está derrotado.`);
    if (this.inCombat(now)) return deny('Refino bloqueado durante o combate.');
    const recipe = recipeById(recipeId);
    if (!recipe) return deny('Receita desconhecida.');
    if (this.cultivationState.rank < recipe.requiresRank) {
      return deny(`Rank insuficiente: a receita exige Rank ${recipe.requiresRank}.`);
    }
    if (recipe.materials.length > 0) {
      // Os materiais vivem em CultivationState, que o motor não muta diretamente;
      // as receitas iniciais não usam materiais adicionais.
      return deny('Materiais adicionais de refino ainda não integrados ao cultivo.');
    }
    const ingredientShortage = recipe.ingredients.find(ingredient => this.owned(ingredient.id) < ingredient.quantity);
    if (ingredientShortage) {
      return deny(`Ingredientes insuficientes: faltam ${ingredientShortage.quantity}× ${GU_CATALOG[ingredientShortage.id].label}.`);
    }
    if (this.essence < recipe.essenceCost) return deny('Essência primordial insuficiente.');
    const nextInventory = { ...this.inventory };
    for (const ingredient of recipe.ingredients) nextInventory[ingredient.id] -= ingredient.quantity;
    if (nextInventory[recipe.result] + recipe.resultQuantity > 99) return deny('Limite de inventário atingido.');
    nextInventory[recipe.result] += recipe.resultQuantity;
    const nextEquipment = { ...this.equipment };
    for (const slot of GU_SLOTS) {
      const equipped = nextEquipment[slot];
      if (equipped && nextInventory[equipped] <= 0) nextEquipment[slot] = null;
    }
    if (!this.commit({ inventory: nextInventory, equipment: nextEquipment,
      assimilated: [...this.assimilated] })) {
      return deny('Não foi possível salvar o refino; nenhum recurso foi gasto.');
    }
    this.essence -= recipe.essenceCost;
    this.refreshMaxHealth();
    return { ok: true, events: [{ type: 'refine', guId: recipe.result, x: this.hero.x, y: this.hero.y }] };
  }

  get recipes() { return GU_RECIPES; }

  // ── Dano ──────────────────────────────────────────────────────────────────
  /** Defesa efetiva: passivos aplicados no nascimento + Bronze Skin condicional. */
  private enemyDefense(enemy: Enemy): number {
    const low = enemy.wild?.lowHealthDefense ?? 0;
    const lowActive = low > 0 && enemy.maxHealth > 0 && enemy.health / enemy.maxHealth <= 0.5;
    return Math.max(0, enemy.defense + (lowActive ? low : 0));
  }

  private damageEnemy(enemy: Enemy, amount: number, now: number): CombatEvent[] {
    if (!enemy.alive) return [];
    const damage = Math.min(enemy.health, mitigatedDamage(amount, this.enemyDefense(enemy)));
    enemy.health -= damage; this.engage(now);
    const events: CombatEvent[] = [{ type: 'damage', targetId: enemy.id, amount: damage, x: enemy.x, y: enemy.y }];
    if (enemy.health <= 0) {
      enemy.alive = false;
      if (this.selectedId === enemy.id) this.selectedId = null;
      events.push({ type: 'defeat', targetId: enemy.id, x: enemy.x, y: enemy.y });
      if (!enemy.rewarded && !this.processedRewards.has(enemy.id)) {
        enemy.rewarded = true; this.processedRewards.add(enemy.id);
        const guReward = enemy.wild?.gu;
        // O Gu é registrado na morte a partir da instância — nunca sorteado aqui.
        if (guReward) this.wildDrops.register(enemy.id, guReward);
        // Pedras e material vêm da criatura derrotada (Rank/risco), não de um valor fixo.
        const loot = this.enemyStats.get(enemy.id) ?? this.config.enemy;
        events.push({ type: 'reward', targetId: enemy.id, stoneReward: loot.lootStones,
          materialId: loot.lootMaterialId, materialQuantity: loot.lootMaterialQuantity,
          guReward });
      }
    }
    return events;
  }

  /**
   * Ataque básico do personagem: corpo a corpo (Fang Yuan) ou projétil (Bai Ning Bing).
   *
   * O básico à distância NÃO checa linha de visão no disparo — quem voa é o
   * estilhaço, e ele para na parede como qualquer projétil. É a vantagem do alcance,
   * paga com menos dano, recarga mais longa e vida menor.
   */
  basicAttack(now: number, isFree: (x: number, y: number) => boolean = () => true): ActionResult {
    this.lastNow = now;
    if (!this.hero.alive) return deny(`${this.profile.name} está derrotado.`);
    const enemy = this.target;
    if (!enemy) return deny('Selecione um alvo ou ative alvo automático.');
    const gap = distance(this.hero, enemy);
    if (gap > this.profile.basic.range) return deny('Alvo fora do alcance.');
    if (this.profile.kind === 'melee' && meleeLineBlocked(this.hero, enemy, isFree)) {
      return deny(`Obstáculo entre ${this.profile.name} e o alvo.`);
    }
    if (this.cooldownRemaining('basic', now)) return deny('Ataque em recarga.');
    this.cooldowns.set('basic', now + this.profile.basic.cooldownMs);
    const base = this.attack * this.profile.combat.damageMultiplier;
    if (this.profile.kind === 'projectile') {
      const amount = Math.max(1, Math.round(base * this.damageMultiplier(now, 'physical')));
      const dx = enemy.x - this.hero.x, dy = enemy.y - this.hero.y;
      const direction: Direction = Math.abs(dx) >= Math.abs(dy)
        ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
      this.projectiles.push({
        guId: null, style: 'ice', tint: this.profile.accent,
        // O disparo sai alinhado ao alvo, não ao centro do tile: é o básico dele.
        x: this.hero.x, y: this.hero.y - 12, direction, traveled: 0, hit: new Set(),
        damage: amount, range: Math.min(this.profile.basic.range, Math.max(gap, 24)),
        width: this.profile.basic.width, speed: this.profile.basic.projectileSpeed,
        pierce: false, splashRadius: 0, splashDone: false,
      });
      this.engage(now);
      return { ok: true, events: [{ type: 'activate', x: this.hero.x, y: this.hero.y }] };
    }
    const amount = Math.max(1, Math.round(base * this.meleeDamageMultiplier(now)));
    return { ok: true, events: this.damageEnemy(enemy, amount, now) };
  }

  hitHero(amount: number, now: number, hitId: string, random?: () => number): CombatEvent[] {
    const rng = random ?? this.random;
    this.lastNow = now;
    if (!this.hero.alive || this.processedHits.has(hitId)) return [];
    this.processedHits.add(hitId); this.recentHits.push(hitId);
    if (this.recentHits.length > 512) this.processedHits.delete(this.recentHits.shift()!);
    this.pruneEffects(now);
    const incoming = mitigatedDamage(amount, this.defenseAt(now));
    let damage = incoming;
    const events: CombatEvent[] = [];
    if (this.barrier && this.barrier.expiresAt > now && this.barrier.amount > 0) {
      const absorbed = Math.min(this.barrier.amount, damage);
      this.barrier.amount -= absorbed;
      damage -= absorbed;
      if (absorbed > 0) events.push({ type: 'barrier', amount: absorbed, targetId: 'hero',
        x: this.hero.x, y: this.hero.y, guId: this.barrier.source });
      if (this.barrier.amount <= 0) this.barrier = null;
    }
    this.hero.health -= damage; this.engage(now);
    if (damage > 0) {
      events.push({ type: 'damage', targetId: 'hero', amount: damage, x: this.hero.x, y: this.hero.y });
    }
    if (this.hero.health <= 0) {
      if (!this.cooldownRemaining('cicada', now) && rng() < this.config.cicada.chance) {
        this.hero.health = Math.max(1, Math.ceil(this.hero.maxHealth * this.config.cicada.restoredHealthRatio));
        this.cooldowns.set('cicada', now + this.config.cicada.cooldownMs);
        events.push({ type: 'resurrect', targetId: 'hero', x: this.hero.x, y: this.hero.y });
      } else {
        this.hero.health = 0; this.hero.alive = false;
        this.effects.clear(); this.barrier = null; this.empowerUntil = 0; this.speedBonusUntil = 0;
        this.enemyProjectiles.length = 0;
        events.push({ type: 'hero-death', targetId: 'hero', x: this.hero.x, y: this.hero.y });
      }
    }
    return events;
  }

  respawn(x: number, y: number): boolean {
    if (this.hero.alive) return false;
    this.hero.x = x; this.hero.y = y; this.hero.health = this.hero.maxHealth; this.essence = this.cultivationStats.maxEssence;
    this.hero.alive = true; this.combatUntil = 0; this.speedBonusUntil = 0; this.dashSpeedMultiplier = 1;
    this.effects.clear(); this.barrier = null; this.empowerUntil = 0;
    this.selectedId = null; this.projectiles.length = 0; this.enemyProjectiles.length = 0; return true;
  }

  // ── Loop ──────────────────────────────────────────────────────────────────
  private projectileStep(projectile: Projectile, dt: number,
    isFree: (x: number, y: number) => boolean): { step: number; blocked: boolean } {
    const v = vectors[projectile.direction];
    const desired = Math.min(projectile.speed * dt, projectile.range - projectile.traveled);
    for (let d = 4; d <= desired + 3; d += 4) {
      const sample = Math.min(d, desired);
      if (!isFree(projectile.x + v.x * sample, projectile.y + 12 + v.y * sample)) {
        return { step: Math.max(0, sample - 4), blocked: true };
      }
    }
    return { step: desired, blocked: false };
  }

  private resolveProjectile(projectile: Projectile, step: number, now: number):
    { events: CombatEvent[]; stopped: boolean } {
    const v = vectors[projectile.direction];
    const events: CombatEvent[] = [];
    const hits = [...this.enemies.values()].filter(enemy => enemy.alive && !projectile.hit.has(enemy.id))
      .map(enemy => {
        const along = (enemy.x - projectile.x) * v.x + (enemy.y - 12 - projectile.y) * v.y;
        const cross = Math.abs((enemy.x - projectile.x) * v.y - (enemy.y - 12 - projectile.y) * v.x);
        return { enemy, along, cross };
      })
      .filter(hit => hit.along >= -8 && hit.along <= step + 8
        && hit.cross <= projectile.width / 2 + 10)
      .sort((a, b) => a.along - b.along || a.enemy.id.localeCompare(b.enemy.id));
    let stopped = false;
    for (const { enemy } of hits) {
      if (projectile.hit.has(enemy.id)) continue;
      projectile.hit.add(enemy.id);
      events.push(...this.damageEnemy(enemy, projectile.damage, now));
      if (projectile.splashRadius > 0 && !projectile.splashDone) {
        projectile.splashDone = true;
        for (const other of this.enemies.values()) {
          if (other.id === enemy.id || !other.alive || projectile.hit.has(other.id)) continue;
          if (distance(other, enemy) > projectile.splashRadius) continue;
          projectile.hit.add(other.id);
          events.push(...this.damageEnemy(other, projectile.damage, now));
        }
        stopped = true;
        break;
      }
      if (enemy.alive && !projectile.pierce) { stopped = true; break; }
    }
    return { events, stopped };
  }

  tick(now: number, deltaMs: number, isFree: (x: number, y: number) => boolean = () => true): CombatEvent[] {
    this.lastNow = now;
    const dt = Math.max(0, Math.min(deltaMs, 100)) / 1000;
    this.pruneEffects(now);
    if (this.hero.alive) {
      this.essence = Math.min(this.cultivationStats.maxEssence,
        this.essence + this.essenceRegen * dt);
    }
    const events: CombatEvent[] = [];
    for (const projectile of [...this.projectiles]) {
      const { step, blocked } = this.projectileStep(projectile, dt, isFree);
      const resolved = this.resolveProjectile(projectile, step, now);
      events.push(...resolved.events);
      const v = vectors[projectile.direction];
      projectile.x += v.x * step; projectile.y += v.y * step; projectile.traveled += step;
      if (blocked || resolved.stopped || projectile.traveled >= projectile.range) {
        this.projectiles.splice(this.projectiles.indexOf(projectile), 1);
      }
    }
    if (!this.hero.alive) return events;
    events.push(...this.stepEnemyProjectiles(now, dt, isFree));
    if (!this.hero.alive) return events;
    const packAlert = [...this.enemies.values()].some(enemy => enemy.alive && this.agentBrains.get(enemy.id)?.traits.pack
      && distance(enemy, this.hero) <= this.enemyStats.get(enemy.id)!.aggroRange) ? { x: this.hero.x, y: this.hero.y } : null;
    const packLosses = [...this.enemies.values()].filter(enemy => !enemy.alive && this.agentBrains.get(enemy.id)?.traits.pack).length;
    for (const enemy of this.enemies.values()) {
      if (!enemy.alive) continue;
      if (enemy.blindedUntil !== undefined && now < enemy.blindedUntil) continue;
      events.push(...useWildGu(enemy, now, this.wildContext(isFree)));
      const stats = this.enemyStats.get(enemy.id)!; const brain = this.agentBrains.get(enemy.id)!;
      const decision = brain.decide(now, { self: enemy, home: this.enemyHomes.get(enemy.id)!, healthRatio: enemy.health / enemy.maxHealth,
        player: this.hero, packAlert: brain.traits.pack ? packAlert : null, alliesFallen: brain.traits.pack ? packLosses : 0 }, this.random);
      if (decision.action === 'attack' || decision.action === 'chase') this.engage(now);
      if (decision.action === 'attack') {
        if (now - enemy.lastAttackAt < stats.attackCooldownMs) continue;
        enemy.lastAttackAt = now;
        const strike = this.hitHero(stats.damage * wildMeleeMultiplier(enemy, now), now,
          `${enemy.id}:${now}`);
        events.push(...strike);
        if (strike.some(event => event.type === 'resurrect' || event.type === 'hero-death')) break; continue;
      }
      let target = decision.target; let stoppingDistance = decision.action === 'chase' ? stats.attackRange : 2;
      if (decision.action === 'flee' && target) {
        const awayX = target.x - enemy.x, awayY = target.y - enemy.y;
        target = { x: enemy.x + awayX * 128, y: enemy.y + awayY * 128 }; stoppingDistance = 0;
      }
      if (decision.action === 'wander' && this.roaming.has(enemy.id) && decision.direction) {
        const v = vectors[decision.direction]; target = { x: enemy.x + v.x * stats.speed * dt * 0.4, y: enemy.y + v.y * stats.speed * dt * 0.4 };
        if (distance(target, this.enemyHomes.get(enemy.id)!) > 32) { brain.stop(); continue; } stoppingDistance = 0;
      }
      if (!target) continue;
      const gap = distance(enemy, target); if (gap <= stoppingDistance) continue;
      const step = Math.min(stats.speed * dt, gap - stoppingDistance);
      if (!(step > 0)) continue;
      // Mesma regra do jogador: um eixo por vez, nunca na diagonal. Se o eixo
      // preferido estiver bloqueado, a criatura desliza pelo outro.
      const next = cardinalStep(enemy, target, step, isFree, this.chaseAxes.get(enemy.id) ?? null);
      if (next.moved) {
        enemy.x = next.x; enemy.y = next.y;
        if (next.axis) this.chaseAxes.set(enemy.id, next.axis);
      } else brain.stop();
    }
    return events;
  }

  // ── Gu selvagem ───────────────────────────────────────────────────────────
  // O comportamento vive em `enemyAbilities.ts`; o motor só fornece o contexto.
  private wildContext(isFree: (x: number, y: number) => boolean) {
    return { hero: this.hero, shots: this.enemyProjectiles, isFree,
      engage: (now: number) => this.engage(now) };
  }

  private stepEnemyProjectiles(now: number, dt: number,
    isFree: (x: number, y: number) => boolean): CombatEvent[] {
    return stepEnemyProjectiles(this.enemyProjectiles, now, dt,
      { hero: this.hero, isFree, hitHero: (damage, at, hitId) => this.hitHero(damage, at, hitId) });
  }

  get activeEnemyProjectiles(): readonly Readonly<EnemyProjectile>[] { return this.enemyProjectiles; }

  /** Exposto para a UI mostrar que uma defesa temporária foi aplicada. */
  applyBarrier(id: GuId, amount: number, durationMs: number, now: number): void {
    const label = `${GU_CATALOG[id].label}: barreira`;
    if (!positive(amount)) return;
    if (!this.barrier || this.barrier.amount < amount) {
      this.barrier = { amount, expiresAt: now + durationMs, source: id, label };
    }
  }
}
