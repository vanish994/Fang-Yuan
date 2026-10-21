/**
 * Catálogo dos personagens jogáveis, sem Phaser.
 *
 * Só a apresentação muda de um personagem para outro (arte, cor do efeito, como o
 * ataque básico é entregue). As regras de Gu, cultivo, refino e salvamento são as
 * mesmas para todos — nenhum personagem ganha um sistema paralelo.
 *
 * `damageMultiplier` incide sobre o ataque de cultivo, então o básico acompanha o
 * Rank do mesmo jeito nos dois casos; o que muda é a proporção entre eles.
 */
export type PlayerCharacterId = 'fang-yuan' | 'bai-ning-bing';

export type PlayerEffectStyle = 'gu' | 'ice';

/** Como o ataque básico chega ao alvo. */
export type BasicAttackKind = 'melee' | 'projectile';

export interface PlayerCharacterProfile {
  id: PlayerCharacterId;
  name: string;
  /** Linha curta mostrada no menu de personagem. */
  title: string;
  /** Explicação do papel em combate (3 linhas no máximo, PT-BR). */
  description: string;
  kind: BasicAttackKind;
  /** Chave usada nos atlas: `fang-yuan`, `bai-ning-bing`. */
  art: string;
  /** Folha de partículas da apresentação: a máscara de Gu ou a de gelo. */
  effects: PlayerEffectStyle;
  /** Cor de destaque do personagem (texto da seleção e estilhaço do básico). */
  accent: number;
  combat: {
    /** Multiplicador sobre a vida de cultivo: quem tem menos vida precisa de alcance. */
    maxHealthMultiplier: number;
    /** Defesa somada (pode ser negativa) depois do cultivo e dos passivos. */
    defenseBonus: number;
    /** Multiplicador de velocidade de caminhada. */
    speedMultiplier: number;
    /** Proporção do ataque de cultivo usada no ataque básico. */
    damageMultiplier: number;
  };
  basic: {
    range: number;
    cooldownMs: number;
    /** Só para `projectile`: velocidade do disparo em px/s. */
    projectileSpeed: number;
    /** Largura do projétil em px (área de acerto). */
    width: number;
  };
}

/**
 * Balanceamento do básico (parâmetros de jogo, não canon).
 *
 * Fang Yuan: 14 de dano, 62 px, 600 ms → ~23,3 de dano por segundo, mas só de perto.
 * Bai Ning Bing: 9 de dano (0,64 × ataque), 190 px, 650 ms → ~13,8 por segundo.
 * Ela é claramente pior em dano e em eficiência (mais lenta a cada disparo) e
 * claramente melhor em alcance, com 15% menos vida e 1 de defesa a menos.
 * Nenhuma das duas é superior em dano, alcance, velocidade e eficiência ao mesmo tempo.
 */
export const PLAYER_CHARACTERS: Readonly<Record<PlayerCharacterId, PlayerCharacterProfile>> = {
  'fang-yuan': {
    id: 'fang-yuan',
    name: 'Fang Yuan',
    title: 'Corpo a corpo · Rank 1',
    description: 'Golpe básico curto e forte. Aguenta mais pancada e depende de chegar perto.',
    kind: 'melee',
    art: 'fang-yuan',
    effects: 'gu',
    accent: 0xb8d98a,
    combat: {
      maxHealthMultiplier: 1, defenseBonus: 0, speedMultiplier: 1, damageMultiplier: 1,
    },
    basic: { range: 62, cooldownMs: 600, projectileSpeed: 0, width: 0 },
  },
  'bai-ning-bing': {
    id: 'bai-ning-bing',
    name: 'Bai Ning Bing',
    title: 'À distância · Rank 1',
    description: 'Dispara estilhaços de gelo de longe. Frágil de perto e mais lenta por disparo.',
    kind: 'projectile',
    art: 'bai-ning-bing',
    effects: 'ice',
    accent: 0x9fd8ff,
    combat: {
      maxHealthMultiplier: 0.85, defenseBonus: -1, speedMultiplier: 1.05,
      damageMultiplier: 9 / 14,
    },
    basic: { range: 190, cooldownMs: 650, projectileSpeed: 420, width: 14 },
  },
};

export const PLAYER_CHARACTER_IDS: readonly PlayerCharacterId[] =
  Object.keys(PLAYER_CHARACTERS) as PlayerCharacterId[];

export const DEFAULT_PLAYER_CHARACTER: PlayerCharacterId = 'fang-yuan';

export function isPlayerCharacterId(value: unknown): value is PlayerCharacterId {
  return typeof value === 'string' && value in PLAYER_CHARACTERS;
}

export function playerCharacter(id: unknown): PlayerCharacterProfile {
  return PLAYER_CHARACTERS[isPlayerCharacterId(id) ? id : DEFAULT_PLAYER_CHARACTER];
}
