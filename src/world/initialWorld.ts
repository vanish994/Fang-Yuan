import type { NpcDefinition } from '../entities/npc';
import type { MobDefinition } from '../combat/mobCatalog';
import { TEST_NPCS } from '../entities/npc';
import { TEST_MOBS } from '../combat/mobCatalog';

export const AREA_TILES = 48;
export const AREA_CHUNKS = 3;
export const TILES_PER_CHUNK = 16;
export type Side = 'north' | 'east' | 'south' | 'west';
export type Biome = 'village' | 'forest' | 'dangerous-forest' | 'rocky' | 'cave' | 'lair';
export const RISK_LABELS = { safe: 'segura', low: 'baixo', medium: 'médio', high: 'alto',
  boss: 'boss', extreme: 'extremo' } as const;
export type AreaId = 'vila_gu_yue' | 'floresta_exterior' | 'floresta_perigosa' | 'regiao_rochosa'
  | 'cavernas' | 'covil_lobo' | 'covil_javali' | 'ninho_serpente' | 'santuario_besta';
export interface TilePosition { x: number; y: number }
export interface Spawn extends TilePosition {
  id: string; speciesId?: string; // instâncias de espécie existente, sem novos atributos
  density?: 'isolated' | 'small-group' | 'sparse'; respawn?: 'none';
}
export interface PointOfInterest extends TilePosition { id: string; kind: 'meeting' | 'gathering' | 'hidden' | 'arena' | 'market' | 'training' | 'residential' }
export interface AreaDefinition {
  id: AreaId; name: string; biome: Biome; seed: number; risk: 'safe' | 'low' | 'medium' | 'high' | 'boss' | 'extreme';
  chunks: Readonly<{ width: number; height: number }>;
  exits: Readonly<Partial<Record<Side, AreaId>>>;
  npcSpawns: readonly Spawn[]; mobSpawns: readonly Spawn[];
  pointsOfInterest: readonly PointOfInterest[];
  resources: readonly ('mushrooms' | 'rocks' | 'logs')[]; // cenários: coleta ainda não implementada
}
const chunks = { width: AREA_CHUNKS, height: AREA_CHUNKS } as const;
const poi = (id: string, kind: PointOfInterest['kind'], x: number, y: number): PointOfInterest =>
  ({ id, kind, x, y });
// Pontos de trabalho/moradia distribuídos pelos quatro bairros e portão da vila.
// Catálogo TEST_NPCS conserva identidades/estatísticas; a área define apenas o layout.
const VILLAGE_NPC_POSITIONS: Readonly<Record<string, readonly [number, number]>> = {
  'npc-gu-yue-mei': [13, 21],
  'npc-lin-shan': [34, 22],
  'npc-zhao-he': [17, 29],
  'npc-old-chen': [40, 24],
  'npc-gu-yue-lan': [19, 19],
  'npc-gu-yue-fang': [34, 27],
  'npc-aunt-hua': [19, 35],
  'npc-gu-yue-bo': [24, 20],
  'npc-gu-yue-chi-lian': [37, 31],
  'npc-gu-yue-mo-bei': [26, 34],
};
const npcSpawns: Spawn[] = TEST_NPCS.map(n => {
  const [x, y] = VILLAGE_NPC_POSITIONS[n.id]!;
  return { id: n.id, x, y };
});
const positions: Readonly<Record<string, readonly [AreaId, number, number]>> = {
  'mob-wild-boar': ['floresta_exterior', 18, 24],
  'mob-moon-rabbit': ['floresta_exterior', 31, 25],
  'mob-grey-wolf': ['floresta_exterior', 25, 17],
  'mob-mountain-monkey': ['floresta_exterior', 25, 32],
  'mob-green-snake': ['floresta_exterior', 17, 29],
  'mob-fierce-wolf': ['floresta_perigosa', 12, 18],
  'mob-demonic-boar': ['floresta_perigosa', 35, 18],
  'mob-black-fang-snake': ['floresta_perigosa', 35, 32],
  'mob-shadow-spider': ['floresta_perigosa', 13, 34],
  'mob-stone-lizard': ['regiao_rochosa', 20, 37],
  'mob-demon-wolf': ['cavernas', 12, 12],
  'mob-demon-bear': ['cavernas', 36, 12],
  'mob-jade-serpent': ['cavernas', 40, 16],
  'mob-demon-tiger': ['cavernas', 39, 24],
  'mob-boar-king': ['covil_javali', 20, 28],
  'mob-grey-wolf-king': ['covil_lobo', 24, 24],
  'mob-demonic-boar-king': ['covil_javali', 24, 24],
  'mob-serpent-king': ['ninho_serpente', 24, 24],
  'mob-ancient-demonic-beast': ['santuario_besta', 24, 24],
};
const spawnFor = (area: AreaId): Spawn[] => TEST_MOBS.filter(m => positions[m.id]?.[0] === area)
  .map(m => ({ id: m.id, x: positions[m.id]![1], y: positions[m.id]![2],
    density: m.pack ? 'small-group' : 'isolated', respawn: 'none' }));
