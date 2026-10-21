import type { Direction, Point } from '../combat/types';
import { AgentBrain } from '../agents/agentBrain';

export type NpcRole = 'merchant' | 'villager' | 'cultivator' | 'guard' | 'disciple' | 'elder' | 'patriarch';
export type NpcState = 'idle' | 'wander' | 'alert';

/** Estado atual do jogador que um NPC pode comentar; somente leitura, nada é salvo por isso. */
export interface NpcContext {
  /** Rank de cultivo do jogador (1–9). */
  rank: number;
  /** Estágio dentro do Rank atual. */
  stage: string;
  /** Pedras espirituais na bolsa. */
  spiritStones: number;
  /** Quantas das quatro Gu estão equipadas. */
  equippedGu: number;
}

/** Fala condicionada ao progresso do jogador; é comentário de teste, não missão ou recompensa. */
export interface NpcHint {
  line: string;
  /** Só aparece a partir deste Rank. */
  minRank?: number;
  /** Só aparece com pelo menos esta quantidade de pedras espirituais. */
  minStones?: number;
  /** Só aparece com pelo menos esta quantidade de Gu equipadas. */
  minEquippedGu?: number;
}

/** Dados do protótipo, inclusive números e falas: não representam cânone ou comércio aprovado. */
export interface NpcDefinition {
  id: string; name: string; role: NpcRole; x: number; y: number;
  /** Primeira fala da conversa (texto de teste inspirado na novela, ver docs/DIALOGOS-NPC.md). */
  dialogue: string;
  /** Falas seguintes, em ciclo; ausente quando o NPC só tem a fala inicial. */
  dialogues?: readonly string[];
  /** Reações ao progresso do jogador; cada uma é dita uma vez por sessão. */
  hints?: readonly NpcHint[];
  /** Rótulo de teste acima da cabeça marcando uma banca; comércio ainda não existe. */
  stall?: string;
  wanderRadius: number; rank: string; health: number; defense: number;
  /** Metadados locais de layout, não biografia/facção canônica. */
  faction?: string; routine?: readonly Point[];
}
export interface NpcIntent { direction: Direction | null; state: NpcState }

/** Todas as falas do NPC, na ordem em que aparecem; a primeira é sempre `dialogue`. */
export function npcLines(definition: Readonly<NpcDefinition>): readonly string[] {
  return [definition.dialogue, ...(definition.dialogues ?? [])];
}

