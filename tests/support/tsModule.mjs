import { readFileSync } from 'node:fs';
import ts from 'typescript';

/**
 * Test loader for the TypeScript modules without a build step.
 *
 * `node:test` cannot import `.ts` directly, so each module is transpiled and
 * embedded as a data URL. Imports are resolved recursively, which keeps the
 * tests honest when a module gains a new dependency (before this helper the
 * import map had to be patched by hand in every test file).
 */
const cache = new Map();
const building = new Set();

const SRC = new URL('../../src/', import.meta.url);

function resolveSpecifier(specifier, fromPath) {
  const base = new URL(fromPath, SRC);
  const resolved = new URL(specifier, base);
  const relative = decodeURIComponent(resolved.pathname.slice(SRC.pathname.length)).replace(/\.ts$/, '');
  return relative;
}

function transpile(path) {
  const source = readFileSync(new URL(`${path}.ts`, SRC), 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

export function moduleURL(path, overrides = {}) {
  if (cache.has(path)) return cache.get(path);
  if (building.has(path)) throw new Error(`Ciclo de importação não suportado no carregador de testes: ${path}`);
  building.add(path);
  try {
    let javascript = transpile(path);
    const specifiers = [...javascript.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(match => match[1]);
    for (const specifier of new Set(specifiers)) {
      if (!specifier.startsWith('.')) continue; // phaser e afins não são carregados nos testes
      const url = overrides[specifier] ?? moduleURL(resolveSpecifier(specifier, path));
      javascript = javascript.split(`from '${specifier}'`).join(`from '${url}'`)
        .split(`from "${specifier}"`).join(`from '${url}'`);
    }
    const url = `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`;
    cache.set(path, url);
    return url;
  } finally {
    building.delete(path);
  }
}
