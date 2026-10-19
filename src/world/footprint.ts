/** Arcade usa 14×10px com offset (9,20) no sprite de 32px ancorado nos pés.
 * A máscara de navegação usa a MESMA base do corpo físico, não a roupa inteira. */
export function canStandAt(x: number, y: number, tileSize: number,
  isFreeTile: (column: number, row: number) => boolean, inset = 0): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const left = Math.floor((x - 7 + inset) / tileSize);
  const right = Math.floor((x + 7 - inset) / tileSize);
  const top = Math.floor((y - 12 + inset) / tileSize);
  const bottom = Math.floor((y - 2 - inset) / tileSize);
  return isFreeTile(left, top) && isFreeTile(right, top)
    && isFreeTile(left, bottom) && isFreeTile(right, bottom);
}

interface Position { x: number; y: number }

/** Corrige apenas penetrações subpixel do Arcade na parede lateral. Não pula
 * obstáculos: cada candidato precisa ser um local realmente livre para o corpo. */
export function releaseWallSnag(x: number, y: number,
  direction: 'up' | 'down' | 'left' | 'right', tileSize: number,
  isFreeTile: (column: number, row: number) => boolean): Position {
  if (canStandAt(x, y, tileSize, isFreeTile)) return { x, y };
  const vertical = direction === 'up' || direction === 'down';
  for (const distance of [0.25, 0.5, 1, 2]) {
    for (const side of [-1, 1]) {
      const nx = x + (vertical ? side * distance : 0);
      const ny = y + (vertical ? 0 : side * distance);
      if (canStandAt(nx, ny, tileSize, isFreeTile)) return { x: nx, y: ny };
    }
  }
  return { x, y };
}

/** Um trajeto pode ter extremos livres mas cruzar a parede de outro tile.
 * Amostra todo o corredor em passos curtos, deixando 1px para o resolvedor Arcade. */
export function canWalkSegment(from: Position, to: Position, tileSize: number,
  isFreeTile: (column: number, row: number) => boolean): boolean {
  if (from.x !== to.x && from.y !== to.y) return false; // apenas cardinal
  const distance = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  if (!Number.isFinite(distance)) return false;
  const steps = Math.max(1, Math.ceil(distance / (tileSize / 8)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!canStandAt(from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t, tileSize, isFreeTile, 1)) return false;
  }
  return true;
}
