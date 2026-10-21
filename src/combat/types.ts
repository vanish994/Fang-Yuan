export type GuSlot = 'attack' | 'passive' | 'movement' | 'support';
export const GU_SLOTS: readonly GuSlot[] = ['attack', 'passive', 'movement', 'support'];

/**
 * Identificadores estáveis de Gu. Novos Gu entram aqui e no catálogo central;
 * a persistência só aceita IDs presentes neste tipo em tempo de execução.
 */
export type GuId =
  // Ataque (Rank 1)
  | 'moonlight' | 'bone-spear' | 'star-arrow' | 'star-dart' | 'ghost-fire' | 'exploding-egg'
  // Passivo (Rank 1)
  | 'stone-skin' | 'bronze-skin' | 'iron-skin' | 'rock-skin' | 'jade-skin' | 'beast-skin'
  // Apoio (Rank 1)
  | 'liquor-worm' | 'little-light' | 'amplify-effect' | 'cleansing-water' | 'flash-blink' | 'all-out-effort'
  // Movimento (Rank 1)
  | 'whirlwind' | 'clear-wind-wheel' | 'dragonpill-cricket'
  // Assimilação permanente (Rank 1)
  | 'bear-strength' | 'white-boar' | 'black-boar'
  // Resultados de refino (Rank 2)
  | 'moonglow' | 'white-jade';

export type Direction = 'up' | 'down' | 'left' | 'right';
export interface Point { x: number; y: number }
export interface Combatant extends Point { health: number; maxHealth: number; defense: number; alive: boolean }
/**
 * Estado do Gu selvagem de uma criatura. Só existe quando ela nasceu com Gu,
 * então `enemy.wild === undefined` já significa "criatura comum" — não há mais
 * três estados possíveis em um campo solto (`ausente` / `null` / id).
 */
export interface WildGuState {
  /** Gu sorteado no nascimento; nunca muda durante a luta. */
  gu: GuId;
  /** Quantidade de ativações; compõe o id único de cada golpe. */
  casts: number;
  /** Próximo instante em que o Gu pode ser usado; ausente até o 1º tick. */
  nextAt?: number;
  /** Bônus de dano de buff ativo até este instante. */
  buffUntil?: number;
  damageBonus?: number;
  /** Defesa condicional (Bronze Skin) avaliada a cada golpe recebido. */
  lowHealthDefense?: number;
}

export interface Enemy extends Combatant {
  id: string; name?: string; lastAttackAt: number; rewarded: boolean;
  /** Cegueira temporária (Flash Blink Gu); não concede imunidade, só pausa a IA. */
  blindedUntil?: number;
  /** Presente apenas em criaturas que nasceram com um Gu. */
  wild?: WildGuState;
}
/** Projétil disparado por uma criatura selvagem; atinge apenas o herói. */
export interface EnemyProjectile {
  enemyId: string; guId: GuId; x: number; y: number;
  /** Vetor unitário da mira no instante do disparo (não persegue o herói). */
  dx: number; dy: number;
  traveled: number; range: number; speed: number; damage: number; hitId: string;
}

export interface CombatEvent {
  type: 'damage' | 'defeat' | 'reward' | 'resurrect' | 'hero-death'
    | 'moonlight' | 'dash' | 'activate' | 'heal' | 'barrier' | 'blind'
    | 'refine' | 'assimilate'
    /** Criatura selvagem ativou o Gu registrado nela. */
    | 'enemy-ability';
  targetId?: string;
  amount?: number;
  x?: number;
  y?: number;
  guId?: GuId;
  stoneReward?: number;
  materialId?: string;
  materialQuantity?: number;
  /** Gu exato registrado na criatura derrotada; nunca sorteado na morte. */
  guReward?: GuId;
}
export type ActionResult = { ok: boolean; reason?: string; events: CombatEvent[] };

/** Categoria funcional, independente do Rank do Gu. */
export type GuCategory =
  | 'equippable' | 'activatable' | 'assimilable' | 'refinement-material' | 'consumable';

