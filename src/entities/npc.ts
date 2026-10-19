import type { Direction, Point } from '../combat/types';
import { AgentBrain } from '../agents/agentBrain';

export type NpcRole = 'merchant' | 'villager' | 'cultivator' | 'guard' | 'disciple' | 'elder' | 'patriarch';
export type NpcState = 'idle' | 'wander' | 'alert';

/** Dados do protótipo, inclusive números e falas: não representam cânone ou comércio aprovado. */
export interface NpcDefinition {
  id: string; name: string; role: NpcRole; x: number; y: number;
  dialogue: string; wanderRadius: number; rank: string; health: number; defense: number;
  /** Metadados locais de layout, não biografia/facção canônica. */
  faction?: string; routine?: readonly Point[];
}
export interface NpcIntent { direction: Direction | null; state: NpcState }

const VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

/** Estado local de movimento; decisões/percepção/memória vêm do mesmo AgentBrain das criaturas. */
export class NpcBrain {
  readonly definition: Readonly<NpcDefinition>;
  readonly agent = new AgentBrain({ kind: 'npc', vision: 85, attackRange: 0,
    memoryMs: 30_000, fear: 0, pack: false });
  private readonly home: Point;
  private current: Point;

  constructor(definition: Readonly<NpcDefinition>) {
    this.definition = { ...definition };
    this.home = { x: definition.x, y: definition.y };
    this.current = { ...this.home };
  }

  get position(): Point { return { ...this.current }; }
  interact(now: number): void { this.agent.interact(now); }

  decide(now: number, random = Math.random, danger: Point | null = null): NpcIntent {
    const decision = this.agent.decide(now, { self: this.current, home: this.home,
      player: null, healthRatio: 1, danger }, random);
    if (decision.action === 'alert') return { direction: null, state: 'alert' };
    if (this.definition.routine?.length) {
      // Rota de teste ancorada no home; encontros continuam subordinados ao cérebro compartilhado.
      const goal = this.definition.routine[Math.floor(now / 20_000) % this.definition.routine.length]!;
      const dx = goal.x - this.current.x, dy = goal.y - this.current.y;
      const direction: Direction | null = Math.abs(dx) > 1 ? dx > 0 ? 'right' : 'left'
        : Math.abs(dy) > 1 ? dy > 0 ? 'down' : 'up' : null;
      return { direction, state: direction ? 'wander' : 'idle' };
    }
    return decision.action === 'wander' && decision.direction
      ? { direction: decision.direction, state: 'wander' } : { direction: null, state: 'idle' };
  }

  /** O raio é medido desde o spawn, nunca desde o último passo. */
  move(direction: Direction, distance: number, isFree: (x: number, y: number) => boolean): boolean {
    if (!Number.isFinite(distance) || distance <= 0) return false;
    const vector = VECTORS[direction];
    const next = { x: this.current.x + vector.x * distance, y: this.current.y + vector.y * distance };
    if (Math.hypot(next.x - this.home.x, next.y - this.home.y) > this.definition.wanderRadius
      || !isFree(next.x, next.y)) {
      this.stop();
      return false;
    }
    this.current = next;
    return true;
  }
  stop(): void { this.agent.stop(); }
}

const npc = (id: string, name: string, role: NpcRole, x: number, y: number,
  rank: string, health: number, defense: number, dialogue: string, wanderRadius = 64): Readonly<NpcDefinition> =>
  ({ id, name, role, x: x * 32, y: y * 32, rank, health, defense, dialogue, wanderRadius });

/** Elenco proposto para testes; NPCs não podem ser atacados nem comerciam nesta versão. */
export const TEST_NPCS: readonly Readonly<NpcDefinition>[] = [
  npc('npc-gu-yue-mei', 'Gu Yue Mei', 'villager', 22, 25, 'Mortal', 40, 1,
    'A vila parece tranquila hoje... por enquanto.'),
  npc('npc-lin-shan', 'Lin Shan', 'cultivator', 26.75, 24.5, '1 · Inicial', 75, 4,
    'Cultivar é saber quando avançar e quando esperar.', 80),
  npc('npc-zhao-he', 'Zhao He', 'merchant', 23, 26, '1', 55, 2,
    'Tenho materiais de cultivo. Os melhores não ficam baratos.', 48),
  npc('npc-old-chen', 'Velho Chen', 'guard', 25.75, 24, '1', 90, 5,
    'Não se afaste demais da vila. A floresta não perdoa distraídos.', 56),
  npc('npc-gu-yue-lan', 'Gu Yue Lan', 'disciple', 20, 21, '1', 65, 3,
    'Fala de teste: preciso voltar aos meus estudos.'),
  npc('npc-gu-yue-fang', 'Gu Yue Fang', 'disciple', 29, 21, '1', 70, 4,
    'Fala de teste: ainda há muito a aprender.'),
  npc('npc-aunt-hua', 'Tia Hua', 'merchant', 17, 30, 'Mortal', 50, 1,
    'Fala de teste: a banca está aberta.'),
  npc('npc-gu-yue-bo', 'Gu Yue Bo', 'patriarch', 24, 20, '4', 800, 30,
    'Fala de teste: a segurança da vila é importante.', 32),
  npc('npc-gu-yue-chi-lian', 'Gu Yue Chi Lian', 'elder', 32, 30, '3', 500, 22,
    'Fala de teste: cautela antes de decidir.', 40),
  npc('npc-gu-yue-mo-bei', 'Gu Yue Mo Bei', 'disciple', 20, 30, '2', 180, 10,
    'Fala de teste: vamos nos encontrar outra hora.'),
];
