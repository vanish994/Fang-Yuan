import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

import { moduleURL } from './support/tsModule.mjs';

/**
 * Verificação de lado dos sprites lendo os PIXELS do atlas publicado.
 *
 * O usuário relatou duas vezes que a caminhada para a esquerda/direita saía
 * trocada. Heurística sobre "onde está o rosto" já falhou antes (cabelo claro em
 * volta do rosto confunde), então aqui o teste decodifica o PNG de verdade e mede
 * a silhueta da cabeça: o lado do rosto é o lado da cabeça com pixels claros de
 * pele. Se um atlas inverter as linhas laterais, este teste quebra.
 */

/** Decodificador PNG mínimo (8 bits, RGBA ou RGB, sem entrelaçamento). */
function decodePng(bytes) {
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG', 'não é PNG');
  let offset = 8;
  let width = 0, height = 0, colorType = 0, bitDepth = 0;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      assert.equal(data[12], 0, 'PNG entrelaçado não é suportado');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    offset += 12 + length;
  }
  assert.equal(bitDepth, 8, 'esperado PNG de 8 bits');
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  assert.ok(channels > 0, `tipo de cor não suportado: ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * channels);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      const value = line[x];
      let out;
      if (filter === 0) out = value;
      else if (filter === 1) out = value + left;
      else if (filter === 2) out = value + up;
      else if (filter === 3) out = value + ((left + up) >> 1);
      else if (filter === 4) out = value + paeth(left, up, upLeft);
      else throw new Error(`filtro PNG desconhecido: ${filter}`);
      pixels[y * stride + x] = out & 0xff;
    }
  }
  return { width, height, channels, pixels,
    at(x, y) {
      const i = (y * width + x) * channels;
      return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2],
        a: channels === 4 ? pixels[i + 3] : 255 };
    } };
}

/**
 * Lado para onde a cabeça de um quadro aponta, em pixels do atlas.
 *
 * 1. acha a silhueta do quadro (alfa) e a faixa da cabeça (topo do corpo);
 * 2. dentro dela, acha os pixels de pele (claros e quentes — o rosto);
 * 3. compara o centro da pele com o centro da cabeça.
 * Devolve `null` quando não há pele suficiente (linhas de frente e de costas).
 */
function faceSide(image, cell, row, column = 0) {
  const x0 = column * cell, y0 = row * cell;
  const opaque = [];
  for (let y = 0; y < cell; y++) {
    for (let x = 0; x < cell; x++) {
      const pixel = image.at(x0 + x, y0 + y);
      if (pixel.a > 100) opaque.push({ x, y, ...pixel });
    }
  }
  if (opaque.length === 0) return null;
  const ys = opaque.map(pixel => pixel.y);
  const top = Math.min(...ys), bottom = Math.max(...ys);
  // 45% do corpo: nas poses de queda a cabeça está mais baixa (ajoelhado/deitado).
  const headLimit = top + (bottom - top) * 0.45;
  const head = opaque.filter(pixel => pixel.y <= headLimit);
  const xs = head.map(pixel => pixel.x);
  const headCenter = (Math.min(...xs) + Math.max(...xs)) / 2;
  // Pele = pixel claro e quente. Os limites foram calibrados nos oito atlas
  // (inclusive o cabelo branco do Bai Ning Bing e as poses deitadas).
  const skin = head.filter(pixel => pixel.r > 95 && pixel.r + pixel.g + pixel.b > 250
    && pixel.r >= pixel.b + 6);
  if (skin.length < 6) return null;
  const skinCenter = skin.reduce((sum, pixel) => sum + pixel.x, 0) / skin.length;
  const delta = (skinCenter - headCenter) / ((Math.max(...xs) - Math.min(...xs)) / 2 || 1);
  if (delta > 0.08) return 'right';
  if (delta < -0.08) return 'left';
  return null;
}

const atlas = name => decodePng(readFileSync(new URL(`../public/assets/characters/${name}`, import.meta.url)));

const CHARACTERS = ['fang-yuan', 'bai-ning-bing'];
const POSES = ['walk', 'cast', 'dash', 'down'];
const poses = await import(moduleURL('entities/playerPoses'));

test('linhas laterais dos dois personagens olham para o lado certo (pixels do atlas)', () => {
  for (const character of CHARACTERS) {
    for (const pose of POSES) {
      const image = atlas(`${character}-${pose}-64.png`);
      assert.equal(image.width, 256, `${character}/${pose}: 4 × 64`);
      assert.equal(image.height, 256, `${character}/${pose}: 4 × 64`);
      // Linha 1 é a de "esquerda", linha 3 a de "direita" no atlas publicado.
      const left = faceSide(image, 64, 1);
      const right = faceSide(image, 64, 3);
      assert.equal(left, 'left',
        `${character}/${pose}: a linha 1 deveria olhar para a ESQUERDA (veio ${left})`);
      assert.equal(right, 'right',
        `${character}/${pose}: a linha 3 deveria olhar para a DIREITA (veio ${right})`);
      // As duas linhas laterais não podem ser o mesmo desenho, e nenhuma pose
      // pode repetir a linha da esquerda na da direita.
      assert.notEqual(left, right, `${character}/${pose}: linhas laterais iguais`);
    }
  }
});

test('o motor escolhe a linha lateral certa para cada direção', () => {
  // O sprite usa `playerPoseFrameRange`; a linha é `start / 4`.
  const rowOf = direction => poses.playerPoseFrameRange(direction).start / 4;
  assert.equal(rowOf('down'), 0);
  assert.equal(rowOf('left'), 1, 'andar para a esquerda usa a linha 1');
  assert.equal(rowOf('up'), 2);
  assert.equal(rowOf('right'), 3, 'andar para a direita usa a linha 3');
  // A ordem das linhas é a mesma nos dois personagens.
  assert.deepEqual(poses.POSE_FRAME_DIRECTIONS, ['down', 'left', 'up', 'right']);
  // E a mesma em todas as poses (uma troca de pose não muda a linha da direção).
  for (const pose of poses.PLAYER_POSES) {
    const keyLeft = poses.playerPoseAnimationKey('fang-yuan', pose, 'left');
    assert.ok(keyLeft.startsWith('fang-yuan-'), keyLeft);
  }
});

test('sprites e efeitos carregam com versão na URL (cache do navegador não mente)', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  // Arquivos de arte mantêm o mesmo nome entre versões; a query muda com a arte,
  // senão o navegador/proxy pode continuar mostrando o PNG antigo.
  assert.match(main, /import \{ ART_VERSION \} from '\.\/assets\/artVersion'/);
  assert.match(main, /\?v=\$\{ART_VERSION\}/);
  // Toda folha de personagem/efeito passa pela versão (nada de URL fixa).
  assert.match(main, /artURL\(`assets\/characters\/\$\{art\}-\$\{pose\}-64\.png`\)/);
  assert.match(main, /artURL\('assets\/characters\/gu-effects-4x4-32\.png'\)/);
  assert.match(main, /artURL\('assets\/characters\/ice-effects-4x4-48\.png'\)/);
  const css = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');
  for (const asset of ['fang-yuan-walk-32.png', 'bai-ning-bing-walk-32.png']) {
    assert.ok(css.includes(`${asset}?v=`), `${asset}: retrato precisa da versão na URL`);
  }
  // A versão é gerada a partir do CONTEÚDO dos atlas: se um atlas mudar e a versão
  // não acompanhar, o teste quebra (era exatamente o furo do cache).
  const versionModule = readFileSync(new URL('../src/assets/artVersion.ts', import.meta.url), 'utf8');
  const version = /ART_VERSION = '([0-9a-f]+)'/.exec(versionModule)?.[1];
  assert.ok(version && version.length >= 8, 'artVersion.ts precisa exportar a versão');
  const folder = new URL('../public/assets/characters/', import.meta.url);
  const files = readdirSync(folder).filter(name =>
    /^(fang-yuan|bai-ning-bing|gu-effects|ice-effects).*\.png$/.test(name)).sort();
  assert.ok(files.length >= 10, `atlas de arte encontrados: ${files.length}`);
  const digest = createHash('sha256');
  for (const name of files) {
    digest.update(name);
    digest.update(readFileSync(new URL(name, folder)));
  }
  assert.equal(digest.digest('hex').slice(0, 10), version,
    'artVersion.ts está desatualizado: rode scripts/build-sprite-atlases.py');
  // Os retratos no CSS usam exatamente a versão gerada.
  for (const asset of ['fang-yuan-walk-32.png', 'bai-ning-bing-walk-32.png']) {
    assert.ok(css.includes(`${asset}?v=${version}`), `${asset}: versão do CSS fora de sincronia`);
  }
});
