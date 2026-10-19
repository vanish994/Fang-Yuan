export interface TilePoint { x: number; y: number }
export interface WorldPoint { x: number; y: number }
type Direction = 'up' | 'down' | 'left' | 'right';

/** Menor caminho cardinal no grid (para áreas com obstáculos futuros). */
export function findCardinalPath(
  start: TilePoint,
  goal: TilePoint,
  cols: number,
  rows: number,
  canStand: (x: number, y: number) => boolean,
  canStep: (x: number, y: number, nextX: number, nextY: number) => boolean,
): TilePoint[] | null {
  const valid = (point: TilePoint) => Number.isInteger(point.x) && Number.isInteger(point.y)
    && point.x >= 0 && point.y >= 0 && point.x < cols && point.y < rows;
  if (!valid(start) || !valid(goal) || !canStand(start.x, start.y) || !canStand(goal.x, goal.y)) return null;

  const total = cols * rows;
  const startId = start.y * cols + start.x;
  const goalId = goal.y * cols + goal.x;
  const previous = new Int32Array(total).fill(-1);
  const queue = new Int32Array(total);
  let head = 0, tail = 0;
  queue[tail++] = startId;
  previous[startId] = startId;
  const offsets = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;

  while (head < tail && previous[goalId] === -1) {
    const current = queue[head++]!;
    const x = current % cols;
    const y = Math.floor(current / cols);
    for (const [dx, dy] of offsets) {
      const nextX = x + dx, nextY = y + dy;
      if (nextX < 0 || nextX >= cols || nextY < 0 || nextY >= rows) continue;
      const next = nextY * cols + nextX;
      if (previous[next] !== -1 || !canStep(x, y, nextX, nextY)) continue;
      previous[next] = current;
      queue[tail++] = next;
    }
  }
  if (previous[goalId] === -1) return null;

  const reversed: TilePoint[] = [];
  for (let id = goalId; ; id = previous[id]!) {
    reversed.push({ x: id % cols, y: Math.floor(id / cols) });
    if (id === startId) break;
  }
  return reversed.reverse();
}

/** Converte um desvio pelo grid em trechos retos pelos centros dos tiles. */
export function toWorldWaypoints(
  current: WorldPoint, path: TilePoint[], tileSize: number,
): WorldPoint[] {
  if (path.length <= 1) return [];
  const result: WorldPoint[] = [];
  const center = (tile: TilePoint): WorldPoint => ({
    x: (tile.x + 0.5) * tileSize, y: (tile.y + 0.5) * tileSize,
  });
  const push = (point: WorldPoint) => {
    const last = result.at(-1) ?? current;
    if (Math.abs(last.x - point.x) > 0.5 || Math.abs(last.y - point.y) > 0.5) result.push(point);
  };
  const first = center(path[0]!);
  push({ x: first.x, y: current.y });
  push(first);
  for (let i = 1; i < path.length; i++) {
    const here = path[i]!;
    const before = path[i - 1]!;
    const after = path[i + 1];
    if (!after || here.x - before.x !== after.x - here.x || here.y - before.y !== after.y - here.y) {
      push(center(here));
    }
  }
  return result;
}

/**
 * Caminho mais curto em pixels até o toque no terreno plano: distância Manhattan
 * |dx| + |dy|. Ao recalcular em movimento, prefere continuar no sentido atual;
 * se estava parado, deixa a perna maior por último. Se surgir um obstáculo,
 * usa o menor caminho cardinal do grid como desvio.
 */
