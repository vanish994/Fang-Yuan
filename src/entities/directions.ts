export const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
export type CardinalDirection = (typeof DIRECTIONS)[number];

/** Evita alternar a orientação por correções de poucos pixels ao retocar. */
export const MIN_TURN_DISTANCE = 8;
export function shouldTurnForSegment(distance: number): boolean {
  return distance >= MIN_TURN_DISTANCE;
}

export function directionVector(direction: CardinalDirection | null): { x: number; y: number } {
  switch (direction) {
    case 'up': return { x: 0, y: -1 };
    case 'down': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
    default: return { x: 0, y: 0 };
  }
}