const group = (id: string, speciesId: string, x: number, y: number): Spawn =>
  ({ id, speciesId, x, y, density: 'small-group', respawn: 'none' });

/** Dados de layout de teste. Não inferir Rank de boss, respawn, loot, facção ou coleta. */
export const INITIAL_WORLD: Readonly<Record<AreaId, AreaDefinition>> = {
  vila_gu_yue: { id: 'vila_gu_yue', name: 'Vila Gu Yue', biome: 'village', risk: 'safe',
    seed: 101, chunks, exits: { east: 'floresta_exterior' }, npcSpawns, mobSpawns: [],
    resources: [], pointsOfInterest: [poi('centro', 'meeting', 24, 24), poi('mercado', 'market', 17, 29),
      poi('residencial', 'residential', 20, 20), poi('treino', 'training', 30, 20)] },
  floresta_exterior: { id: 'floresta_exterior', name: 'Floresta Exterior', biome: 'forest', risk: 'low',
    seed: 102, chunks, exits: { west: 'vila_gu_yue', east: 'floresta_perigosa' }, npcSpawns: [],
    mobSpawns: [...spawnFor('floresta_exterior'),
      group('mob-moon-rabbit-companion', 'mob-moon-rabbit', 33, 26),
      group('mob-grey-wolf-packmate', 'mob-grey-wolf', 27, 18)],
    resources: ['mushrooms', 'logs'],
    pointsOfInterest: [poi('clareira', 'meeting', 24, 24), poi('coleta', 'gathering', 17, 33),
      poi('recanto', 'hidden', 34, 35)] },
  floresta_perigosa: { id: 'floresta_perigosa', name: 'Floresta Perigosa', biome: 'dangerous-forest',
    risk: 'medium', seed: 103, chunks, exits: { west: 'floresta_exterior', north: 'regiao_rochosa',
      south: 'cavernas', east: 'covil_lobo' }, npcSpawns: [], mobSpawns: spawnFor('floresta_perigosa'),
    resources: ['mushrooms', 'rocks'], pointsOfInterest: [poi('encruzilhada', 'meeting', 24, 24),
      poi('emboscada', 'hidden', 13, 33)] },
  regiao_rochosa: { id: 'regiao_rochosa', name: 'Região Rochosa', biome: 'rocky', risk: 'high',
    seed: 104, chunks, exits: { south: 'floresta_perigosa', east: 'covil_javali' }, npcSpawns: [],
    mobSpawns: spawnFor('regiao_rochosa'), resources: ['rocks'],
    pointsOfInterest: [poi('pedras', 'gathering', 20, 35), poi('ruinas', 'hidden', 32, 18)] },
  cavernas: { id: 'cavernas', name: 'Cavernas', biome: 'cave', risk: 'high',
    seed: 105, chunks, exits: { north: 'floresta_perigosa', east: 'ninho_serpente' }, npcSpawns: [],
    mobSpawns: spawnFor('cavernas'), resources: ['rocks', 'mushrooms'],
    pointsOfInterest: [poi('corredor', 'meeting', 24, 24), poi('camara', 'hidden', 36, 13)] },
  covil_lobo: { id: 'covil_lobo', name: 'Covil do Rei Lobo', biome: 'lair', risk: 'boss',
    seed: 106, chunks, exits: { west: 'floresta_perigosa' }, npcSpawns: [],
    mobSpawns: [...spawnFor('covil_lobo'),
      group('mob-grey-wolf-guard-1', 'mob-grey-wolf', 20, 26),
      group('mob-grey-wolf-guard-2', 'mob-grey-wolf', 28, 26)],
    resources: [], pointsOfInterest: [poi('arena', 'arena', 24, 24)] },
  covil_javali: { id: 'covil_javali', name: 'Covil do Rei Javali', biome: 'lair', risk: 'boss',
    seed: 107, chunks, exits: { west: 'regiao_rochosa' }, npcSpawns: [],
    mobSpawns: spawnFor('covil_javali'), resources: ['rocks'], pointsOfInterest: [poi('arena', 'arena', 24, 24)] },
  ninho_serpente: { id: 'ninho_serpente', name: 'Ninho do Rei Serpente', biome: 'lair', risk: 'boss',
    seed: 108, chunks, exits: { west: 'cavernas', east: 'santuario_besta' }, npcSpawns: [],
    mobSpawns: spawnFor('ninho_serpente'), resources: ['mushrooms'],
    pointsOfInterest: [poi('arena', 'arena', 24, 24)] },
  santuario_besta: { id: 'santuario_besta', name: 'Santuário da Besta Antiga', biome: 'lair', risk: 'extreme',
    seed: 109, chunks, exits: { west: 'ninho_serpente' }, npcSpawns: [],
    mobSpawns: spawnFor('santuario_besta'), resources: [],
    pointsOfInterest: [poi('arena', 'arena', 24, 24)] },
};

