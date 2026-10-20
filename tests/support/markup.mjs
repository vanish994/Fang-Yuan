import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);

/** Markup da página, sem CSS inline. */
export function readHtml() {
  return readFileSync(new URL('index.html', root), 'utf8');
}

/**
 * Todo o CSS da página: folhas ligadas por `<link rel="stylesheet">` mais
 * eventuais blocos `<style>` restantes. Ler o CSS por aqui mantém os testes
 * válidos se a folha for dividida em mais arquivos.
 */
export function readStyles() {
  const html = readHtml();
  const parts = [];
  for (const match of html.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)) {
    parts.push(readFileSync(new URL(`.${match[1]}`, root), 'utf8'));
  }
  for (const match of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) parts.push(match[1]);
  return parts.join('\n');
}
