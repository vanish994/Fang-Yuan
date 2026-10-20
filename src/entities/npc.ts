import type { Direction, Point } from '../combat/types';
import { AgentBrain } from '../agents/agentBrain';

export type NpcRole = 'merchant' | 'villager' | 'cultivator' | 'guard' | 'disciple' | 'elder' | 'patriarch';
export type NpcState = 'idle' | 'wander' | 'alert';

/** Dados do protótipo, inclusive números e falas: não representam cânone ou comércio aprovado. */
export interface NpcDefinition {
  id: string; name: string; role: NpcRole; x: number; y: number;
  /** Primeira fala da conversa (texto de teste inspirado na novela, ver docs/DIALOGOS-NPC.md). */
  dialogue: string;
  /** Falas seguintes, em ciclo; ausente quando o NPC só tem a fala inicial. */
  dialogues?: readonly string[];
  wanderRadius: number; rank: string; health: number; defense: number;
  /** Metadados locais de layout, não biografia/facção canônica. */
  faction?: string; routine?: readonly Point[];
}
export interface NpcIntent { direction: Direction | null; state: NpcState }

/** Todas as falas do NPC, na ordem em que aparecem; a primeira é sempre `dialogue`. */
export function npcLines(definition: Readonly<NpcDefinition>): readonly string[] {
  return [definition.dialogue, ...(definition.dialogues ?? [])];
}

/** Conversa `talks` (1 = primeira) em ciclo; entradas inválidas caem na primeira fala. */
export function npcLine(definition: Readonly<NpcDefinition>, talks: number): string {
  const lines = npcLines(definition);
  const step = Number.isFinite(talks) ? Math.max(1, Math.floor(talks)) : 1;
  return lines[(step - 1) % lines.length]!;
}

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
  private talks = 0;

  constructor(definition: Readonly<NpcDefinition>) {
    this.definition = { ...definition };
    this.home = { x: definition.x, y: definition.y };
    this.current = { ...this.home };
  }

  get position(): Point { return { ...this.current }; }
  /** Quantas conversas já aconteceram; a próxima usa `npcLine(definition, conversations + 1)`. */
  get conversations(): number { return this.talks; }
  /** Fala da conversa mais recente; antes da primeira, a de apresentação. */
  get line(): string { return npcLine(this.definition, Math.max(1, this.talks)); }
  interact(now: number): void { this.talks += 1; this.agent.interact(now); }

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
  rank: string, health: number, defense: number, dialogue: string, wanderRadius = 64,
  dialogues: readonly string[] = []): Readonly<NpcDefinition> =>
  ({ id, name, role, x: x * 32, y: y * 32, rank, health, defense, dialogue, wanderRadius,
    ...(dialogues.length ? { dialogues } : {}) });

/**
 * Elenco proposto para testes; NPCs não podem ser atacados nem comerciam nesta versão.
 * Falas inspiradas em fatos da novela (Gu Yue, Qing Mao Mountain, cerimônia do despertar,
 * Gu Luar-da-Lua, pedras primárias, facções Chi e Mo); trechos de clima e opinião são
 * adaptação de teste, não citação. Base e ressalvas em docs/DIALOGOS-NPC.md.
 */
