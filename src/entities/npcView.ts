import type Phaser from 'phaser';
import { TEST_NPCS, NpcBrain, type NpcDefinition, type NpcRole } from './npc';
import type { Direction, Point } from '../combat/types';
import { npcFrame } from './npcSprites';

const ROLE_TINTS: Record<NpcRole, number> = {
  villager: 0xf2ddc4, cultivator: 0xcddafa, merchant: 0xf3deb3, guard: 0xd3e8d4,
  disciple: 0xd7d1f7, elder: 0xe7cbd9, patriarch: 0xf4e2bc,
};
const DIRECTIONS: ReadonlyArray<readonly [Direction, string]> = [
  ['down', 'Front'], ['left', 'Left'], ['right', 'Right'], ['up', 'Back'],
];

/** Arte individual do manifesto; Mixel original permanece como fallback se o atlas falhar. */
export function preloadNpcSprites(scene: Phaser.Scene): void {
  scene.load.spritesheet('npc-static-4dir', 'assets/npcs/npc-static-4dir-64.png',
    { frameWidth: 64, frameHeight: 64 });
  for (const [direction, source] of DIRECTIONS) {
    for (const [action, count] of [['idle', 9], ['walk', 4]] as const) {
      scene.load.spritesheet(`npc-${action}-${direction}`,
        `assets/npcs/MainC_${action === 'idle' ? 'Idle' : 'Walk'}_${source}.PNG`,
        { frameWidth: 32, frameHeight: 33, endFrame: count - 1 });
    }
  }
  scene.load.image('npc-shadow', 'assets/npcs/MainC_Shadow.png');
}

export function registerNpcAnimations(scene: Phaser.Scene): void {
  for (const [direction] of DIRECTIONS) {
    for (const [action, count] of [['idle', 9], ['walk', 4]] as const) {
      const key = `npc-${action}-${direction}`;
      if (!scene.anims.exists(key)) scene.anims.create({ key,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: count - 1 }),
        frameRate: action === 'idle' ? 5 : 7, repeat: -1 });
    }
  }
}

export interface NpcViewRecord {
  definition: Readonly<NpcDefinition>;
  brain: NpcBrain;
  view: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  facing: Direction;
  uniqueArt: boolean;
}

/** NPCs do manifesto com poses direcionais estáticas; interação e movimento preservados. */
export function createTestNpcViews(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Layer,
  isFree: (x: number, y: number) => boolean,
  say: (message: string) => void,
  definitions: readonly Readonly<NpcDefinition>[] = TEST_NPCS,
): NpcViewRecord[] {
  return definitions.flatMap((definition) => {
    if (!isFree(definition.x, definition.y)) return [];
    const brain = new NpcBrain(definition);
    const shadow = scene.add.image(0, -2, 'npc-shadow').setOrigin(0.5);
    const uniqueArt = scene.textures.exists('npc-static-4dir');
    if (uniqueArt) shadow.setScale(0.8);
    const sprite = scene.add.sprite(0, 0, uniqueArt ? 'npc-static-4dir' : 'npc-idle-down',
      uniqueArt ? npcFrame(definition.id, 'down') : 0).setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true });
    // Textura 64px em corpo visual de 25,6px, sem perder nitidez no zoom da câmera.
    if (uniqueArt) sprite.setScale(0.4);
    if (!uniqueArt) {
      sprite.setTint(ROLE_TINTS[definition.role]);
      sprite.anims.play('npc-idle-down');
    }
    const name = scene.add.text(0, -32, definition.name, {
      fontSize: '8px', color: '#fff0d0', backgroundColor: '#192318bb',
    }).setOrigin(0.5);
    const view = scene.add.container(definition.x, definition.y, [shadow, sprite, name])
      .setName(`NPC:${definition.id}`).setDepth(definition.y);
    sprite.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number,
      event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      const metBefore = Number.isFinite(brain.agent.memory.lastInteractionAt);
      brain.interact(scene.time.now);
      // Cada conversa avança uma fala do NPC (em ciclo); ver npcLine em npc.ts.
      say(`${definition.name}${metBefore ? ' (já conversou)' : ''}: “${brain.line}”`);
    });
    layer.add(view);
    return [{ definition: brain.definition, brain, view, sprite, facing: 'down' as Direction, uniqueArt }];
  });
}

export function updateTestNpcViews(
  records: NpcViewRecord[],
  now: number,
  deltaMs: number,
  isFree: (x: number, y: number) => boolean,
  random: () => number = Math.random,
  danger: (position: Point) => Point | null = () => null,
): void {
  for (const record of records) {
    const { brain, view, sprite } = record;
    const intent = brain.decide(now, random, danger(brain.position));
    const moved = intent.direction !== null
      && brain.move(intent.direction, 18 * Math.max(0, Math.min(deltaMs, 50)) / 1000, isFree);
    if (moved) record.facing = intent.direction!;
    const { x, y } = brain.position;
    if (moved) view.setPosition(x, y);
    view.setDepth(y);
    view.setData('moving', moved);
    view.setData('alert', intent.state === 'alert');
    if (record.uniqueArt) {
      sprite.setTint(intent.state === 'alert' ? 0xff8e74 : 0xffffff);
      sprite.setFrame(npcFrame(record.definition.id, record.facing));
    } else {
      sprite.setTint(intent.state === 'alert' ? 0xff8e74 : ROLE_TINTS[record.definition.role]);
      sprite.anims.play(`npc-${moved ? 'walk' : 'idle'}-${record.facing}`, true);
    }
  }
}
