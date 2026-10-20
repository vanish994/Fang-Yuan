import { GU_CATALOG } from './guCatalog';
import { distance, dominantDirection, travelFrom, vectors } from './geometry';
import { wildBehavior, wildBuffDuration, wildDamageBonus, wildHealAmount,
  wildProjectileDamage, wildProjectileRange, wildProjectileSpeed } from './wildGu';
import type { CombatEvent, Enemy, EnemyProjectile, Point } from './types';

/**
 * Habilidades das criaturas selvagens (Gu registrado no nascimento).
 *
 * Saiu do `CombatEngine` para poder ser testado sem sessão, save ou herói
 * completo: o motor injeta só o que a habilidade precisa (alvo, projéteis,
 * colisão de mapa e o registro de combate).
 */
export interface EnemyAbilityContext {
  /** Alvo atual; só a posição, a vida máxima e se está vivo importam. */
  hero: Point & { alive: boolean; maxHealth: number };
  /** Lista viva de projéteis inimigos; a função adiciona e remove dela. */
  shots: EnemyProjectile[];
  /** Colisão do mapa: nenhuma habilidade atravessa obstáculo. */
  isFree: (x: number, y: number) => boolean;
  /** Marca o herói em combate (bloqueia refino, ativa HUD). */
  engage: (now: number) => void;
}

/** Dano corpo a corpo corrigido pelo buff ativo do Gu selvagem. */
export function wildMeleeMultiplier(enemy: Enemy, now: number): number {
  const wild = enemy.wild;
  return 1 + (wild?.buffUntil && now < wild.buffUntil ? wild.damageBonus ?? 0 : 0);
}

/**
 * Usa o Gu registrado na criatura. O comportamento vem do catálogo, tem
 * recarga própria e nunca se repete a cada quadro. Criaturas cegas não agem
 * (o bloqueio é tratado no laço principal do motor).
 */
export function useWildGu(enemy: Enemy, now: number, ctx: EnemyAbilityContext): CombatEvent[] {
  const wild = enemy.wild;
  if (!wild) return [];
  const guId = wild.gu;
  const gu = GU_CATALOG[guId];
  const behavior = wildBehavior(gu);
  if (behavior.kind === 'passive') return [];
  // Uma pequena janela após o nascimento evita abrir a luta com o golpe especial.
  if (wild.nextAt === undefined) { wild.nextAt = now + 900; return []; }
  if (now < wild.nextAt) return [];
  if (!ctx.hero.alive) return [];
  const active = gu.active;
  if (!active) return [];
  const gap = distance(enemy, ctx.hero);
  const events: CombatEvent[] = [];
  const casts = wild.casts + 1;

  if (behavior.kind === 'projectile' && active.kind === 'projectile') {
    const range = wildProjectileRange(gu);
    if (gap > range || gap < 24) return [];
    // Mira no herói no instante do disparo. O projétil não corrige a rota
    // depois, então continua possível esquivar — mas deixa de ser inacertável
    // quando o alvo está fora do eixo cardeal.
    const originY = enemy.y - 10;
    const aimX = ctx.hero.x - enemy.x;
    const aimY = (ctx.hero.y - 12) - originY;
    const aimLength = Math.hypot(aimX, aimY) || 1;
    const damage = wildProjectileDamage(ctx.hero.maxHealth, active.damage);
    ctx.shots.push({
      enemyId: enemy.id, guId, x: enemy.x, y: originY,
      dx: aimX / aimLength, dy: aimY / aimLength,
      traveled: 0, range, speed: wildProjectileSpeed(gu),
      damage, hitId: `wild:${enemy.id}:${casts}`,
    });
    events.push({ type: 'enemy-ability', targetId: enemy.id, guId, x: enemy.x, y: enemy.y,
      amount: damage });
  } else if (behavior.kind === 'dash' && active.kind === 'dash') {
    if (gap < 36 || gap > 240) return [];
    const direction = dominantDirection(enemy, ctx.hero);
    const wanted = Math.min(active.distance, Math.max(0, gap - 30));
    const travel = travelFrom(enemy, direction, wanted, ctx.isFree);
    if (travel <= 0) return [];
    const v = vectors[direction];
    enemy.x += v.x * travel; enemy.y += v.y * travel;
    events.push({ type: 'enemy-ability', targetId: enemy.id, guId, x: enemy.x, y: enemy.y,
      amount: travel });
  } else if (behavior.kind === 'heal' && active.kind === 'heal') {
    if (enemy.health >= enemy.maxHealth * 0.6) return [];
    const healed = Math.min(wildHealAmount(enemy.maxHealth), enemy.maxHealth - enemy.health);
    if (healed <= 0) return [];
    enemy.health += healed;
    events.push({ type: 'enemy-ability', targetId: enemy.id, guId, x: enemy.x, y: enemy.y,
      amount: healed });
    events.push({ type: 'heal', targetId: enemy.id, amount: healed, guId,
      x: enemy.x, y: enemy.y });
  } else if (behavior.kind === 'buff' && (active.kind === 'buff' || active.kind === 'empower')) {
    if (gap > 200) return [];
    wild.damageBonus = wildDamageBonus(active);
    wild.buffUntil = now + wildBuffDuration(active);
    events.push({ type: 'enemy-ability', targetId: enemy.id, guId, x: enemy.x, y: enemy.y,
      amount: Math.round((wild.damageBonus ?? 0) * 100) });
  } else {
    return [];
  }

  wild.casts = casts;
  wild.nextAt = now + behavior.cooldownMs;
  ctx.engage(now);
  return events;
}

/** Acerta o herói (dano + efeitos) e devolve os eventos gerados. */
export type HeroHitResolver = (damage: number, now: number, hitId: string) => CombatEvent[];

/**
 * Move os projéteis inimigos e resolve os impactos. Corredor de 12 px de raio:
 * com mira vetorial o golpe acerta em qualquer ângulo e ainda exige
 * posicionamento para esquivar. O projétil some no alvo, na parede ou no fim
 * do alcance — nunca fica preso no mapa.
 */
export function stepEnemyProjectiles(shots: EnemyProjectile[], now: number, dt: number,
  ctx: { hero: Point; isFree: (x: number, y: number) => boolean; hitHero: HeroHitResolver }): CombatEvent[] {
  const events: CombatEvent[] = [];
  for (const shot of [...shots]) {
    const wanted = Math.min(shot.speed * dt, shot.range - shot.traveled);
    let step = wanted;
    for (let d = 4; d <= wanted; d += 4) {
      if (!ctx.isFree(shot.x + shot.dx * d, shot.y + shot.dy * d)) { step = Math.max(0, d - 4); break; }
    }
    const toHeroX = ctx.hero.x - shot.x;
    const toHeroY = (ctx.hero.y - 12) - shot.y;
    const along = toHeroX * shot.dx + toHeroY * shot.dy;
    const cross = Math.abs(toHeroX * shot.dy - toHeroY * shot.dx);
    const hit = cross <= 12 && along >= 0 && along <= step;
    shot.x += shot.dx * step; shot.y += shot.dy * step; shot.traveled += step;
    if (hit) {
      events.push(...ctx.hitHero(shot.damage, now, shot.hitId));
      shots.splice(shots.indexOf(shot), 1);
      continue;
    }
    if (step < wanted || shot.traveled >= shot.range) {
      shots.splice(shots.indexOf(shot), 1);
    }
  }
  return events;
}
