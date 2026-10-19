import type { Direction, Point } from '../combat/types';

export type AgentGoal = 'survive' | 'fight' | 'investigate' | 'alert' | 'roam';
export type AgentAction = 'idle' | 'wander' | 'investigate' | 'chase' | 'attack' | 'flee' | 'alert';
export interface AgentTraits {
  kind: 'npc' | 'enemy';
  vision: number;
  attackRange: number;
  memoryMs: number;
  fear: number; // fração de vida abaixo da qual a criatura prefere fugir; provisória
  pack: boolean;
}
export interface AgentPerception {
  self: Point;
  home: Point;
  healthRatio: number;
  player: Point | null;
  danger?: Point | null;
  packAlert?: Point | null;
  alliesFallen?: number;
}
export interface AgentDecision { goal: AgentGoal; action: AgentAction; target?: Point; direction?: Direction }

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Percepção: não enxerga além do raio; alertas de grupo não são visão direta. */
export function perceive(input: AgentPerception, traits: AgentTraits): Point | null {
  const target = traits.kind === 'npc' ? input.danger : input.player;
  return target && distance(input.self, target) <= traits.vision ? { ...target } : null;
}

/** Memória e objetivo são independentes de Phaser, animação e regras de dano. */
export class AgentBrain {
  readonly memory: { lastSeen: Point | null; seenAt: number; lastInteractionAt: number; reputation: number } = {
    lastSeen: null, seenAt: -Infinity, lastInteractionAt: -Infinity, reputation: 0,
  };
  private nextDecisionAt = 0;
  private pauseUntil = 0;
  private roamDirection: Direction | null = null;

  constructor(readonly traits: AgentTraits) {}

  interact(now: number): void { this.memory.lastInteractionAt = now; }

  decide(now: number, input: AgentPerception, random: () => number = Math.random): AgentDecision {
    const seen = perceive(input, this.traits);
    if (seen) { this.memory.lastSeen = seen; this.memory.seenAt = now; }
    else if (this.traits.pack && input.packAlert) {
      this.memory.lastSeen = { ...input.packAlert }; this.memory.seenAt = now;
    }
    const remembered = this.memory.lastSeen && now - this.memory.seenAt <= this.traits.memoryMs
      ? this.memory.lastSeen : null;

    if (this.traits.kind === 'enemy') {
      const fleeThreshold = Math.min(0.95, this.traits.fear + (input.alliesFallen ?? 0) * 0.1);
      if (seen && input.healthRatio < fleeThreshold) {
        const dx = input.self.x - seen.x, dy = input.self.y - seen.y;
        return { goal: 'survive', action: 'flee', target: {
          x: input.self.x + (dx || 1), y: input.self.y + dy,
        } };
      }
      if (seen && distance(input.self, seen) <= this.traits.attackRange)
        return { goal: 'fight', action: 'attack', target: seen };
      if (seen) return { goal: 'fight', action: 'chase', target: seen };
      if (remembered) return { goal: 'investigate', action: 'investigate', target: { ...remembered } };
    } else if (seen) {
      return { goal: 'alert', action: 'alert', target: seen };
    }

    if (now < this.pauseUntil) return { goal: 'roam', action: 'idle' };
    if (now >= this.nextDecisionAt) {
      this.nextDecisionAt = now + 900 + random() * 1700;
      if (random() < 0.28) {
        this.roamDirection = null;
        this.pauseUntil = now + 700 + random() * 1800;
        return { goal: 'roam', action: 'idle' };
      }
      const directions: Direction[] = ['up', 'down', 'left', 'right'];
      this.roamDirection = directions[Math.floor(random() * directions.length)]!;
    }
    return this.roamDirection ? { goal: 'roam', action: 'wander', direction: this.roamDirection }
      : { goal: 'roam', action: 'idle' };
  }

  stop(): void { this.roamDirection = null; }
}
