/**
 * Preservação de saves ilegíveis.
 *
 * Quando `load()` recusa um payload (JSON corrompido, formato desconhecido ou
 * versão futura), o jogo adota o estado padrão e o próximo save sobrescreve o
 * registro original — perdendo inventário, pedras e cultivo sem aviso. Antes de
 * qualquer escrita, copiamos o conteúdo cru para `<chave>.backup`.
 *
 * A primeira cópia nunca é substituída: se o jogador abrir o jogo várias vezes
 * com o save quebrado, o backup continua sendo o original para inspeção ou
 * recuperação manual.
 */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function backupUnreadable(storage: KeyValueStorage | null, key: string,
  raw: string | null): void {
  if (!storage || !raw) return;
  const backupKey = `${key}.backup`;
  try {
    if (storage.getItem(backupKey) === null) storage.setItem(backupKey, raw);
  } catch {
    // Sem espaço ou storage bloqueado: o backup é best-effort e nunca deve
    // impedir o jogo de seguir com o estado padrão.
  }
}