export const TEST_NPCS: readonly Readonly<NpcDefinition>[] = [
  npc('npc-gu-yue-mei', 'Gu Yue Mei', 'villager', 22, 25, 'Mortal', 40, 1,
    'A vila parece tranquila hoje... por enquanto.', 64, [
      'As orquídeas-da-lua florescem antes da cerimônia do despertar. Bonitas demais para uma flor que alimenta Gu.',
      'Meu pai era guarda. Ele dizia que a floresta fica quieta demais pouco antes de uma onda de lobos.',
    ]),
  npc('npc-lin-shan', 'Lin Shan', 'cultivator', 26.75, 24.5, '1 · Inicial', 75, 4,
    'Cultivar é saber quando avançar e quando esperar.', 80, [
      'A Gu Luar-da-Lua vira uma meia-lua na palma. Todos aprendem a lançar; poucos, a economizar essência.',
      'Cada gota de essência primária custa um dia de cultivo. Gaste com o inimigo, nunca com a pressa.',
    ]),
  npc('npc-zhao-he', 'Zhao He', 'merchant', 23, 26, '1', 55, 2,
    'Tenho materiais de cultivo. Os melhores não ficam baratos.', 48, [
      'Pétalas de orquídea-da-lua, duas por refeição, de manhã e à noite. Criar Gu é como criar esposa: custa todo dia.',
      'Pedra primária vale mais que elogio por aqui. Guarde as suas, que eu aceito quando sobrarem.',
    ]),
  npc('npc-old-chen', 'Velho Chen', 'guard', 25.75, 24, '1', 90, 5,
    'Não se afaste demais da vila. A floresta não perdoa distraídos.', 56, [
      'A cada três anos os lobos descem em matilha. Muro, lança e paciência: é disso que esta vila vive.',
      'Já vi jovem Gu Master morrer achando que uma lâmina de luar resolvia tudo. Você pretende andar sozinho?',
    ]),
  npc('npc-gu-yue-lan', 'Gu Yue Lan', 'disciple', 20, 21, '1', 65, 3,
    'Preciso voltar aos meus estudos. O instrutor cobra a lâmina de luar de cada discípulo.', 64, [
      'Acertei o boneco de palha três vezes ontem. A Gu Luar-da-Lua é a primeira de todo discípulo da Gu Yue.',
      'Na cerimônia do despertar contam seus passos entre as orquídeas. Eu mal cheguei ao grau C.',
    ]),
  npc('npc-gu-yue-fang', 'Gu Yue Fang', 'disciple', 29, 21, '1', 70, 4,
    'Ainda há muito a aprender — mas já sei de cor a meia-lua na palma do instrutor.', 64, [
      'Quem refinar a Gu Luar-da-Lua primeiro leva vinte pedras primárias. Estou a duas noites disso.',
      'Os Chi e os Mo dividem os corredores da academia. Melhor estudar do que escolher lado.',
    ]),
  npc('npc-aunt-hua', 'Tia Hua', 'merchant', 17, 30, 'Mortal', 50, 1,
    'A banca está aberta, meu bem. O que você trouxe da floresta?', 48, [
      'Pétalas e vinho de bambu verde. Tem Gu nesta vila que come melhor do que muita gente.',
      'Os anciãos se cumprimentam com sorrisos e partem a academia em dois. Eu só vendo comida e escuto.',
    ]),
  npc('npc-gu-yue-bo', 'Gu Yue Bo', 'patriarch', 24, 20, '4', 800, 30,
    'A vila está de pé. Enquanto eu respirar, continuará assim.', 32, [
      'Assumi a liderança no Rank 4 e nele continuei. Um líder não tem tempo de cultivar — e é assim que nos querem.',
      'Três clãs dividem esta montanha, e a Gu Yue é a primeira. É por isso que todos os olhos estão em nós.',
    ]),
  npc('npc-gu-yue-chi-lian', 'Gu Yue Chi Lian', 'elder', 32, 30, '3', 500, 22,
    'Cautela antes de decidir. Depois de decidir, nenhuma hesitação.', 40, [
      'Há quem conte os passos dos jovens na cerimônia como se fossem dívidas. Eu conto.',
      'Minha família construiu metade da academia. Quando tiver poder, lembre-se de quem o recebeu de pé.',
      'Meu neto tem talento. Se alguém disser o contrário, que venha dizer na minha frente.',
    ]),
  npc('npc-gu-yue-mo-bei', 'Gu Yue Mo Bei', 'disciple', 20, 30, '2', 180, 10,
    'Vamos nos encontrar outra hora. Tenho uma lâmina de luar para afiar.', 32, [
      'Meu avô Mo Chen comanda os corredores da academia e não aceita menos que Rank 2 de mim.',
      'Chi Chen fala alto porque o avô é ancião. Eu prefiro falar com as mãos e uma Gu bem criada.',
    ]),
];
