import { COMBAT_CONFIG, STARTING_EQUIPMENT, type CombatSettings } from './combatConfig';
import { GU_CATALOG, GU_IDS, isAssimilable, isEquippable, isUsable } from './guCatalog';
import { GU_RECIPES, recipeById } from './guRecipes';
import { GuStateStore, emptyInventory, type GuSnapshot } from './guState';
import { GU_SLOTS, type ActionResult, type CombatEvent, type Direction, type Enemy,
  type GuId, type GuSlot, type GuUsage, type Point } from './types';
import { AgentBrain } from '../agents/agentBrain';
import type { MobDefinition } from './mobCatalog';
import type { CultivationState } from '../entities/cultivation';
import { CharacterCultivation } from '../entities/characterCultivation';
import { cultivationCombatStats, primordialEssenceQualityMultiplier,
  type CultivationCombatStats } from '../entities/cultivationCombat';
import { mitigatedDamage } from './damageFormula';

const vectors: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const deny = (reason: string): ActionResult => ({ ok: false, reason, events: [] });
const positive = (value: number) => Number.isFinite(value) && value > 0;

interface Projectile {
  guId: GuId; x: number; y: number; direction: Direction; traveled: number; hit: Set<string>;
  damage: number; range: number; width: number; speed: number; pierce: boolean;
  splashRadius: number; splashDone: boolean;
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
  private readonly processedHits = new Set<string>();
  private readonly recentHits: string[] = [];
  private readonly processedRewards = new Set<string>();
  private readonly agentBrains = new Map<string, AgentBrain>();
  private readonly enemyHomes = new Map<string, Point>();
  private readonly enemyStats = new Map<string, CombatSettings['enemy']>();
  private readonly roaming = new Set<string>();
  private readonly effects = new Map<TimedKey, TimedEffect>();
  private barrier: Barrier | null = null;
  private empowerUntil = 0;
  private empowerEffectMultiplier = 1.5;
  private empowerCostMultiplier = 1.5;

  constructor(readonly config: CombatSettings = COMBAT_CONFIG, x = 0, y = 0,
    cultivation?: CultivationState, private readonly store: GuStateStore | null = new GuStateStore()) {
    this.cultivationState = cultivation ?? { rank: 1, stage: 'Inicial', spiritStones: 0, materials: {} };
    this.cultivationStats = cultivationCombatStats(this.cultivationState);
    const saved = this.store?.load() ?? null;
    this.adoptSnapshot(saved ?? this.defaultSnapshot());
    const maxHealth = this.maxHealthFor(this.assimilated, this.equipment.passive);
    this.hero = { x, y, health: maxHealth, maxHealth, alive: true };
    this.essence = this.cultivationStats.maxEssence;
    this.unsubscribeCultivation = CharacterCultivation.subscribe(state => this.applyCultivation(state));
  }