/** Um hint se aplica quando todas as condições declaradas são satisfeitas. */
export function hintApplies(hint: Readonly<NpcHint>, context: Readonly<NpcContext>): boolean {
  return (hint.minRank === undefined || context.rank >= hint.minRank)
    && (hint.minStones === undefined || context.spiritStones >= hint.minStones)
    && (hint.minEquippedGu === undefined || context.equippedGu >= hint.minEquippedGu);
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
  private baseTalks = 0;
  private spoken: string | null = null;
  private readonly saidHints = new Set<number>();

  constructor(definition: Readonly<NpcDefinition>) {
    this.definition = { ...definition };
    this.home = { x: definition.x, y: definition.y };
    this.current = { ...this.home };
  }

  get position(): Point { return { ...this.current }; }
  /** Quantas conversas já aconteceram; a próxima usa `npcLine(definition, conversations + 1)`. */
  get conversations(): number { return this.talks; }
  /** Fala da conversa mais recente; antes da primeira, a de apresentação. */
  get line(): string { return this.spoken ?? this.definition.dialogue; }
  /** Hints já comentados nesta sessão, na ordem em que apareceram. */
  get hinted(): readonly number[] { return [...this.saidHints]; }

  /**
   * Registra a conversa e escolhe a fala: o primeiro hint aplicável que ainda não foi
   * dito tem prioridade; sem hint novo, o rodízio normal continua de onde parou.
   */
  interact(now: number, context?: Readonly<NpcContext>): void {
    this.talks += 1;
    this.agent.interact(now);
    const hints = this.definition.hints ?? [];
    const index = context
      ? hints.findIndex((hint, i) => !this.saidHints.has(i) && hintApplies(hint, context)) : -1;
    if (index >= 0) {
      this.saidHints.add(index);
      this.spoken = hints[index]!.line;
      return;
    }
    this.baseTalks += 1;
    this.spoken = npcLine(this.definition, this.baseTalks);
  }

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

interface NpcExtra {
  wanderRadius?: number;
  dialogues?: readonly string[];
  hints?: readonly NpcHint[];
  stall?: string;
}

const npc = (id: string, name: string, role: NpcRole, x: number, y: number,
  rank: string, health: number, defense: number, dialogue: string,
  extra: NpcExtra = {}): Readonly<NpcDefinition> => ({
  id, name, role, x: x * 32, y: y * 32, rank, health, defense, dialogue,
  wanderRadius: extra.wanderRadius ?? 64,
  ...(extra.dialogues?.length ? { dialogues: extra.dialogues } : {}),
  ...(extra.hints?.length ? { hints: extra.hints } : {}),
  ...(extra.stall ? { stall: extra.stall } : {}),
});

/**
 * Elenco proposto para testes; NPCs não podem ser atacados nem comerciam nesta versão.
 * Falas inspiradas em fatos da novela (Gu Yue, Qing Mao Mountain, cerimônia do despertar,
 * Gu Luar-da-Lua, pedras primárias, facções Chi e Mo); trechos de clima e opinião são
 * adaptação de teste, não citação. Os `hints` reagem ao Rank, às pedras e às Gu equipadas
 * do jogador, sem missão nem recompensa. Base e ressalvas em docs/DIALOGOS-NPC.md.
 */
export const TEST_NPCS: readonly Readonly<NpcDefinition>[] = [
  npc('npc-gu-yue-mei', 'Gu Yue Mei', 'villager', 22, 25, 'Mortal', 40, 1,
    'A vila parece tranquila hoje... por enquanto.', {
      dialogues: [
        'As orquídeas-da-lua florescem antes da cerimônia do despertar. Bonitas demais para uma flor que alimenta Gu.',
        'Meu pai era guarda. Ele dizia que a floresta fica quieta demais pouco antes de uma onda de lobos.',
      ],
      hints: [{
        minRank: 2,
        line: 'Agora que você é Rank 2, o bairro inteiro comenta quando você passa.',
      }],
    }),
  npc('npc-lin-shan', 'Lin Shan', 'cultivator', 26.75, 24.5, '1 · Inicial', 75, 4,
    'Cultivar é saber quando avançar e quando esperar.', {
      wanderRadius: 80,
      dialogues: [
        'A Gu Luar-da-Lua vira uma meia-lua na palma. Todos aprendem a lançar; poucos, a economizar essência.',
        'Cada gota de essência primária custa um dia de cultivo. Gaste com o inimigo, nunca com a pressa.',
      ],
      hints: [{
        minRank: 2,
        line: 'Sua essência mudou de cor. Verde-cobre vira vermelho-aço; o Rank 2 tem outro peso.',
      }],
    }),
  // Vendedor: Jiang Ya é o dono da loja do clã na novel (ao lado da Câmara de Gu).
  npc('npc-jiang-ya', 'Jiang Ya', 'merchant', 23, 26, '1', 55, 2,
    'Banca do clã. Pétalas de orquídea-da-lua, boneco de palha e o que a caravana deixar.', {
      wanderRadius: 48,
      stall: 'banca de Gu',
      dialogues: [
        'Todo discípulo compra pétala: a Gu Luar-da-Lua come duas por refeição, de manhã e à noite. Pétala não dura uma semana.',
        'Quem fixa preço é o clã, não o vendedor. Eu peso, conto e anoto — reclamar, só com o ancião.',
      ],
      hints: [{
        minRank: 2,
        line: 'Rank 2 já olha a prateleira de cima. O que vem da caravana chega caro e nem todo mês.',
      }, {
        minEquippedGu: 3,
        line: 'Três Gu na mão? Então já aprendeu: manter Gu custa mais do que achar Gu.',
      }],
    }),
  npc('npc-old-chen', 'Velho Chen', 'guard', 25.75, 24, '1', 90, 5,
    'Não se afaste demais da vila. A floresta não perdoa distraídos.', {
      wanderRadius: 56,
      dialogues: [
        'A cada três anos os lobos descem em matilha. Muro, lança e paciência: é disso que esta vila vive.',
        'Já vi jovem Gu Master morrer achando que uma lâmina de luar resolvia tudo. Você pretende andar sozinho?',
      ],
      hints: [{
        minRank: 3,
        line: 'Rank 3 no meu portão? O clã vai querer seu nome escrito na muralha.',
      }, {
        minRank: 2,
        line: 'Já está no Rank 2. Então passe do portão sem escolta — mas volte antes do escuro.',
      }],
    }),
  npc('npc-gu-yue-lan', 'Gu Yue Lan', 'disciple', 20, 21, '1', 65, 3,
    'Preciso voltar aos meus estudos. O instrutor cobra a lâmina de luar de cada discípulo.', {
      dialogues: [
        'Acertei o boneco de palha três vezes ontem. A Gu Luar-da-Lua é a primeira de todo discípulo da Gu Yue.',
        'Na cerimônia do despertar contam seus passos entre as orquídeas. Eu mal cheguei ao grau C.',
      ],
      hints: [{
        minRank: 2,
        line: 'Você já é Rank 2 e eu ainda treino no boneco de palha. O instrutor vai comparar.',
      }],
    }),
  npc('npc-gu-yue-fang', 'Gu Yue Fang', 'disciple', 29, 21, '1', 70, 4,
    'Ainda há muito a aprender — mas já sei de cor a meia-lua na palma do instrutor.', {
      dialogues: [
        'Quem refinar a Gu Luar-da-Lua primeiro leva vinte pedras primárias. Estou a duas noites disso.',
        'Os Chi e os Mo dividem os corredores da academia. Melhor estudar do que escolher lado.',
      ],
      hints: [{
        minRank: 2,
        line: 'Rank 2? A aposta das vinte pedras já foi. Guarde essa lâmina para a próxima.',
      }],
    }),
  npc('npc-aunt-hua', 'Tia Hua', 'merchant', 17, 30, 'Mortal', 50, 1,
    'A banca está aberta, meu bem. O que você trouxe da floresta?', {
      wanderRadius: 48,
      stall: 'banca de comida',
      dialogues: [
        'Pétalas e vinho de bambu verde. Tem Gu nesta vila que come melhor do que muita gente.',
        'Os anciãos se cumprimentam com sorrisos e partem a academia em dois. Eu só vendo comida e escuto.',
      ],
      hints: [{
        minRank: 2,
        line: 'Subiu de Rank, meu bem? Então coma mais: essência nova gasta mais corpo.',
      }],
    }),
  npc('npc-gu-yue-bo', 'Gu Yue Bo', 'patriarch', 24, 20, '4', 800, 30,
    'A vila está de pé. Enquanto eu respirar, continuará assim.', {
      wanderRadius: 32,
      dialogues: [
        'Assumi a liderança no Rank 4 e nele continuei. Um líder não tem tempo de cultivar — e é assim que nos querem.',
        'Três clãs dividem esta montanha, e a Gu Yue é a primeira. É por isso que todos os olhos estão em nós.',
      ],
      hints: [{
        minRank: 3,
        line: 'Rank 3 nesta vila jovem. Não se apresse: líderes morrem por pressa.',
      }, {
        minRank: 2,
        line: 'Rank 2. Bom. A montanha precisa de gente que sobreviva à próxima onda de lobos.',
      }],
    }),
  npc('npc-gu-yue-chi-lian', 'Gu Yue Chi Lian', 'elder', 32, 30, '3', 500, 22,
    'Cautela antes de decidir. Depois de decidir, nenhuma hesitação.', {
      wanderRadius: 40,
      dialogues: [
        'Há quem conte os passos dos jovens na cerimônia como se fossem dívidas. Eu conto.',
        'Minha família construiu metade da academia. Quando tiver poder, lembre-se de quem o recebeu de pé.',
        'Meu neto tem talento. Se alguém disser o contrário, que venha dizer na minha frente.',
      ],
      hints: [{
        minRank: 3,
        line: 'Rank 3 sem apadrinhamento? A facção Chi reconhece talento antes dos outros.',
      }, {
        minRank: 2,
        line: 'Subiu para o Rank 2. Meu neto levou mais tempo. Venha conversar na academia.',
      }],
    }),
  npc('npc-gu-yue-mo-bei', 'Gu Yue Mo Bei', 'disciple', 20, 30, '2', 180, 10,
    'Vamos nos encontrar outra hora. Tenho uma lâmina de luar para afiar.', {
      wanderRadius: 32,
      dialogues: [
        'Meu avô Mo Chen comanda os corredores da academia e não aceita menos que Rank 2 de mim.',
        'Chi Chen fala alto porque o avô é ancião. Eu prefiro falar com as mãos e uma Gu bem criada.',
      ],
      hints: [{
        minRank: 3,
        line: 'Você me passou no Rank. O avô vai perguntar seu nome — e eu vou responder.',
      }, {
        minRank: 2,
        line: 'Então você também chegou ao Rank 2. Agora temos algo para medir na arena.',
      }],
    }),
];
