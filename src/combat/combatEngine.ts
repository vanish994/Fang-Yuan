import { COMBAT_CONFIG, GU_CATALOG, GU_SLOTS, STARTING_EQUIPMENT, type CombatSettings } from './combatConfig';
import type { ActionResult, CombatEvent, Direction, Enemy, GuId, GuSlot, Point } from './types';
import { AgentBrain } from '../agents/agentBrain';
import type { MobDefinition } from './mobCatalog';
import type { CultivationState } from '../entities/cultivation';
import { CharacterCultivation } from '../entities/characterCultivation';
import { cultivationCombatStats, type CultivationCombatStats } from '../entities/cultivationCombat';
import { mitigatedDamage } from './damageFormula';

const vectors: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const deny = (reason: string): ActionResult => ({ ok: false, reason, events: [] });

interface Projectile {
  x: number; y: number; direction: Direction; traveled: number; hit: Set<string>;
}

export class CombatEngine {
  readonly enemies = new Map<string, Enemy>();
  readonly equipment: Record<GuSlot, GuId | null> = { ...STARTING_EQUIPMENT };
  readonly testInventory = new Set<GuId>(Object.keys(GU_CATALOG) as GuId[]);
  readonly hero: Point & { health: number; maxHealth: number; alive: boolean };
  essence: number;
  selectedId: string | null = null;
  autoTarget = false;
  combatUntil = 0;
  speedBonusUntil = 0;
  private cultivationStats: CultivationCombatStats;
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

  constructor(readonly config: CombatSettings = COMBAT_CONFIG, x = 0, y = 0,
    cultivation?: CultivationState) {
    this.cultivationStats = cultivationCombatStats(cultivation ?? { rank: 1, stage: 'Inicial', spiritStones: 0, materials: {} });
    this.hero = { x, y, health: this.cultivationStats.maxHealth, maxHealth: this.cultivationStats.maxHealth, alive: true };
    this.essence = this.cultivationStats.maxEssence;
    this.unsubscribeCultivation = CharacterCultivation.subscribe(state => this.applyCultivation(state));
  }

  applyCultivation(state: CultivationState): void {
    const previousRatio = this.hero.maxHealth > 0 ? this.hero.health / this.hero.maxHealth : 1;
    this.cultivationStats = cultivationCombatStats(state);
    this.hero.maxHealth = this.cultivationStats.maxHealth;
    this.hero.health = this.hero.alive
      ? Math.max(1, Math.min(this.hero.maxHealth, Math.round(this.hero.maxHealth * previousRatio)))
      : 0;
    this.essence = Math.min(this.cultivationStats.maxEssence, this.essence);
  }

  destroy(): void { this.unsubscribeCultivation(); }
  get attack(): number { return this.cultivationStats.attack; }
  get moonlightDamage(): number { return Math.max(this.config.moonlight.damage, Math.round(this.attack * (26 / 14))); }

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

  get defense(): number {
    return this.cultivationStats.defense + (this.equipment.passive === 'stone-skin' ? this.config.stoneSkin.defenseBonus : 0);
  }
  get essenceRegen(): number {
    return this.config.hero.baseEssenceRegenPerSecond +
      (this.equipment.support === 'liquor-worm' ? this.config.liquorWorm.bonusEssenceRegenPerSecond : 0);
  }
  get activeProjectiles(): readonly Readonly<Projectile>[] { return this.projectiles; }
  cooldownRemaining(id: string, now: number): number { return Math.max(0, (this.cooldowns.get(id) ?? 0) - now); }
  inCombat(now: number): boolean { return this.hero.alive && now < this.combatUntil; }
  speedMultiplier(now: number): number { return now < this.speedBonusUntil ? this.config.movement.speedMultiplier : 1; }
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

