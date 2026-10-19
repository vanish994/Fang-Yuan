import type { Direction, Point } from '../combat/types';

export type NpcRole = 'merchant' | 'villager' | 'cultivator' | 'guard';
export type NpcState = 'idle' | 'wander' | 'alert';

export interface NpcDefinition {
  id: string;
  name: string;
  role: NpcRole;
  x: number;
  y: number;
  dialogue: string;
  wanderRadius: number;
}

export interface NpcIntent {
  direction: Direction | null;
  state: NpcState;
}

/**
 * Brain determinístico temporário para NPCs.
 * Não conhece Phaser: só decide o próximo pequeno deslocamento.
 * Depois pode ser substituído por utility AI/LLM sem trocar a camada visual.
 */
export class NpcBrain {
  readonly definition: NpcDefinition;
  private state: NpcState = 'idle';
  private direction: Direction | null = null;
  private nextDecisionAt = 0;
  private pauseUntil = 0;

  constructor(definition: NpcDefinition) {
    this.definition = definition;
  }

  get position(): Point {
    return { x: this.definition.x, y: this.definition.y };
  }

  decide(now: number, random = Math.random): NpcIntent {
    if (now < this.pauseUntil) return { direction: null, state: this.state };
    if (now < this.nextDecisionAt) return { direction: this.direction, state: this.state };

    this.nextDecisionAt = now + 900 + random() * 1700;
    if (random() < 0.28) {
      this.state = 'idle';
      this.direction = null;
      this.pauseUntil = now + 700 + random() * 1800;
      return { direction: null, state: this.state };
    }

    this.state = 'wander';
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    this.direction = directions[Math.floor(random() * directions.length)]!;
    return { direction: this.direction, state: this.state };
  }

  stop(): void {
    this.direction = null;
    this.state = 'idle';
  }
}

export const TEST_NPCS: readonly NpcDefinition[] = [
  {
    id: 'npc-gu-yue-mei', name: 'Gu Yue Mei', role: 'villager',
    x: 22 * 32, y: 20 * 32, dialogue: 'A vila parece tranquila hoje... por enquanto.', wanderRadius: 64,
  },
  {
    id: 'npc-lin-shan', name: 'Lin Shan', role: 'cultivator',
    x: 27 * 32, y: 21 * 32, dialogue: 'Cultivar é saber quando avançar e quando esperar.', wanderRadius: 80,
  },
  {
    id: 'npc-zhao-he', name: 'Zhao He', role: 'merchant',
    x: 20 * 32, y: 27 * 32, dialogue: 'Tenho materiais de cultivo. Os melhores não ficam baratos.', wanderRadius: 48,
  },
  {
    id: 'npc-old-chen', name: 'Velho Chen', role: 'guard',
    x: 28 * 32, y: 28 * 32, dialogue: 'Não se afaste demais da vila. A floresta não perdoa distraídos.', wanderRadius: 56,
  },
];
