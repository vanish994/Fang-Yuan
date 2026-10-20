import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { moduleURL } from './support/tsModule.mjs';

const poses2 = await import(moduleURL('entities/fangYuanPoses'));

const png = relative => readFileSync(new URL(`../public/assets/${relative}`, import.meta.url));
const dimensions = relative => {
  const file = png(relative);
  assert.equal(file.subarray(1, 4).toString(), 'PNG', `${relative}: não é PNG`);
  assert.equal(file[25], 6, `${relative}: falta alfa`);
  return [file.readUInt32BE(16), file.readUInt32BE(20)];
};

test('quatro poses do Fang Yuan em atlas 4×4 de 64px, iguais em tamanho', () => {
  for (const pose of poses2.FANG_YUAN_POSES) {
    const path = `characters/fang-yuan-${pose}-64.png`;
    assert.deepEqual(dimensions(path), [256, 256], `${pose}: atlas 4×4 de 64px`);
    assert.ok(statSync(new URL(`../public/assets/${path}`, import.meta.url)).size > 20_000,
      `${pose}: atlas suspeito de estar vazio`);
  }
  assert.deepEqual(poses2.FANG_YUAN_POSES, ['walk', 'cast', 'dash', 'down']);
  assert.deepEqual(Object.keys(poses2.FANG_YUAN_POSE_TEXTURE).sort(),
    ['cast', 'dash', 'down', 'walk']);
  // O retrato do painel continua sendo a pose de caminhada em 32px (4×4).
  assert.deepEqual(dimensions('characters/fang-yuan-walk-32.png'), [128, 128]);
});

test('pose não muda o tamanho lógico nem a hitbox do personagem', () => {
  const source = readFileSync(new URL('../src/entities/FangYuan.ts', import.meta.url), 'utf8');
  assert.match(source, /setScale\(0\.5\)/, 'continua 32px no mapa');
  assert.match(source, /setSize\(28, 20\)\.setOffset\(18, 40\)/, 'hitbox preservada');
  // O corpo do master é escalado por um fator único para as quatro poses: se cada
  // pose calculasse o próprio fator, o personagem mudaria de tamanho ao atacar.
  const build = readFileSync(new URL('../scripts/build-sprite-atlases.py', import.meta.url), 'utf8');
  assert.match(build, /def fang_yuan_scale\(\)/);
  assert.match(build, /scale = fang_yuan_scale\(\)/);
});

test('direção usa a mesma linha nas quatro poses e a caminhada repete', () => {
  for (const pose of poses2.FANG_YUAN_POSES) {
    const rows = poses2.FANG_YUAN_FRAME_DIRECTIONS.map(direction =>
      poses2.poseFrameRange(direction).start / 4);
    assert.deepEqual(rows, [0, 1, 2, 3], `${pose}: linhas baixo, esquerda, cima, direita`);
    for (const direction of poses2.FANG_YUAN_FRAME_DIRECTIONS) {
      const range = poses2.poseFrameRange(direction);
      assert.equal(range.end - range.start + 1, 4, `${pose}/${direction}: quatro quadros`);
      assert.match(poses2.poseAnimationKey(pose, direction), new RegExp(`^fang-yuan-${pose}-`));
    }
  }
  const source = readFileSync(new URL('../src/entities/FangYuan.ts', import.meta.url), 'utf8');
  assert.match(source, /repeat: pose === 'walk' \? -1 : 0/,
    'só a caminhada repete: conjuração e queda terminam na última pose');
  // A pose de ação volta sozinha para a caminhada; a queda fica travada até o respawn.
  assert.equal(poses2.FANG_YUAN_POSE_MS.down, null);
  assert.equal(poses2.FANG_YUAN_POSE_MS.walk, null);
  assert.ok(poses2.FANG_YUAN_POSE_MS.cast > 0 && poses2.FANG_YUAN_POSE_MS.dash > 0);
});

test('main.ts liga as poses e as partículas sem tocar nas regras de combate', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  // Texturas carregadas no preload, com a mesma célula de 64px do resto do elenco.
  for (const pose of ['cast', 'dash', 'down']) {
    assert.ok(main.includes(`fang-yuan-${pose}-64.png`), `preload da pose ${pose}`);
  }
  assert.ok(main.includes('gu-effects-4x4-32.png'), 'folha de partículas carregada');
  assert.match(main, /gu-effects-4x4-32\.png'[\s\S]*?frameWidth: 32, frameHeight: 32/,
    'partículas em 32px');
  // Uma ação bem-sucedida vira pose + partícula; a queda trava até o respawn.
  assert.ok(main.includes("this.player.playPose(dash ? 'dash' : 'cast', now)"),
    'pose de ação aplicada à apresentação');
  assert.ok(main.includes("this.player.playPose('down', this.time.now, null)"),
    'queda travada no último quadro');
  assert.ok(main.includes('this.player.resetPose()'), 'respawn volta à caminhada');
  assert.ok(main.includes("this.guEffects?.burst('death'"), 'estouro da morte do herói');
  // Nenhuma chamada de dano/efeito do motor foi trocada por animação.
  assert.ok(main.includes('this.combat.activate(equipped, now, direction, this.isFree)'));
  assert.ok(main.includes('this.combat.dash(now, movementDirection, this.isFree)'));
});
