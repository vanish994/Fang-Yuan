#!/usr/bin/env node
/**
 * Exporta o mapa da vila para o formato JSON do Tiled (.tmj), em public/assets/village/.
 *
 * O mapa é código TypeScript, então primeiro compile os dois módulos para uma pasta temporária:
 *
 *   npx -p typescript@5.9.3 tsc src/world/village/villageMap.ts src/world/village/assetCatalog.ts \
 *     --outDir /tmp/village-js --module commonjs --target es2022 --strict --skipLibCheck \
 *     --esModuleInterop --rootDir src/world/village
 *
 * Depois rode este script (com a pasta acima como argumento, padrão /tmp/village-js):
 *
 *   node scripts/export-village-tiled.cjs /tmp/village-js
 *
 * Os caminhos de imagem são relativos ao .tmj. Gere os recortes antes com
 * scripts/build-village-assets.py.
 */
const fs = require('fs');
const path = require('path');

const jsDir = path.resolve(process.argv[2] || '/tmp/village-js');
const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'public/assets/village/vila-inicial-da-montanha.tmj');
const { buildVillageMap, TILE, MAP_COLS, MAP_ROWS } = require(path.join(jsDir, 'villageMap.js'));
const cat = require(path.join(jsDir, 'assetCatalog.js'));

const map = buildVillageMap(2024);

// Tileset de arte: cada imagem usada vira um tile da coleção (gid = firstgid + id).
const art = [];
const artId = new Map();
function artGid(image, w, h) {
  if (!artId.has(image)) {
    artId.set(image, art.length);
    art.push({ image, w, h });
  }
  return artId.get(image);
}
const HM_BASE = 'tiles/';
const FEUDAL = 'props/';
const frameInfo = new Map();
for (const sh of cat.HARMONIOUS_SHEETS) for (const f of sh.frames) frameInfo.set(f.name, f);

const GROUND_FIRST = 1;
const ART_FIRST = GROUND_FIRST + 12;

let nextObj = 1;
const newObj = (o) => ({ id: nextObj++, rotation: 0, visible: true, ...o });
const tileData = (grid) => grid.flat().map((i) => (i < 0 ? 0 : i + GROUND_FIRST));

// Imagens do platô, do lago e da água. Em objetos de tile, y é a base (borda inferior).
const imagesObjs = [];
for (const im of map.images) {
  let image, w, h;
  if (im.frame) {
    image = HM_BASE + 'lake-water.png';
    w = 32;
    h = 32;
  } else if (im.texture === 'hm-plateau') {
    image = '../tilesets/harmonious-seasons/Cliffs/Cliffs_Grass.png';
    w = 960;
    h = 480;
  } else {
    image = '../tilesets/harmonious-seasons/Water/WaterEdges/Deep_Water_Grass.png';
    w = 672;
    h = 320;
  }
  const gid = ART_FIRST + artGid(image, w, h);
  const dw = w * im.scale;
  const dh = h * im.scale;
  imagesObjs.push(newObj({ gid, x: im.x, y: im.y + dh, width: dw, height: dh }));
}

// Decoração: a base do objeto (centro inferior) vira o canto inferior esquerdo no Tiled.
const flatObjs = [];
const objObjs = [];
for (const d of map.decor) {
  let image, w, h;
  if (d.frame) {
    const f = frameInfo.get(d.frame);
    image = HM_BASE + d.frame + '.png';
    w = f.w;
    h = f.h;
  } else {
    const name = d.texture.slice(4);
    const p = cat.FEUDAL_PROPS[name];
    image = FEUDAL + name + '.png';
    w = p.w;
    h = p.h;
  }
  const gid = ART_FIRST + artGid(image, w, h);
  const o = newObj({ gid, x: d.x - d.w / 2, y: d.y, width: d.w, height: d.h });
  (d.flat ? flatObjs : objObjs).push(o);
}

const colObjs = map.solids.map((r) =>
  newObj({ name: 'solido', type: 'colisao', x: r.x, y: r.y, width: r.w, height: r.h }),
);
const spawn = newObj({ name: 'spawn', type: 'inicio', x: map.spawn.x, y: map.spawn.y, width: 0, height: 0, point: true });

const layers = [
  { id: 1, name: 'chao', type: 'tilelayer', width: MAP_COLS, height: MAP_ROWS, x: 0, y: 0, opacity: 1, visible: true, data: tileData(map.ground) },
  { id: 2, name: 'sobreposicao', type: 'tilelayer', width: MAP_COLS, height: MAP_ROWS, x: 0, y: 0, opacity: 1, visible: true, data: tileData(map.overlay) },
  { id: 3, name: 'imagens', type: 'objectgroup', draworder: 'index', x: 0, y: 0, opacity: 1, visible: true, objects: imagesObjs },
  { id: 4, name: 'chao_objetos', type: 'objectgroup', draworder: 'index', x: 0, y: 0, opacity: 1, visible: true, objects: flatObjs },
  { id: 5, name: 'objetos', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: objObjs },
  { id: 6, name: 'colisao', type: 'objectgroup', draworder: 'index', x: 0, y: 0, opacity: 1, visible: true, objects: colObjs },
  { id: 7, name: 'spawn', type: 'objectgroup', draworder: 'index', x: 0, y: 0, opacity: 1, visible: true, objects: [spawn] },
];

const tilesets = [
  {
    firstgid: GROUND_FIRST, name: 'ground', type: 'tileset', tilewidth: TILE, tileheight: TILE,
    margin: 0, spacing: 0, columns: 6, tilecount: 12,
    image: '../tilesets/free-asset-pack/ground-atlas-64.png', imagewidth: 384, imageheight: 128,
  },
  {
    firstgid: ART_FIRST, name: 'vila-arte', type: 'tileset', tilewidth: TILE, tileheight: TILE,
    margin: 0, spacing: 0, columns: 0, tilecount: art.length,
    tiles: art.map((a, id) => ({ id, image: a.image, imagewidth: a.w, imageheight: a.h, width: a.w, height: a.h })),
  },
];

const tmj = {
  type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down',
  infinite: false, width: MAP_COLS, height: MAP_ROWS, tilewidth: TILE, tileheight: TILE,
  compressionlevel: -1, layers, tilesets, nextlayerid: 8, nextobjectid: nextObj,
};
fs.writeFileSync(OUT, JSON.stringify(tmj));
console.log('escrito', path.relative(REPO, OUT), '| camadas', layers.length, '| tiles de arte', art.length, '| objetos', nextObj - 1);
