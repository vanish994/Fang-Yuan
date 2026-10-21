// Sprite fornecido pelo usuário: 1408 × 128 px, 11 quadros horizontais de 128 × 128.
// O quadro 0 mostra o mar vazio; o quadro 10 mostra o mar cheio.
export const PRIMORDIAL_SEA_FRAME_COUNT = 11;
export const SHEET_SEA_SIZE = 112;

/** Seleciona um quadro de nível; o valor preciso continua indicado em números e barra. */
export function primordialSeaFrame(current: number, capacity: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(capacity) || capacity <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, current / capacity));
  return Math.round(ratio * (PRIMORDIAL_SEA_FRAME_COUNT - 1));
}

/** Posição horizontal do atlas escalado para um quadro de tamanho displaySize. */
export function primordialSeaOffset(current: number, capacity: number, displaySize: number): number {
  return -primordialSeaFrame(current, capacity) * displaySize;
}
