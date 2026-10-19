import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/ui/displayMode.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { setupDisplayMode } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

function setup({ supported = true, rejects = false, lockRejects = false } = {}) {
  const previousDocument = globalThis.document;
  const previousScreen = globalThis.screen;
  const listeners = new Map();
  const buttonListeners = new Map();
  const attributes = new Map();
  const button = {
    disabled: false, title: '',
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: name => attributes.get(name),
    addEventListener: (name, fn) => buttonListeners.set(name, fn),
    click: () => buttonListeners.get('click')(),
  };
  const feedback = { textContent: '' };
  const document = {
    fullscreenElement: null,
    documentElement: {},
    addEventListener: (name, fn) => listeners.set(name, fn),
    getElementById: id => ({ 'fullscreen-toggle': button, 'display-feedback': feedback })[id],
    exitFullscreen: async () => { document.fullscreenElement = null; listeners.get('fullscreenchange')(); },
  };
  if (supported) document.documentElement.requestFullscreen = async () => {
    if (rejects) throw new Error('denied');
    document.fullscreenElement = document.documentElement;
    listeners.get('fullscreenchange')();
  };
  const locked = [];
  globalThis.document = document;
  globalThis.screen = { orientation: {
    lock: async mode => { locked.push(mode); if (lockRejects) throw new Error('unsupported'); },
  } };
  setupDisplayMode();
  return {
    button, feedback, locked, document,
    restore: () => { globalThis.document = previousDocument; globalThis.screen = previousScreen; },
  };
}

test('tela cheia alterna após clique, sincroniza botão e tenta paisagem', async () => {
  const { button, feedback, locked, document, restore } = setup();
  try {
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    await button.click();
    assert.equal(document.fullscreenElement, document.documentElement);
    assert.deepEqual(locked, ['landscape']);
    assert.equal(button.getAttribute('aria-label'), 'Sair da tela cheia');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    await button.click();
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal(feedback.textContent, '');
  } finally { restore(); }
});

test('sem suporte ou permissão, informa limite; falha no lock não cancela tela cheia', async () => {
  const unavailable = setup({ supported: false });
  try {
    await unavailable.button.click();
    assert.match(unavailable.feedback.textContent, /indisponível/);
    assert.equal(unavailable.button.disabled, false);
  } finally { unavailable.restore(); }
  const denied = setup({ rejects: true });
  try {
    await denied.button.click();
    assert.match(denied.feedback.textContent, /não permitida/);
    assert.equal(denied.button.getAttribute('aria-pressed'), 'false');
  } finally { denied.restore(); }
  const noLock = setup({ lockRejects: true });
  try {
    await noLock.button.click();
    assert.equal(noLock.button.getAttribute('aria-pressed'), 'true');
    assert.equal(noLock.feedback.textContent, '');
  } finally { noLock.restore(); }
});

test('aviso só em celular retrato e controles discretos permanecem em paisagem', () => {
  assert.match(html, /class="rotate-overlay"/);
  assert.match(html, /@media \(orientation: portrait\) and \(pointer: coarse\)/);
  assert.match(html, /id="fullscreen-toggle"[^>]+aria-label="Entrar em tela cheia"/);
  assert.match(html, /class="top-actions"[\s\S]*?id="fullscreen-toggle"[\s\S]*?id="character-toggle"/);
});