/**
 * Fidelidade à novel. `canonical` = nome/efeito confirmados na fonte;
 * `canonical-adapted` = nome e Rank canônicos, mas números ou detalhes de
 * gameplay são adaptação; `fan-made` = criado para o jogo; `pending` = vaga
 * reservada, sem conteúdo publicado.
 */
export type GuFidelity = 'canonical' | 'canonical-adapted' | 'fan-made' | 'pending';

export type DamageType = 'physical' | 'spirit';

export interface GuSource {
  /** Onde o nome/Rank foi verificado. */
  reference: string;
  /** Detalhe do efeito canônico que a mecânica do jogo representa. */
  effect: string;
  /** O que é adaptação de gameplay e não deve ser lido como fato da novel. */
  adaptation?: string;
}

export interface PassiveEffect {
  defense?: number;
  maxHealthBonus?: number;
  maxHealthMultiplier?: number;
  essenceRegenBonus?: number;
  essenceRegenMultiplier?: number;
  movementMultiplier?: number;
  /** Defesa adicional quando a vida está abaixo de `healthRatio`. */
  lowHealthDefense?: { healthRatio: number; defense: number };
}

export type ActiveEffect =
  | { kind: 'projectile'; damage: number; range: number; width: number; speed: number;
      count: number; pierce: boolean; splashRadius: number; damageType: DamageType }
  | { kind: 'dash'; distance: number; speedMultiplier: number; durationMs: number }
  | { kind: 'buff'; damageMultiplier: number; movementMultiplier: number;
      defenseBonus: number; durationMs: number }
  | { kind: 'empower'; durationMs: number; effectMultiplier: number; costMultiplier: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'blind'; radius: number; durationMs: number };

export interface GuUsage {
  essenceCost: number;
  cooldownMs: number;
  /** Rank mínimo do cultivador para equipar/usar. */
  requiresRank: number;
  target: 'direction' | 'self' | 'none';
  /** Consumíveis são destruídos ao usar e validados pelo inventário. */
  destroysOnUse?: boolean;
}

export interface AssimilationBenefit {
  /** Multiplicador aditivo sobre dano físico (0.06 = +6%). */
  physicalDamageBonus?: number;
  /** Multiplicador aditivo específico do ataque básico corpo a corpo. */
  meleeDamageBonus?: number;
  maxHealthBonus?: number;
}

export interface GuVisual {
  /** Cor de fallback para Gu sem spritesheet; mantém a UI coerente. */
  color: string;
  /** Glifo curto exibido quando não há ícone dedicado. */
  glyph: string;
  /** true usa o spritesheet existente de 4 ícones. */
  sprite?: boolean;
}

export interface GuDefinition {
  id: GuId;
  /** Nome canônico em inglês (ou nome de trabalho, se fan-made). */
  name: string;
  /** Nome de exibição em pt-BR. */
  label: string;
  /** Nome curto (sem o prefixo em inglês) para rótulos no mundo, acima do sprite. */
  short: string;
  rank: number;
  slot: GuSlot;
  categories: readonly GuCategory[];
  fidelity: GuFidelity;
  source: GuSource;
  description: string;
  usage: GuUsage;
  passive?: PassiveEffect;
  active?: ActiveEffect;
  assimilation?: AssimilationBenefit;
  visual: GuVisual;
  /** Preço de referência em pedras espirituais; economia ainda não implementada. */
  price: number;
}

export interface RecipeIngredient { id: GuId; quantity: number }
export interface RecipeMaterial { id: string; quantity: number }
export interface GuRecipe {
  id: string;
  name: string;
  result: GuId;
  resultQuantity: number;
  ingredients: readonly RecipeIngredient[];
  materials: readonly RecipeMaterial[];
  essenceCost: number;
  /** Rank mínimo do cultivador para desbloquear a receita. */
  requiresRank: number;
  successChance: number;
  consumesIngredients: boolean;
  /** Resultado em caso de falha; `none` não perde ingredientes. */
  failureResult: 'none' | 'consume-ingredients';
  fidelity: GuFidelity;
  source: GuSource;
}
