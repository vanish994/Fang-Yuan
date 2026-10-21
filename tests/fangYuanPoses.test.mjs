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
  // A classe do sprite virou `PlayerCharacter` (serve os dois personagens); as
  // garantias de escala e hitbox continuam as mesmas.
  const source = readFileSync(new URL('../src/entities/PlayerCharacter.ts', import.meta.url), 'utf8');
  assert.match(source, /setScale\(0\.5\)/, 'continua 32px no mapa');
  assert.match(source, /setSize\(28, 20\)\.setOffset\(18, 40\)/, 'hitbox preservada');
  // O corpo do master é escalado por um fator único para as quatro poses: se cada
  // pose calculasse o próprio fator, o personagem mudaria de tamanho ao atacar.
  const build = readFileSync(new URL('../scripts/build-sprite-atlases.py', import.meta.url), 'utf8');
  // Um fator por personagem e um fator comum aos dois (ninguém fica maior que o outro).
  assert.match(build, /def pose_scale\(/);
  assert.match(build, /def player_scale\(\)/);
  assert.match(build, /scale = player_scale\(\)/);
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
  const source = readFileSync(new URL('../src/entities/PlayerCharacter.ts', import.meta.url), 'utf8');
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
  // Os dois personagens jogáveis entram no mesmo laço de quatro poses.
  assert.ok(main.includes("for (const art of ['fang-yuan', 'bai-ning-bing'])"),
    'as poses dos dois personagens são pré-carregadas');
  assert.ok(main.includes('assets/characters/${art}-${pose}-64.png'), 'caminho das quatro poses');
  assert.match(main, /\.png`[\s\S]*?frameWidth: 64, frameHeight: 64/, 'poses em 64px');
  assert.ok(main.includes('gu-effects-4x4-32.png'), 'folha de partículas carregada');
  assert.match(main, /gu-effects-4x4-32\.png'[\s\S]*?frameWidth: 32, frameHeight: 32/,
    'partículas em 32px');
  assert.ok(main.includes('ice-effects-4x4-48.png'), 'folha de gelo carregada');
  assert.match(main, /ice-effects-4x4-48\.png'[\s\S]*?frameWidth: 48, frameHeight: 48/,
    'partículas de gelo em 48px');
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

test('masters têm as linhas laterais trocadas e o build corrige isso', () => {
  const build = readFileSync(new URL('../scripts/build-sprite-atlases.py', import.meta.url), 'utf8');
  // 1ª linha do master = direita e 4ª = esquerda; o atlas do jogo é baixo/esquerda/cima/direita.
  assert.match(build, /MASTER_ROW_MAP = \[0, 3, 2, 1\]/,
    'sem a troca, andar para a esquerda desenha o sprite virado para a direita');
  assert.match(build, /feet_anchor=True, row_map=MASTER_ROW_MAP/);
  // A checagem roda na geração: se a ordem voltar a ficar invertida, o build falha.
  assert.match(build, /def check_side_rows\(/);
  assert.match(build, /expected = \{1: 'left', 3: 'right'\}/);
  assert.match(build, /check_side_rows\(DEST \/ f'characters\/\{character\}-\{pose\}-64\.png'/);
  // A troca vale para os dois personagens (mesma origem de arte).
  assert.match(build, /for character, masters in PLAYER_MASTERS\.items\(\)/);
  // A ordem publicada continua a mesma que o resto do elenco usa.
  assert.deepEqual(poses2.FANG_YUAN_FRAME_DIRECTIONS, ['down', 'left', 'up', 'right']);
});