export function shortestWorldWaypoints(
  current: WorldPoint,
  clicked: WorldPoint,
  tilesPerSide: number,
  tileSize: number,
  canStand: (x: number, y: number) => boolean,
  canStep: (x: number, y: number, nextX: number, nextY: number) => boolean,
  facing?: Direction,
  moving = false,
  canTraverse?: (from: WorldPoint, to: WorldPoint) => boolean,
): WorldPoint[] | null {
  const worldSize = tilesPerSide * tileSize;
  if (!Number.isFinite(clicked.x) || !Number.isFinite(clicked.y)
    || clicked.x < 0 || clicked.y < 0 || clicked.x >= worldSize || clicked.y >= worldSize) return null;
  // Os pés não devem ficar além do limite físico do mundo.
  const margin = Math.min(11, tileSize / 2 - 1);
  const goal = {
    x: Math.max(margin, Math.min(worldSize - margin, clicked.x)),
    y: Math.max(margin, Math.min(worldSize - margin, clicked.y)),
  };
  const tile = (point: WorldPoint): TilePoint => ({
    x: Math.floor(point.x / tileSize), y: Math.floor(point.y / tileSize),
  });
  const startTile = tile(current), goalTile = tile(goal);
  if (!canStand(startTile.x, startTile.y) || !canStand(goalTile.x, goalTile.y)) return null;

  const clear = (from: WorldPoint, to: WorldPoint): boolean => {
    if (from.x !== to.x && from.y !== to.y) return false;
    // Testar só a célula dos pés perde colisões quando o corpo invade a linha de cima.
    if (canTraverse && !canTraverse(from, to)) return false;
    const a = tile(from), b = tile(to);
    if (from.x !== to.x) {
      const dir = Math.sign(b.x - a.x);
      for (let x = a.x; x !== b.x; x += dir) {
        if (!canStep(x, a.y, x + dir, a.y)) return false;
      }
    } else if (from.y !== to.y) {
      const dir = Math.sign(b.y - a.y);
      for (let y = a.y; y !== b.y; y += dir) {
        if (!canStep(a.x, y, a.x, y + dir)) return false;
      }
    }
    return true;
  };

  const candidates: WorldPoint[][] = [
    [{ x: goal.x, y: current.y }, goal],
    [{ x: current.x, y: goal.y }, goal],
  ];
  const valid = candidates.filter((points) =>
    clear(current, points[0]!) && clear(points[0]!, points[1]!));
  if (valid.length) {
    const score = (points: WorldPoint[]): number => {
      const first = points[0]!, last = points[1]!;
      const finalLength = Math.abs(last.x - first.x) + Math.abs(last.y - first.y);
      const firstDirection: Direction | null = first.x !== current.x
        ? first.x > current.x ? 'right' : 'left'
        : first.y !== current.y ? first.y > current.y ? 'down' : 'up' : null;
      // As duas rotas diretas têm a mesma distância Manhattan. Durante a
      // caminhada, continuar no sentido atual evita virar e desvirar ao retocar.
      return finalLength * 2 + (moving && firstDirection === facing ? worldSize * 3 : 0)
        + Number(firstDirection === facing);
    };
    valid.sort((a, b) => score(b) - score(a));
    const result: WorldPoint[] = [];
    for (const point of valid[0]!) {
      const previous = result.at(-1) ?? current;
      if (Math.abs(point.x - previous.x) > 0.5 || Math.abs(point.y - previous.y) > 0.5) result.push(point);
    }
    return result;
  }

  const path = findCardinalPath(startTile, goalTile, tilesPerSide, tilesPerSide, canStand, canStep);
  if (!path) return null;
  let detour: WorldPoint[];
  if (canTraverse) {
    const first = { x: (startTile.x + 0.5) * tileSize, y: (startTile.y + 0.5) * tileSize };
    // Aproximar o centro por um eixo de cada vez: o primeiro alinhamento pode
    // tocar a quina da parede, enquanto o segundo contorna sem teleporte.
    const align = [{ x: first.x, y: current.y }, { x: current.x, y: first.y }]
      .find(point => canTraverse(current, point) && canTraverse(point, first));
    if (!align) return null;
    detour = [];
    const push = (point: WorldPoint) => {
      const previous = detour.at(-1) ?? current;
      if (Math.abs(point.x - previous.x) > 0.5 || Math.abs(point.y - previous.y) > 0.5)
        detour.push(point);
    };
    push(align);
    push(first);
    for (const point of toWorldWaypoints(first, path, tileSize)) push(point);
    let previous = current;
    for (const point of detour) {
      if (!canTraverse(previous, point)) return null;
      previous = point;
    }
  } else detour = toWorldWaypoints(current, path, tileSize);
  const end = detour.at(-1) ?? current;
  if (canTraverse && end.x === current.x && end.y === current.y) return null;
  // O desvio também termina no pixel escolhido, nunca só no centro do tile.
  const final = shortestWorldWaypoints(end, goal, tilesPerSide, tileSize,
    canStand, canStep, facing, false, canTraverse);
  return final ? [...detour, ...final] : null;
}