// Rotas locais não convergem novamente à praça central.
const ROUTINES: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  'npc-gu-yue-mei': [[13, 21], [14, 21]],
  'npc-lin-shan': [[34, 22], [35, 22]],
  'npc-zhao-he': [[17, 29], [17, 30]],
  'npc-old-chen': [[40, 24], [41, 24]],
  'npc-gu-yue-lan': [[19, 19], [20, 19]],
  'npc-gu-yue-fang': [[34, 27], [34, 28]],
  'npc-aunt-hua': [[19, 35], [19, 34]],
  'npc-gu-yue-bo': [[24, 20]],
  'npc-gu-yue-chi-lian': [[37, 31]],
  'npc-gu-yue-mo-bei': [[26, 34], [27, 34]],
};
export function areaNpcDefinitions(area: AreaDefinition): Readonly<NpcDefinition>[] {
  return area.npcSpawns.map(spawn => {
    const definition = TEST_NPCS.find(n => n.id === spawn.id);
    if (!definition) throw new Error(`NPC não definido: ${spawn.id}`);
    return { ...definition, x: spawn.x * 32, y: spawn.y * 32,
      faction: 'A definir', routine: ROUTINES[spawn.id]?.map(([x, y]) => ({ x: x * 32, y: y * 32 })) };
  });
}
export function areaMobDefinitions(area: AreaDefinition): Readonly<MobDefinition>[] {
  return area.mobSpawns.map(spawn => {
    const definition = TEST_MOBS.find(m => m.id === (spawn.speciesId ?? spawn.id));
    if (!definition) throw new Error(`Mob não definido: ${spawn.speciesId ?? spawn.id}`);
    return { ...definition, id: spawn.id, spriteId: definition.id,
      x: spawn.x * 32, y: spawn.y * 32 };
  });
}
export const OPPOSITE: Readonly<Record<Side, Side>> = {
  north: 'south', east: 'west', south: 'north', west: 'east',
};
