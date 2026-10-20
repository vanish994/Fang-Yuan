import { GU_SLOTS, type ActiveEffect, type GuCategory, type GuDefinition, type GuId,
  type GuSlot, type GuSource, type PassiveEffect } from './types';

/**
 * Catálogo central. Nenhum Gu entra aqui por conveniência: cada entrada declara
 * Rank, categoria funcional, fidelidade e a fonte usada para validar nome/efeito.
 * Números são balanceamento do jogo, não valores canônicos da novel.
 */

const WIKI = 'Reverend Insanity Wiki (reverend-insanity.fandom.com)';

const source = (reference: string, effect: string, adaptation?: string): GuSource =>
  adaptation ? { reference, effect, adaptation } : { reference, effect };

const visual = (color: string, glyph: string, sprite = false) => ({ color, glyph, sprite });

type DefinitionInput = Omit<GuDefinition, 'id'>;

const define = (id: GuId, input: DefinitionInput): GuDefinition => ({ id, ...input });

export const GU_CATALOG: Readonly<Record<GuId, GuDefinition>> = {
  // ── Ataque ────────────────────────────────────────────────────────────────
  moonlight: define('moonlight', {
    name: 'Moonlight Gu', label: 'Moonlight Gu · Gu da Lua', rank: 1, slot: 'attack',
    categories: ['equippable', 'activatable', 'refinement-material'],
    fidelity: 'canonical',
    source: source(`${WIKI}/wiki/Moonlight_Gu`, 'Gu Rank 1 da luz que lança uma lâmina lunar (moonblade).'),
    description: 'Lança uma lâmina de luar precisa. O ataque assinatura do clã Gu Yue.',
    usage: { essenceCost: 16, cooldownMs: 1800, requiresRank: 1, target: 'direction' },
    active: { kind: 'projectile', damage: 26, range: 224, width: 26, speed: 320,
      count: 1, pierce: false, splashRadius: 0, damageType: 'physical' },
    visual: visual('#6ea8c8', 'LUA', true), price: 800,
  }),
  'bone-spear': define('bone-spear', {
    name: 'Bone Spear Gu', label: 'Bone Spear Gu · Gu Lança de Osso', rank: 1, slot: 'attack',
    categories: ['equippable', 'activatable'],
    fidelity: 'canonical',
    source: source(`${WIKI}/wiki/Bone_Spear_Gu`, 'Gu Rank 1 de ataque; projétil branco em forma de lança com poder de penetração.'),
    description: 'Dispara uma lança de osso estreita que atravessa vários inimigos alinhados.',
    usage: { essenceCost: 22, cooldownMs: 2200, requiresRank: 1, target: 'direction' },
    active: { kind: 'projectile', damage: 32, range: 200, width: 12, speed: 420,
      count: 1, pierce: true, splashRadius: 0, damageType: 'physical' },
    visual: visual('#d9d2bd', 'OSSO'), price: 700,
  }),
  'star-arrow': define('star-arrow', {
    name: 'Star Arrow Gu', label: 'Star Arrow Gu · Gu Flecha Estelar', rank: 1, slot: 'attack',
    categories: ['equippable', 'activatable'],
    fidelity: 'canonical',
    source: source(`${WIKI}/wiki/Star_Arrow_Gu`, 'Gu Rank 1 que permite lançar uma flecha de luz estelar.'),
    description: 'Flecha veloz e barata, de hitbox estreita; exige mira precisa.',
    usage: { essenceCost: 13, cooldownMs: 1400, requiresRank: 1, target: 'direction' },
    active: { kind: 'projectile', damage: 20, range: 260, width: 14, speed: 520,
      count: 1, pierce: false, splashRadius: 0, damageType: 'physical' },
    visual: visual('#e8d27a', 'FLE'), price: 650,
  }),
  'star-dart': define('star-dart', {
    name: 'Star Dart Gu', label: 'Star Dart Gu · Gu Dardo Estelar', rank: 1, slot: 'attack',
    categories: ['equippable', 'activatable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Star_Dart_Gu`, 'Gu Rank 1 natural do caminho estelar; o efeito de combate não está detalhado na fonte.',
      'A rajada de três dardos é adaptação de gameplay; a fonte confirma nome, Rank e origem, não o padrão de disparo.'),
    description: 'Três dardos estelares paralelos. Letal de perto, fácil de desperdiçar à distância.',
    usage: { essenceCost: 18, cooldownMs: 1700, requiresRank: 1, target: 'direction' },
    active: { kind: 'projectile', damage: 12, range: 190, width: 16, speed: 380,
      count: 3, pierce: false, splashRadius: 0, damageType: 'physical' },
    visual: visual('#8fb7e8', 'DAR'), price: 650,
  }),
  'ghost-fire': define('ghost-fire', {
    name: 'Ghost Fire Gu', label: 'Ghost Fire Gu · Gu Fogo Fantasma', rank: 1, slot: 'attack',
    categories: ['equippable', 'activatable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Ghost_Fire_Gu`, 'Gu Rank 1 ofensivo dos caminhos de fogo e alma.',
      'O comportamento de projétil lento e largo é adaptação; a fonte confirma nome, Rank e tipo ofensivo.'),
    description: 'Chama fantasma lenta e larga, com alto dano por acerto e custo elevado.',
    usage: { essenceCost: 22, cooldownMs: 2000, requiresRank: 1, target: 'direction' },
    active: { kind: 'projectile', damage: 30, range: 180, width: 34, speed: 260,
      count: 1, pierce: false, splashRadius: 0, damageType: 'spirit' },
    visual: visual('#8f7bd4', 'FAN'), price: 750,
  }),
  'exploding-egg': define('exploding-egg', {
    name: 'Exploding Egg Gu', label: 'Exploding Egg Gu · Gu Ovo Explosivo', rank: 1, slot: 'attack',
    categories: ['equippable', 'activatable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Category:Rank_1_Gu`, 'Nome listado entre os Gu Rank 1; a página não detalha a mecânica de combate.',
      'Ovo que explode em área é adaptação de gameplay a partir do nome; não é apresentado como efeito canônico confirmado.'),
    description: 'Ovo instável que explode no impacto, atingindo todos os inimigos próximos.',
    usage: { essenceCost: 26, cooldownMs: 2600, requiresRank: 1, target: 'direction' },
    active: { kind: 'projectile', damage: 16, range: 150, width: 28, speed: 240,
      count: 1, pierce: false, splashRadius: 56, damageType: 'physical' },
    visual: visual('#c98f5a', 'OVO'), price: 700,
  }),

  // ── Passivo defensivo ─────────────────────────────────────────────────────
  'stone-skin': define('stone-skin', {
    name: 'Stone Skin Gu', label: 'Stone Skin Gu · Pele de Pedra', rank: 1, slot: 'passive',
    categories: ['equippable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Stone_Skin_Gu`, 'Gu Rank 1 defensivo; a pele fica dura como pedra.',
      '+4 de defesa é o valor de balanceamento que já existia no projeto.'),
    description: 'Endurece a pele de forma constante. Defesa sólida sem restrições.',
    usage: { essenceCost: 0, cooldownMs: 0, requiresRank: 1, target: 'none' },
    passive: { defense: 4 },
    visual: visual('#9d9484', 'PED'), price: 600,
  }),
  'jade-skin': define('jade-skin', {
    name: 'Jade Skin Gu', label: 'Jade Skin Gu · Pele de Jade', rank: 1, slot: 'passive',
    categories: ['equippable', 'refinement-material'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Jade_Skin_Gu`, 'Gu Rank 1 defensivo raro; cria uma barreira que cobre o corpo.',
      'O bônus de vida máxima representa a barreira de forma passiva; a fonte não define números.'),
    description: 'Barreira de jade que reforça a defesa e amplia a reserva de vida.',
    usage: { essenceCost: 0, cooldownMs: 0, requiresRank: 1, target: 'none' },
    passive: { defense: 3, maxHealthMultiplier: 1.08 },
    visual: visual('#6fb79a', 'JAD'), price: 1000,
  }),
  'bronze-skin': define('bronze-skin', {
    name: 'Bronze Skin Gu', label: 'Bronze Skin Gu · Pele de Bronze', rank: 1, slot: 'passive',
    categories: ['equippable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Bronze_Skin_Gu`, 'Gu Rank 1–3 defensivo do caminho metálico; aumenta a defesa por tempo limitado.',
      'A defesa extra quando ferido é adaptação para dar identidade tática sem botão adicional.'),
    description: 'Pele metálica que fica mais dura quando Fang Yuan está ferido.',
    usage: { essenceCost: 0, cooldownMs: 0, requiresRank: 1, target: 'none' },
    passive: { defense: 3, lowHealthDefense: { healthRatio: 0.5, defense: 2 } },
    visual: visual('#b58b5a', 'BRZ'), price: 700,
  }),
  'iron-skin': define('iron-skin', {
    name: 'Iron Skin Gu', label: 'Iron Skin Gu · Pele de Ferro', rank: 1, slot: 'passive',
    categories: ['equippable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Iron_Skin_Gu`, 'Gu Rank 1 defensivo do caminho metálico.',
      'A penalidade de regeneração de essência é adaptação de balanceamento; a fonte não descreve esse custo.'),
    description: 'Defesa alta e constante, mas o metal sufoca a regeneração de essência.',
    usage: { essenceCost: 0, cooldownMs: 0, requiresRank: 1, target: 'none' },
    passive: { defense: 5, essenceRegenMultiplier: 0.8 },
    visual: visual('#77808c', 'FER'), price: 800,
  }),
  'rock-skin': define('rock-skin', {
    name: 'Rock Skin Gu', label: 'Rock Skin Gu · Pele de Rocha', rank: 1, slot: 'passive',
    categories: ['equippable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Rock_Skin_Gu`, 'Gu Rank 1 que transforma partes do corpo em pedra; caminhos de terra e transformação.',
      '-10% de velocidade é adaptação para cobrar o maior valor de defesa entre os passivos.'),
    description: 'A maior defesa entre os passivos, ao custo de mobilidade.',
    usage: { essenceCost: 0, cooldownMs: 0, requiresRank: 1, target: 'none' },
    passive: { defense: 6, movementMultiplier: 0.9 },
    visual: visual('#8c7d68', 'ROC'), price: 650,
  }),
  'beast-skin': define('beast-skin', {
    name: 'Beast Skin Gu', label: 'Beast Skin Gu · Pele de Besta', rank: 1, slot: 'passive',
    categories: ['equippable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Beast_Skin_Gu`, 'Gu Rank 1 defensivo comum da mesma série das peles.',
      'O pequeno bônus de velocidade é adaptação; o efeito canônico detalhado não está disponível.'),
    description: 'Pele leve de besta: defesa moderada sem perder agilidade.',
    usage: { essenceCost: 0, cooldownMs: 0, requiresRank: 1, target: 'none' },
    passive: { defense: 3, movementMultiplier: 1.06 },
    visual: visual('#a68a63', 'BST'), price: 500,
  }),

  // ── Apoio ─────────────────────────────────────────────────────────────────
  'liquor-worm': define('liquor-worm', {
    name: 'Liquor Worm', label: 'Liquor Gu · Verme do Licor', rank: 1, slot: 'support',
    categories: ['equippable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Liquor_Worm`, 'Gu Rank 1 de apoio que refina e condensa essência primordial verde-cobre.',
      '+2 de essência por segundo é a adaptação de combate já usada pelo projeto; a fonte não define regeneração por segundo.'),
    description: 'Refina a essência primordial continuamente enquanto equipado.',
    usage: { essenceCost: 0, cooldownMs: 0, requiresRank: 1, target: 'none' },
    passive: { essenceRegenBonus: 2 },
    visual: visual('#d9c7a3', 'LIC', true), price: 1000,
  }),
  'little-light': define('little-light', {
    name: 'Little Light Gu', label: 'Little Light Gu · Pequena Luz', rank: 1, slot: 'support',
    categories: ['equippable', 'activatable', 'refinement-material'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Little_Light_Gu`, 'Gu Rank 1 de assistência que dobra o poder da Moonlight Gu; múltiplos não somam.',
      '+25% por 6 s é adaptação de balanceamento; a fonte descreve duplicação canônica, não duração ou percentual de jogo.'),
    description: 'Amplifica a próxima janela de ataques com luz concentrada. Não acumula.',
    usage: { essenceCost: 10, cooldownMs: 14000, requiresRank: 1, target: 'self' },
    active: { kind: 'buff', damageMultiplier: 1.25, movementMultiplier: 1, defenseBonus: 0, durationMs: 6000 },
    visual: visual('#f1e6a8', 'LUZ'), price: 700,
  }),
  'amplify-effect': define('amplify-effect', {
    name: 'Amplify Effect Gu', label: 'Amplify Effect Gu · Amplificar Efeito', rank: 1, slot: 'support',
    categories: ['equippable', 'activatable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Amplify_Effect_Gu`, 'Gu Rank 1 do caminho das regras; amplifica o efeito de outro Gu, com maior gasto de essência.',
      'O uso de uma única ativação com +50% de efeito e +50% de custo é adaptação; a fonte confirma a amplificação e o custo extra.'),
    description: 'Amplifica a próxima ativação em 50%, cobrando 50% mais essência.',
    usage: { essenceCost: 18, cooldownMs: 20000, requiresRank: 1, target: 'self' },
    active: { kind: 'empower', durationMs: 8000, effectMultiplier: 1.5, costMultiplier: 1.5 },
    visual: visual('#c6a9e0', 'AMP'), price: 900,
  }),
  'cleansing-water': define('cleansing-water', {
    name: 'Cleansing Water Gu', label: 'Cleansing Water Gu · Água Purificadora', rank: 1, slot: 'support',
    categories: ['equippable', 'activatable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Cleansing_Water_Gu`, 'Gu Rank 1 de apoio/cura que limpa a abertura e expulsa energias externas.',
      'A cura direta de 18 PV é adaptação de combate; a fonte descreve limpeza da abertura, não recuperação de vida.'),
    description: 'Água que purifica ferimentos e restaura 18 de vida.',
    usage: { essenceCost: 16, cooldownMs: 15000, requiresRank: 1, target: 'self' },
    active: { kind: 'heal', amount: 18 },
    visual: visual('#74b6c9', 'AGU'), price: 700,
  }),
  'flash-blink': define('flash-blink', {
    name: 'Flash Blink Gu', label: 'Flash Blink Gu · Clarão', rank: 1, slot: 'support',
    categories: ['consumable'],
    fidelity: 'canonical',
    source: source(`${WIKI}/wiki/Flash_Blink_Gu`, 'Gu Rank 1 consumível da luz; explode em luz branca ofuscante, dispersando escuridão.'),
    description: 'Clarão ofuscante que cega inimigos próximos por 2,5 s. Uso único.',
    usage: { essenceCost: 0, cooldownMs: 0, requiresRank: 1, target: 'none', destroysOnUse: true },
    active: { kind: 'blind', radius: 140, durationMs: 2500 },
    visual: visual('#f4edc8', 'CLR'), price: 550,
  }),
  'all-out-effort': define('all-out-effort', {
    name: 'All-Out Effort Gu', label: 'All-Out Effort Gu · Esforço Total', rank: 1, slot: 'support',
    categories: ['equippable', 'activatable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/All-Out_Effort_Gu`, 'Gu de apoio do caminho da força listado como Rank 1; a página detalha principalmente os Ranks 3–4.',
      '+15% de dano e +10% de velocidade por 8 s são adaptação de gameplay; o efeito de Rank 1 não está confirmado em detalhe.'),
    description: 'Exerce toda a força do corpo por pouco tempo, ganhando dano e velocidade.',
    usage: { essenceCost: 20, cooldownMs: 18000, requiresRank: 1, target: 'self' },
    active: { kind: 'buff', damageMultiplier: 1.15, movementMultiplier: 1.1, defenseBonus: 0, durationMs: 8000 },
    visual: visual('#c78a6e', 'ESF'), price: 800,
  }),

  // ── Movimento ─────────────────────────────────────────────────────────────
  whirlwind: define('whirlwind', {
    name: 'Whirlwind Gu', label: 'Whirlwind Gu · Redemoinho', rank: 1, slot: 'movement',
    categories: ['equippable', 'activatable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Whirlwind_Gu`, 'Gu Rank 1 de movimento do caminho do vento; aumenta a velocidade.',
      'O deslocamento instantâneo de 96 px é adaptação de gameplay; a fonte descreve aumento de velocidade e impulso de ataque.'),
    description: 'Arrancada curta e bônus de velocidade por 1,8 s.',
    usage: { essenceCost: 20, cooldownMs: 5000, requiresRank: 1, target: 'direction' },
    active: { kind: 'dash', distance: 96, speedMultiplier: 1.5, durationMs: 1800 },
    visual: visual('#a7c8b4', 'RED', true), price: 700,
  }),
  'clear-wind-wheel': define('clear-wind-wheel', {
    name: 'Clear Wind Wheel Gu', label: 'Clear Wind Wheel Gu · Roda de Vento', rank: 1, slot: 'movement',
    categories: ['equippable', 'activatable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Clear_Wind_Wheel_Gu`, 'Gu Rank 1 de movimento; forma um ciclone verde-claro sob os pés e aumenta a velocidade.'),
    description: 'Deslocamento curto e barato, com bônus de velocidade longo.',
    usage: { essenceCost: 16, cooldownMs: 4000, requiresRank: 1, target: 'direction' },
    active: { kind: 'dash', distance: 80, speedMultiplier: 1.35, durationMs: 2500 },
    visual: visual('#8fc7a0', 'RDA'), price: 650,
  }),
  'dragonpill-cricket': define('dragonpill-cricket', {
    name: 'Dragonpill Cricket Gu', label: 'Dragonpill Cricket Gu · Grilo Dragão', rank: 1, slot: 'movement',
    categories: ['equippable', 'activatable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Dragonpill_Cricket_Gu`, 'Gu Rank 1 de movimento; imita o salto do grilo, indo mais longe e mais alto.'),
    description: 'Salto longo e caro; não atravessa obstáculos sólidos.',
    usage: { essenceCost: 24, cooldownMs: 6500, requiresRank: 1, target: 'direction' },
    active: { kind: 'dash', distance: 128, speedMultiplier: 1.2, durationMs: 1200 },
    visual: visual('#9dbb6a', 'SAL'), price: 750,
  }),

  // ── Assimilação permanente ────────────────────────────────────────────────
  'bear-strength': define('bear-strength', {
    name: 'Bear Strength Gu', label: 'Bear Strength Gu · Força do Urso', rank: 1, slot: 'support',
    categories: ['assimilable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Bear_Strength_Gu`, 'Gu Rank 1 do caminho da força; concede permanentemente a força de um urso e melhora o físico.',
      '+6% de dano físico é a conversão de gameplay para a força permanente; a fonte não define percentual.'),
    description: 'Assimilação permanente: +6% de dano físico. Consome o Gu ao ser assimilado.',
    usage: { essenceCost: 0, cooldownMs: 0, requiresRank: 1, target: 'none' },
    assimilation: { physicalDamageBonus: 0.06 },
    visual: visual('#8b6b4f', 'URS'), price: 900,
  }),
  'white-boar': define('white-boar', {
    name: 'White Boar Gu', label: 'White Boar Gu · Javali Branco', rank: 1, slot: 'support',
    categories: ['assimilable', 'refinement-material'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/White_Boar_Gu`, 'Gu Rank 1 do caminho da força; concede permanentemente a força de um javali branco.',
      '+4% de dano físico é a conversão de gameplay; a fonte não define percentual.'),
    description: 'Assimilação permanente: +4% de dano físico. Também é ingrediente da White Jade Gu.',
    usage: { essenceCost: 0, cooldownMs: 0, requiresRank: 1, target: 'none' },
    assimilation: { physicalDamageBonus: 0.04 },
    visual: visual('#e3dccb', 'JAV'), price: 600,
  }),
  'black-boar': define('black-boar', {
    name: 'Black Boar Gu', label: 'Black Boar Gu · Javali Negro', rank: 1, slot: 'support',
    categories: ['assimilable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Black_Boar_Gu`, 'Gu Rank 1 do caminho da força; concede permanentemente a força de um javali negro.',
      '+4% no ataque básico corpo a corpo é a conversão de gameplay; a fonte não define percentual.'),
    description: 'Assimilação permanente: +4% de dano no ataque básico corpo a corpo.',
    usage: { essenceCost: 0, cooldownMs: 0, requiresRank: 1, target: 'none' },
    assimilation: { meleeDamageBonus: 0.04 },
    visual: visual('#5c5a57', 'JAN'), price: 600,
  }),

  // ── Rank 2 (resultados de refino) ────────────────────────────────────────
  moonglow: define('moonglow', {
    name: 'Moonglow Gu', label: 'Moonglow Gu · Brilho Lunar', rank: 2, slot: 'attack',
    categories: ['equippable', 'activatable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/Moonglow_Gu`, 'Rank 2 obtido de 1 Moonlight Gu + 2 Little Light Gu; lâmina lunar mais poderosa.',
      'Dano, alcance e recarga são balanceamento próprio de Rank 2, não valores da novel.'),
    description: 'Lâmina lunar evoluída: mais dano e alcance, com custo e recarga maiores.',
    usage: { essenceCost: 24, cooldownMs: 2200, requiresRank: 2, target: 'direction' },
    active: { kind: 'projectile', damage: 40, range: 250, width: 36, speed: 380,
      count: 1, pierce: false, splashRadius: 0, damageType: 'physical' },
    visual: visual('#9bc7e8', 'MG'), price: 2200,
  }),
  'white-jade': define('white-jade', {
    name: 'White Jade Gu', label: 'White Jade Gu · Jade Branco', rank: 2, slot: 'passive',
    categories: ['equippable'],
    fidelity: 'canonical-adapted',
    source: source(`${WIKI}/wiki/White_Jade_Gu`, 'Rank 2 defensivo obtido de Jade Skin Gu + White Boar Gu; proteção de jade aprimorada.',
      '+8 de defesa e +12% de vida máxima são valores de balanceamento de Rank 2.'),
    description: 'Proteção de jade muito superior, exigindo Rank 2 para ser equipada.',
    usage: { essenceCost: 0, cooldownMs: 0, requiresRank: 2, target: 'none' },
    passive: { defense: 8, maxHealthMultiplier: 1.12 },
    visual: visual('#cfe3d5', 'WJ'), price: 2200,
  }),
};

/** Ordem estável para coleções de UI e validação. */
export const GU_IDS = Object.freeze(Object.keys(GU_CATALOG) as GuId[]);

export const GU_BY_SLOT: Readonly<Record<GuSlot, readonly GuDefinition[]>> = Object.fromEntries(
  GU_SLOTS.map(slot => [slot, GU_IDS.map(id => GU_CATALOG[id])
    .filter(gu => gu.slot === slot && gu.categories.includes('equippable'))]),
) as unknown as Record<GuSlot, readonly GuDefinition[]>;

export function isGuId(value: unknown): value is GuId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(GU_CATALOG, value);
}

export function isEquippable(gu: GuDefinition | undefined): boolean {
  return gu?.categories.includes('equippable') === true;
}

export function isUsable(gu: GuDefinition | undefined): boolean {
  return gu?.categories.includes('activatable') === true || gu?.categories.includes('consumable') === true;
}

export function isAssimilable(gu: GuDefinition | undefined): boolean {
  return gu?.categories.includes('assimilable') === true;
}

export const CATEGORY_LABELS: Readonly<Record<GuCategory, string>> = {
  equippable: 'Equipável', activatable: 'Ativável', assimilable: 'Assimilável',
  'refinement-material': 'Material de refino', consumable: 'Consumível',
};

export const FIDELITY_LABELS: Readonly<Record<GuDefinition['fidelity'], string>> = {
  canonical: 'Canônico', 'canonical-adapted': 'Canônico (adaptado)',
  'fan-made': 'Fan-made', pending: 'Pendente',
};

/**
 * Vagas de Rank 1 ainda não preenchidas. A estrutura aceita seis por slot; só
 * publicamos nomes cujo Rank/efeito foram verificados. Não inventamos Gu para
 * completar a meta de 24.
 */
export const PENDING_GU_SLOTS: readonly { slot: GuSlot; missing: number; reason: string }[] = [
  { slot: 'movement', missing: 3,
    reason: 'Só Whirlwind, Clear Wind Wheel e Dragonpill Cricket têm Rank 1 confirmado. '
      + 'Candidatos como Jumping Grass (sem Rank), Chasing Wind (Rank 4) e Lightning Flash (Rank 5) foram rejeitados.' },
];

export const RANK_ONE_GU_COUNT = GU_IDS.filter(id => GU_CATALOG[id].rank === 1).length;

/** Carregamento de teste: todos os Gu Rank 1 publicados. A economia ainda não existe. */
export const STARTING_INVENTORY: Readonly<Partial<Record<GuId, number>>> = Object.freeze(
  Object.fromEntries(GU_IDS.filter(id => GU_CATALOG[id].rank === 1)
    .map(id => [id, id === 'little-light' ? 2 : 1])),
);

/** Custo de essência/efeito de um Gu; tipagem estreita para evitar `any`. */
export function passiveOf(gu: GuDefinition): PassiveEffect | undefined { return gu.passive; }
export function activeOf(gu: GuDefinition): ActiveEffect | undefined { return gu.active; }