  equip(slot: GuSlot, id: GuId | null, now: number): ActionResult {
    if (!this.hero.alive || this.inCombat(now)) return deny('Troca bloqueada durante o combate.');
    if (!GU_SLOTS.includes(slot) || (id && (!this.testInventory.has(id) || GU_CATALOG[id]?.slot !== slot)))
      return deny('Gu incompatível ou indisponível.');
    if (id && Object.entries(this.equipment).some(([key, value]) => key !== slot && value === id))
      return deny('Gu já equipado.');
    this.equipment[slot] = id; return { ok: true, events: [] };
  }

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
    return { ok: true, events: this.damageEnemy(enemy, this.attack, now) };
  }

  castMoonlight(now: number, direction: Direction): ActionResult {
    if (!this.hero.alive || this.equipment.attack !== 'moonlight') return deny('Gu da Lua não equipado.');
    if (this.cooldownRemaining('moonlight', now)) return deny('Gu da Lua em recarga.');
    if (this.essence < this.config.moonlight.essenceCost) return deny('Essência primordial insuficiente.');
    this.essence -= this.config.moonlight.essenceCost;
    this.cooldowns.set('moonlight', now + this.config.moonlight.cooldownMs);
    this.engage(now); this.projectiles.push({ x: this.hero.x, y: this.hero.y - 12, traveled: 0, direction, hit: new Set() });
    return { ok: true, events: [{ type: 'moonlight', x: this.hero.x, y: this.hero.y - 12 }] };
  }

  dash(now: number, direction: Direction, isFree: (x: number, y: number) => boolean): ActionResult {
    if (!this.hero.alive || this.equipment.movement !== 'whirlwind') return deny('Equipe o Gu de movimento.');
    if (this.cooldownRemaining('dash', now)) return deny('Dash em recarga.');
    if (this.essence < this.config.movement.essenceCost) return deny('Essência primordial insuficiente.');
    const v = vectors[direction]; let traveled = 0;
    for (let d = 4; d <= this.config.movement.distance; d += 4) {
      if (!isFree(this.hero.x + v.x * d, this.hero.y + v.y * d)) break; traveled = d;
    }
    if (traveled === 0) return deny('Caminho bloqueado.');
    const from = { ...this.hero }; this.hero.x += v.x * traveled; this.hero.y += v.y * traveled;
    this.essence -= this.config.movement.essenceCost; this.cooldowns.set('dash', now + this.config.movement.cooldownMs);
    this.speedBonusUntil = now + this.config.movement.speedBonusMs; this.engage(now);
    return { ok: true, events: [{ type: 'dash', x: from.x, y: from.y }] };
  }

  hitHero(amount: number, now: number, hitId: string, random: () => number = Math.random): CombatEvent[] {
    if (!this.hero.alive || this.processedHits.has(hitId)) return [];
    this.processedHits.add(hitId); this.recentHits.push(hitId);
    if (this.recentHits.length > 512) this.processedHits.delete(this.recentHits.shift()!);
    const damage = Math.min(this.hero.health, mitigatedDamage(amount, this.defense));
    this.hero.health -= damage; this.engage(now);
    const events: CombatEvent[] = [{ type: 'damage', targetId: 'hero', amount: damage, x: this.hero.x, y: this.hero.y }];
    if (this.hero.health <= 0) {
      if (!this.cooldownRemaining('cicada', now) && random() < this.config.cicada.chance) {
        this.hero.health = Math.max(1, Math.ceil(this.hero.maxHealth * this.config.cicada.restoredHealthRatio));
        this.cooldowns.set('cicada', now + this.config.cicada.cooldownMs);
        events.push({ type: 'resurrect', targetId: 'hero', x: this.hero.x, y: this.hero.y });
      } else { this.hero.health = 0; this.hero.alive = false; events.push({ type: 'hero-death', targetId: 'hero', x: this.hero.x, y: this.hero.y }); }
    }
    return events;
  }

  respawn(x: number, y: number): boolean {
    if (this.hero.alive) return false;
    this.hero.x = x; this.hero.y = y; this.hero.health = this.hero.maxHealth; this.essence = this.cultivationStats.maxEssence;
    this.hero.alive = true; this.combatUntil = 0; this.speedBonusUntil = 0; this.selectedId = null; this.projectiles.length = 0; return true;
  }

  tick(now: number, deltaMs: number, isFree: (x: number, y: number) => boolean = () => true): CombatEvent[] {
    const dt = Math.max(0, Math.min(deltaMs, 100)) / 1000;
    if (this.hero.alive) this.essence = Math.min(this.cultivationStats.maxEssence, this.essence + this.essenceRegen * dt);
    const events: CombatEvent[] = [];
    for (const projectile of [...this.projectiles]) {
      const v = vectors[projectile.direction];
      const desired = Math.min(this.config.moonlight.speed * dt, this.config.moonlight.range - projectile.traveled);
      let step = desired; let blocked = false;
      for (let d = 4; d <= desired + 3; d += 4) {
        const sample = Math.min(d, desired);
        if (!isFree(projectile.x + v.x * sample, projectile.y + 12 + v.y * sample)) { step = Math.max(0, sample - 4); blocked = true; break; }
      }
      const hits = [...this.enemies.values()].filter(enemy => enemy.alive && !projectile.hit.has(enemy.id))
        .map(enemy => {
          const along = (enemy.x - projectile.x) * v.x + (enemy.y - 12 - projectile.y) * v.y;
          const cross = Math.abs((enemy.x - projectile.x) * v.y - (enemy.y - 12 - projectile.y) * v.x);
          return { enemy, along, cross };
        })
        .filter(hit => hit.along >= -8 && hit.along <= step + 8 && hit.cross <= this.config.moonlight.width / 2 + 10)
        .sort((a, b) => a.along - b.along || a.enemy.id.localeCompare(b.enemy.id));
      let stopped = false;
      for (const { enemy } of hits) {
        projectile.hit.add(enemy.id); events.push(...this.damageEnemy(enemy, this.moonlightDamage, now));
        if (enemy.alive) { stopped = true; break; }
      }
      projectile.x += v.x * step; projectile.y += v.y * step; projectile.traveled += step;
      if (stopped || blocked || projectile.traveled >= this.config.moonlight.range) this.projectiles.splice(this.projectiles.indexOf(projectile), 1);
    }
    if (!this.hero.alive) return events;
    const packAlert = [...this.enemies.values()].some(enemy => enemy.alive && this.agentBrains.get(enemy.id)?.traits.pack
      && distance(enemy, this.hero) <= this.enemyStats.get(enemy.id)!.aggroRange) ? { x: this.hero.x, y: this.hero.y } : null;
    const packLosses = [...this.enemies.values()].filter(enemy => !enemy.alive && this.agentBrains.get(enemy.id)?.traits.pack).length;
    for (const enemy of this.enemies.values()) {
      if (!enemy.alive) continue;
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
}
