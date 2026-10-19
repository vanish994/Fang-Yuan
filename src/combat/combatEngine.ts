import { COMBAT_CONFIG, GU_CATALOG, GU_SLOTS, STARTING_EQUIPMENT, type CombatSettings } from './combatConfig';
import type { ActionResult, CombatEvent, Direction, Enemy, GuId, GuSlot, Point } from './types';

const vectors: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const deny = (reason: string): ActionResult => ({ ok: false, reason, events: [] });

interface Projectile {
  x: number; y: number; direction: Direction; traveled: number; hit: Set<string>;
}

/** Regras independentes de Phaser, de sprites e da camada visual. Tempos em milissegundos. */
export class CombatEngine {
  readonly enemies = new Map<string, Enemy>();
  readonly equipment: Record<GuSlot, GuId | null> = { ...STARTING_EQUIPMENT };
  // Apenas para experimentar os slots no protótipo; não equivale a obtenção na história.
  readonly testInventory = new Set<GuId>(Object.keys(GU_CATALOG) as GuId[]);
  readonly hero: Point & { health: number; maxHealth: number; alive: boolean };
  essence: number;
  selectedId: string | null = null;
  autoTarget = false;
  combatUntil = 0;
  speedBonusUntil = 0;
  private readonly cooldowns = new Map<string, number>();
  private readonly projectiles: Projectile[] = [];
  private readonly processedHits = new Set<string>();
  private readonly recentHits: string[] = [];
  private readonly processedRewards = new Set<string>();

  constructor(readonly config: CombatSettings = COMBAT_CONFIG, x = 0, y = 0) {
    this.hero = { x, y, health: config.hero.maxHealth, maxHealth: config.hero.maxHealth, alive: true };
    this.essence = config.hero.maxEssence;
  }

  addEnemy(id: string, x: number, y: number, health = this.config.enemy.maxHealth): Enemy {
    if (this.enemies.has(id)) throw new Error(`Inimigo duplicado: ${id}`);
    const enemy: Enemy = { id, x, y, health, maxHealth: health,
      defense: this.config.enemy.defense, alive: true, rewarded: false, lastAttackAt: -Infinity };
    this.enemies.set(id, enemy);
    return enemy;
  }

  get defense(): number {
    return this.config.hero.defense + (this.equipment.passive === 'stone-skin' ? this.config.stoneSkin.defenseBonus : 0);
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
    this.selectedId = id;
    return true;
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
    this.equipment[slot] = id;
    return { ok: true, events: [] };
  }