  // ── Estado persistente ────────────────────────────────────────────────────
  private defaultSnapshot(): GuSnapshot {
    const inventory = emptyInventory();
    for (const id of GU_IDS) {
      const gu = GU_CATALOG[id];
      if (gu.rank === 1) inventory[id] = id === 'little-light' ? 2 : 1;
    }
    return { inventory, equipment: { ...STARTING_EQUIPMENT }, assimilated: [] };
  }

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
    return Math.max(1, Math.round((this.cultivationStats.maxHealth + bonus) * multiplier)
      + (passive?.maxHealthBonus ?? 0));
  }

  private refreshMaxHealth(keepRatio = true): void {
    const ratio = this.hero.maxHealth > 0 ? this.hero.health / this.hero.maxHealth : 1;
    this.hero.maxHealth = this.maxHealthFor(this.assimilated, this.equipment.passive);
    this.hero.health = this.hero.alive
      ? Math.max(1, Math.min(this.hero.maxHealth, Math.round(this.hero.maxHealth * (keepRatio ? ratio : 1))))
      : 0;
  }

  destroy(): void { this.unsubscribeCultivation(); }
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
    let value = this.cultivationStats.defense + (this.passive()?.defense ?? 0);
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
    return Math.max(0.1, passive * dash * (1 + this.maxEffect('speed')));
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
    mob?: Readonly<MobDefinition>): Enemy {
    if (this.enemies.has(id)) throw new Error(`Inimigo duplicado: ${id}`);
    const settings = mob ? { ...this.config.enemy, maxHealth: health, defense: mob.defense,
      damage: mob.damage, speed: mob.speed, aggroRange: mob.aggroRange,
      attackRange: mob.attackRange, attackCooldownMs: mob.attackCooldownMs } : this.config.enemy;
    const enemy: Enemy = { id, name: mob?.name, x, y, health, maxHealth: health,
      defense: settings.defense, alive: true, rewarded: false, lastAttackAt: -Infinity };
    this.enemies.set(id, enemy);
    this.enemyHomes.set(id, { x, y });
    this.enemyStats.set(id, settings);
    this.agentBrains.set(id, new AgentBrain({ kind: 'enemy', vision: settings.aggroRange,
      attackRange: settings.attackRange, memoryMs: mob?.memoryMs ?? 0,
      fear: mob?.fear ?? 0, pack: mob?.pack ?? false }));
    if (mob) this.roaming.add(id);
    return enemy;
  }

  clearAreaEnemies(): void {
    this.enemies.clear(); this.agentBrains.clear(); this.enemyHomes.clear();
    this.enemyStats.clear(); this.roaming.clear(); this.projectiles.length = 0;
    this.selectedId = null; this.combatUntil = 0;
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
    if (!this.hero.alive) return deny('Fang Yuan está derrotado.');
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
        guId: id, x: this.hero.x + (lateral ? offset : 0),
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
    if (!this.hero.alive) return deny('Fang Yuan está derrotado.');
    const id = this.equipment.movement;
    if (!id) return deny('Equipe o Gu de movimento.');
    return this.activate(id, now, direction, isFree);
  }

  /** Consumível: só desconta do inventário depois de o save ser concluído. */
  useItem(id: GuId, now: number): ActionResult {
    this.lastNow = now;
    if (!this.hero.alive) return deny('Fang Yuan está derrotado.');
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
    if (!this.hero.alive) return deny('Fang Yuan está derrotado.');
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
    if (!this.hero.alive) return deny('Fang Yuan está derrotado.');
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
  private damageEnemy(enemy: Enemy, amount: number, now: number): CombatEvent[] {
    if (!enemy.alive) return [];
    const damage = Math.min(enemy.health, mitigatedDamage(amount, enemy.defense));
    enemy.health -= damage; this.engage(now);
    const events: CombatEvent[] = [{ type: 'damage', targetId: enemy.id, amount: damage, x: enemy.x, y: enemy.y }];
    if (enemy.health <= 0) {
      enemy.alive = false;
      if (this.selectedId === enemy.id) this.selectedId = null;
      events.push({ type: 'defeat', targetId: enemy.id, x: enemy.x, y: enemy.y });
      if (!enemy.rewarded && !this.processedRewards.has(enemy.id)) {
        enemy.rewarded = true; this.processedRewards.add(enemy.id);
        events.push({ type: 'reward', targetId: enemy.id, stoneReward: this.config.enemy.lootStones,
          materialId: this.config.enemy.lootMaterialId, materialQuantity: this.config.enemy.lootMaterialQuantity });
      }
    }
    return events;
  }

  basicAttack(now: number, isFree: (x: number, y: number) => boolean = () => true): ActionResult {
    this.lastNow = now;
    if (!this.hero.alive) return deny('Fang Yuan está derrotado.');
    const enemy = this.target;
    if (!enemy) return deny('Selecione um alvo ou ative alvo automático.');
    const gap = distance(this.hero, enemy);
    if (gap > this.config.basic.range) return deny('Alvo fora do alcance.');
    for (let d = 4; d < gap; d += 4) {
      if (!isFree(this.hero.x + (enemy.x - this.hero.x) * d / gap,
        this.hero.y + (enemy.y - this.hero.y) * d / gap)) return deny('Obstáculo entre Fang Yuan e o alvo.');
    }
    if (this.cooldownRemaining('basic', now)) return deny('Ataque em recarga.');
    this.cooldowns.set('basic', now + this.config.basic.cooldownMs);
    const amount = Math.max(1, Math.round(this.attack * this.meleeDamageMultiplier(now)));
    return { ok: true, events: this.damageEnemy(enemy, amount, now) };
  }

  hitHero(amount: number, now: number, hitId: string, random: () => number = Math.random): CombatEvent[] {
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
      if (!this.cooldownRemaining('cicada', now) && random() < this.config.cicada.chance) {
        this.hero.health = Math.max(1, Math.ceil(this.hero.maxHealth * this.config.cicada.restoredHealthRatio));
        this.cooldowns.set('cicada', now + this.config.cicada.cooldownMs);
        events.push({ type: 'resurrect', targetId: 'hero', x: this.hero.x, y: this.hero.y });
      } else {
        this.hero.health = 0; this.hero.alive = false;
        this.effects.clear(); this.barrier = null; this.empowerUntil = 0; this.speedBonusUntil = 0;
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
    this.selectedId = null; this.projectiles.length = 0; return true;
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
    const packAlert = [...this.enemies.values()].some(enemy => enemy.alive && this.agentBrains.get(enemy.id)?.traits.pack
      && distance(enemy, this.hero) <= this.enemyStats.get(enemy.id)!.aggroRange) ? { x: this.hero.x, y: this.hero.y } : null;
    const packLosses = [...this.enemies.values()].filter(enemy => !enemy.alive && this.agentBrains.get(enemy.id)?.traits.pack).length;
    for (const enemy of this.enemies.values()) {
      if (!enemy.alive) continue;
      if (enemy.blindedUntil !== undefined && now < enemy.blindedUntil) continue;
      const stats = this.enemyStats.get(enemy.id)!; const brain = this.agentBrains.get(enemy.id)!;
      const decision = brain.decide(now, { self: enemy, home: this.enemyHomes.get(enemy.id)!, healthRatio: enemy.health / enemy.maxHealth,
        player: this.hero, packAlert: brain.traits.pack ? packAlert : null, alliesFallen: brain.traits.pack ? packLosses : 0 });
      if (decision.action === 'attack' || decision.action === 'chase') this.engage(now);
      if (decision.action === 'attack') {
        if (now - enemy.lastAttackAt < stats.attackCooldownMs) continue;
        enemy.lastAttackAt = now; const strike = this.hitHero(stats.damage, now, `${enemy.id}:${now}`); events.push(...strike);
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
      const nx = enemy.x + (target.x - enemy.x) / gap * step, ny = enemy.y + (target.y - enemy.y) / gap * step;
      if (isFree(nx, ny)) { enemy.x = nx; enemy.y = ny; } else brain.stop();
    }
    return events;
  }

  /** Exposto para a UI mostrar que uma defesa temporária foi aplicada. */
  applyBarrier(id: GuId, amount: number, durationMs: number, now: number): void {
    const label = `${GU_CATALOG[id].label}: barreira`;
    if (!positive(amount)) return;
    if (!this.barrier || this.barrier.amount < amount) {
      this.barrier = { amount, expiresAt: now + durationMs, source: id, label };
    }
  }
}
