import type { Direction } from '../combat/types';

/** Um único eixo cardinal por toque; zona morta evita giros quando o dedo repousa. */
export function cardinalFromTouch(dx: number, dy: number, deadzone = 9): Direction | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < deadzone) return null;
  return Math.abs(dx) >= Math.abs(dy)
    ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
}
