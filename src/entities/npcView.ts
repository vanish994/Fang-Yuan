import Phaser from 'phaser';
import { TEST_NPCS, NpcBrain, type NpcDefinition } from './npc';
import type { Direction } from '../combat/types';

export interface NpcViewRecord {
  definition: NpcDefinition;
  brain: NpcBrain;
  view: Phaser.GameObjects.Container;
}

/**
 * Renderizador temporário de NPCs. Usa círculos enquanto os sprites não existem.
 * Interação é intencionalmente simples: tocar/clicar mostra o nome e a fala.
 */
export function createTestNpcViews(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Layer,
  isFree: (x: number, y: number) => boolean,
  say: (message: string) => void,
): NpcViewRecord[] {
  return TEST_NPCS.flatMap((definition) => {
    if (!isFree(definition.x, definition.y)) return [];
    const brain = new NpcBrain(definition);
    const circle = scene.add.circle(0, -10, 10, 0x4b83c4).setStrokeStyle(2, 0xf4ce8d)
      .setInteractive({ useHandCursor: true });
    const name = scene.add.text(0, -31, definition.name, {
      fontSize: '8px', color: '#fff0d0', backgroundColor: '#192318bb',
    }).setOrigin(0.5);
    const role = scene.add.text(0, 4, definition.role.toUpperCase(), {
      fontSize: '6px', color: '#d7e8ff',
    }).setOrigin(0.5);
    const view = scene.add.container(definition.x, definition.y, [circle, name, role])
      .setName(`NPC:${definition.id}`).setDepth(definition.y);
    circle.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number,
      event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      say(`${definition.name}: “${definition.dialogue}”`);
    });
    layer.add(view);
    return [{ definition, brain, view }];
  });
}

export function updateTestNpcViews(
  records: NpcViewRecord[],
  now: number,
  deltaMs: number,
  isFree: (x: number, y: number) => boolean,
): void {
  const directions: Record<Direction, { x: number; y: number }> = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
  };
  for (const record of records) {
    const intent = record.brain.decide(now);
    if (!intent.direction) {
      record.view.setDepth(record.definition.y);
      continue;
    }
    const vector = directions[intent.direction];
    const speed = 18;
    const distance = speed * Math.min(deltaMs, 50) / 1000;
    const nextX = record.definition.x + vector.x * distance;
    const nextY = record.definition.y + vector.y * distance;
    const dx = nextX - record.view.x;
    const dy = nextY - record.view.y;
    const fromHome = Math.hypot(nextX - record.definition.x, nextY - record.definition.y);
    if (fromHome <= record.definition.wanderRadius && isFree(nextX, nextY)) {
      record.view.setPosition(nextX, nextY).setDepth(nextY);
      record.definition.x = nextX;
      record.definition.y = nextY;
    } else {
      record.brain.stop();
    }
    if (Math.abs(dx) + Math.abs(dy) > 0) record.view.setData('moving', true);
  }
}