  private damageEnemy(enemy: Enemy, amount: number, now: number): CombatEvent[] {
    if (!enemy.alive) return [];
    const damage = Math.min(enemy.health, Math.max(1, Math.floor(amount - enemy.defense)));
    enemy.health -= damage;
    this.engage(now);
    const events: CombatEvent[] = [{ type: 'damage', targetId: enemy.id, amount: damage, x: enemy.x, y: enemy.y }];
    if (enemy.health <= 0) {
      enemy.alive = false;
      if (this.selectedId === enemy.id) this.selectedId = null;
      events.push({ type: 'defeat', targetId: enemy.id, x: enemy.x, y: enemy.y });
      if (!enemy.rewarded && !this.processedRewards.has(enemy.id)) {
        enemy.rewarded = true;
        this.processedRewards.add(enemy.id);
        events.push({ type: 'reward', targetId: enemy.id, stoneReward: this.config.enemy.lootStones,
          materialId: this.config.enemy.lootMaterialId,
          materialQuantity: this.config.enemy.lootMaterialQuantity });
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
    return { ok: true, events: this.damageEnemy(enemy, this.config.basic.damage, now) };
  }

  castMoonlight(now: number, direction: Direction): ActionResult {
    if (!this.hero.alive || this.equipment.attack !== 'moonlight') return deny('Gu da Lua não equipado.');
    if (this.cooldownRemaining('moonlight', now)) return deny('Gu da Lua em recarga.');
    if (this.essence < this.config.moonlight.essenceCost) return deny('Essência primordial insuficiente.');
    this.essence -= this.config.moonlight.essenceCost;
    this.cooldowns.set('moonlight', now + this.config.moonlight.cooldownMs);
    this.engage(now);
    this.projectiles.push({ x: this.hero.x, y: this.hero.y - 12, traveled: 0, direction, hit: new Set() });
    return { ok: true, events: [{ type: 'moonlight', x: this.hero.x, y: this.hero.y - 12 }] };
  }

  /** Movimento instantâneo pelo corredor livre, sem atravessar floresta ou acumular bônus. */
  dash(now: number, direction: Direction, isFree: (x: number, y: number) => boolean): ActionResult {
    if (!this.hero.alive || this.equipment.movement !== 'whirlwind') return deny('Equipe o Gu de movimento.');
    if (this.cooldownRemaining('dash', now)) return deny('Dash em recarga.');
    if (this.essence < this.config.movement.essenceCost) return deny('Essência primordial insuficiente.');
    const v = vectors[direction];
    let traveled = 0;
    for (let d = 4; d <= this.config.movement.distance; d += 4) {
      if (!isFree(this.hero.x + v.x * d, this.hero.y + v.y * d)) break;
      traveled = d;
    }
    if (traveled === 0) return deny('Caminho bloqueado.');
    const from = { ...this.hero };
    this.hero.x += v.x * traveled;
    this.hero.y += v.y * traveled;
    this.essence -= this.config.movement.essenceCost;
    this.cooldowns.set('dash', now + this.config.movement.cooldownMs);
    this.speedBonusUntil = now + this.config.movement.speedBonusMs;
    this.engage(now);
    return { ok: true, events: [{ type: 'dash', x: from.x, y: from.y }] };
  }

  /** Mesmo golpe letal, mesma ID: processado no máximo uma vez, inclusive na ressurreição. */
  hitHero(amount: number, now: number, hitId: string, random: () => number = Math.random): CombatEvent[] {
    if (!this.hero.alive || this.processedHits.has(hitId)) return [];
    this.processedHits.add(hitId);
    this.recentHits.push(hitId);
    if (this.recentHits.length > 512) this.processedHits.delete(this.recentHits.shift()!);
    const damage = Math.min(this.hero.health, Math.max(1, Math.floor(amount - this.defense)));
    this.hero.health -= damage;
    this.engage(now);
    const events: CombatEvent[] = [{ type: 'damage', targetId: 'hero', amount: damage, x: this.hero.x, y: this.hero.y }];
    if (this.hero.health <= 0) {
      if (!this.cooldownRemaining('cicada', now) && random() < this.config.cicada.chance) {
        this.hero.health = Math.max(1, Math.ceil(this.hero.maxHealth * this.config.cicada.restoredHealthRatio));
        this.cooldowns.set('cicada', now + this.config.cicada.cooldownMs);
        events.push({ type: 'resurrect', targetId: 'hero', x: this.hero.x, y: this.hero.y });
      } else {
        this.hero.health = 0;
        this.hero.alive = false;
        events.push({ type: 'hero-death', targetId: 'hero', x: this.hero.x, y: this.hero.y });
      }
    }
    return events;
  }

  /** Fluxo provisório de retorno; penalidade por morte ainda não tem valor aprovado. */
  respawn(x: number, y: number): boolean {
    if (this.hero.alive) return false;
    this.hero.x = x; this.hero.y = y;
    this.hero.health = this.hero.maxHealth;
    this.hero.alive = true;
    this.combatUntil = 0;
    this.speedBonusUntil = 0;
    this.selectedId = null;
    this.projectiles.length = 0;
    return true;
  }

  tick(now: number, deltaMs: number, isFree: (x: number, y: number) => boolean = () => true): CombatEvent[] {
    const dt = Math.max(0, Math.min(deltaMs, 100)) / 1000;
    if (this.hero.alive) this.essence = Math.min(this.config.hero.maxEssence, this.essence + this.essenceRegen * dt);
    const events: CombatEvent[] = [];
    // Varredura de segmento: hitbox mecânica não depende do frame desenhado.
    for (const projectile of [...this.projectiles]) {
      const v = vectors[projectile.direction];
      const desired = Math.min(this.config.moonlight.speed * dt, this.config.moonlight.range - projectile.traveled);
      let step = desired;
      let blocked = false;
      for (let d = 4; d <= desired + 3; d += 4) {
        const sample = Math.min(d, desired);
        if (!isFree(projectile.x + v.x * sample, projectile.y + 12 + v.y * sample)) {
          step = Math.max(0, sample - 4); blocked = true; break;
        }
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
        projectile.hit.add(enemy.id);
        events.push(...this.damageEnemy(enemy, this.config.moonlight.damage, now));
        if (enemy.alive) { stopped = true; break; } // Cadáver atravessado; primeiro sobrevivente bloqueia.
      }
      projectile.x += v.x * step; projectile.y += v.y * step; projectile.traveled += step;
      if (stopped || blocked || projectile.traveled >= this.config.moonlight.range) {
        this.projectiles.splice(this.projectiles.indexOf(projectile), 1);
      }
    }
    if (!this.hero.alive) return events;
    for (const enemy of this.enemies.values()) {
      if (!enemy.alive || distance(enemy, this.hero) > this.config.enemy.aggroRange) continue;
      this.engage(now);
      const gap = distance(enemy, this.hero);
      if (gap > this.config.enemy.attackRange) {
        const move = Math.min(this.config.enemy.speed * dt, gap - this.config.enemy.attackRange);
        const nx = enemy.x + (this.hero.x - enemy.x) / gap * move;
        const ny = enemy.y + (this.hero.y - enemy.y) / gap * move;
        if (isFree(nx, ny)) { enemy.x = nx; enemy.y = ny; }
      } else if (now - enemy.lastAttackAt >= this.config.enemy.attackCooldownMs) {
        enemy.lastAttackAt = now;
        const strike = this.hitHero(this.config.enemy.damage, now, `${enemy.id}:${now}`);
        events.push(...strike);
        if (strike.some(event => event.type === 'resurrect' || event.type === 'hero-death')) break;
      }
    }
    return events;
  }
}
