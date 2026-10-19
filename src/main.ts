import Phaser from 'phaser';
import {
  AREA_SIZE, CHUNK_SIZE, TILE_SIZE, TILES_PER_SIDE, WORLD_SIZE,
  buildGroundChunk, buildForestTrees, canTraverseTiles, isSolidForestTile,
  isWalkableTile, walkableDestination, type GroundLayer,
} from './world/qingMaoGround';
import { shortestWorldWaypoints, type WorldPoint } from './world/cardinalNavigation';
import { FangYuan, registerWalkAnimations, WALK_SPEED } from './entities/FangYuan';
import { directionVector, shouldTurnForSegment, type CardinalDirection } from './entities/directions';
import { CharacterSheet } from './ui/characterSheet';
import { CharacterCultivation } from './entities/characterCultivation';
import { CombatEngine } from './combat/combatEngine';
import { TEST_ENEMY_OFFSETS } from './combat/combatConfig';
import type { ActionResult, CombatEvent, Direction } from './combat/types';
import { CombatHUD } from './ui/combatHUD';
import { setupDisplayMode } from './ui/displayMode';

const LAYERS: ReadonlyArray<{ layer: GroundLayer; atlas: string }> = [
  { layer: 'base', atlas: 'ground' },
  { layer: 'detail', atlas: 'ground-details' },
];

class QingMaoScene extends Phaser.Scene {
  private player!: FangYuan;
  private cultivation!: CharacterCultivation;
  private characterSheet?: CharacterSheet;
  private combat!: CombatEngine;
  private combatHUD?: CombatHUD;
  private enemyViews = new Map<string, Phaser.GameObjects.Container>();
  private projectileViews: Phaser.GameObjects.Graphics[] = [];
  private pendingRewards: CombatEvent[] = [];
  private nextRewardRetryAt = 0;
  private worldObjects!: Phaser.GameObjects.Layer;
  private waypoints: WorldPoint[] = [];
  private destination?: Phaser.GameObjects.Arc;
  private chunkGuide?: Phaser.GameObjects.Graphics;
  private readonly onResize = (size: Phaser.Structs.Size) => {
    this.cameras.main.setSize(size.width, size.height);
  };

  constructor() { super('QingMaoScene'); }

  preload(): void {
    this.load.spritesheet('ground', 'assets/qing-mao/ground.png', {
      frameWidth: TILE_SIZE, frameHeight: TILE_SIZE,
    });
    this.load.spritesheet('ground-details', 'assets/qing-mao/details.png', {
      frameWidth: TILE_SIZE, frameHeight: TILE_SIZE,
    });
    this.load.image('forest-trees', 'assets/qing-mao/trees.png');
    this.load.spritesheet('fang-yuan-walk', 'assets/characters/fang-yuan-walk-32.png', {
      frameWidth: TILE_SIZE, frameHeight: TILE_SIZE,
    });
  }

  create(): void {
    // VilaGuYue: Ground → Ground_Details → Elevation_Back → Structures_Back →
    // World_Objects_YSort (Trees, NPCs, Enemies, Props) → Structures_Front →
    // Foreground → Shadows → Effects → Collision. Só solo, árvores e colisão
    // têm conteúdo nesta camada; árvores e Fang Yuan dividem o Y-sort.
    this.createGround();
    this.worldObjects = this.add.layer().setName('World_Objects_YSort').setDepth(2);
    this.createTrees();

    this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    registerWalkAnimations(this);
    this.player = new FangYuan(this, 24.5 * TILE_SIZE, 24.5 * TILE_SIZE);
    this.worldObjects.add(this.player);
    this.cultivation = new CharacterCultivation();
    this.combat = new CombatEngine(undefined, this.player.x, this.player.y);
    this.characterSheet = new CharacterSheet(this.cultivation, this.combat, () => this.time.now);
    this.combatHUD = new CombatHUD(this.combat, action => this.onCombatAction(action));
    this.createEnemies();
    this.createCollision();
    this.cameras.main.setZoom(2).setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);

    this.chunkGuide = this.add.graphics().lineStyle(2, 0xf5d492, 0.75).setDepth(2000).setVisible(false);
    for (let row = 0; row < AREA_SIZE; row++) {
      for (let col = 0; col < AREA_SIZE; col++) {
        this.chunkGuide.strokeRect(col * CHUNK_SIZE * TILE_SIZE, row * CHUNK_SIZE * TILE_SIZE,
          CHUNK_SIZE * TILE_SIZE, CHUNK_SIZE * TILE_SIZE);
      }
    }
    this.input.keyboard?.on('keydown-C', () => this.chunkGuide?.setVisible(!this.chunkGuide.visible));

    // Um toque no chão define o destino. Um novo toque substitui o trajeto anterior.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const position = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.walkTo(position.x, position.y);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
      this.characterSheet?.destroy();
      this.characterSheet = undefined;
      this.combatHUD?.destroy();
      this.combatHUD = undefined;
    });
  }

  /** Marcadores geométricos de inimigos de teste: nenhum sprite de inimigo existe no pack. */
  private createEnemies(): void {
    TEST_ENEMY_OFFSETS.forEach(([dx, dy], index) => {
      const x = this.player.x + dx;
      const y = this.player.y + dy;
      if (!this.isFree(x, y)) return;
      const enemy = this.combat.addEnemy(`Criatura ${index + 1}`, x, y);
      const marker = this.add.circle(0, -13, 13, 0x9a433e).setStrokeStyle(2, 0xf4ce8d)
        .setInteractive({ useHandCursor: true });
      marker.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number,
        event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (this.combat.select(enemy.id)) this.combatHUD?.say(`Alvo selecionado: ${enemy.id}`);
      });
      const label = this.add.text(0, -39, 'INIMIGO · TESTE', {
        fontSize: '8px', color: '#fff0d0', backgroundColor: '#192318bb',
      }).setOrigin(0.5);
      const back = this.add.rectangle(0, -29, 28, 4, 0x291e1d);
      const hp = this.add.rectangle(-14, -29, 28, 4, 0xe7876e).setOrigin(0, 0.5).setName('hp');
      const view = this.add.container(x, y, [marker, label, back, hp]).setDepth(y);
      this.worldObjects.add(view);
      this.enemyViews.set(enemy.id, view);
    });
  }

  private isFree = (x: number, y: number): boolean => {
    return x >= 8 && y >= 10 && x < WORLD_SIZE - 8 && y < WORLD_SIZE - 2 &&
      [-7, 7].every(dx => [-7, 0].every(dy =>
        isWalkableTile(Math.floor((x + dx) / TILE_SIZE), Math.floor((y + dy) / TILE_SIZE))));
  };

  private onCombatAction(action: string): void {
    const now = this.time.now;
    if (action === 'auto') {
      this.combat.autoTarget = !this.combat.autoTarget;
      this.combatHUD?.say(`Alvo automático ${this.combat.autoTarget ? 'ligado' : 'desligado'}.`);
      return;
    }
    if (action === 'respawn') {
      if (this.combat.respawn(24.5 * TILE_SIZE, 24.5 * TILE_SIZE)) {
        this.waypoints = [];
        this.destination?.destroy(); this.destination = undefined;
        this.player.move(null);
        (this.player.body as Phaser.Physics.Arcade.Body).reset(this.combat.hero.x, this.combat.hero.y);
        this.player.setAlpha(1);
        this.combatHUD?.say('Retorno ao início. Penalidade de pedras ainda não definida.');
      }
      return;
    }
    const target = this.combat.target;
    const dx = target ? target.x - this.player.x : 0;
    const dy = target ? target.y - this.player.y : 0;
    const aiming: Direction = target && Math.abs(dx) + Math.abs(dy) > 1
      ? Math.abs(dx) >= Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up'
      : this.player.facingDirection;
    let result: ActionResult;
    if (action === 'basic') result = this.combat.basicAttack(now, this.isFree);
    else if (action === 'moonlight') result = this.combat.castMoonlight(now, aiming);
    else if (action === 'dash') {
      result = this.combat.dash(now,
        this.combatHUD?.direction ?? this.player.movingDirection ?? this.player.facingDirection, this.isFree);
      if (result.ok) {
        this.waypoints = [];
        this.destination?.destroy(); this.destination = undefined;
        this.player.move(null);
        (this.player.body as Phaser.Physics.Arcade.Body).reset(this.combat.hero.x, this.combat.hero.y);
      }
    } else return;
    if (!result.ok) this.combatHUD?.say(result.reason ?? 'Ação indisponível.');
    else {
      if (action === 'basic') this.combatHUD?.say('Ataque básico!');
      if (action === 'moonlight') this.combatHUD?.say('Corte lunar lançado!');
      if (action === 'dash') this.combatHUD?.say('Arrancada! Velocidade temporária aumentada.');
      // Recompensa/morte têm prioridade sobre a mensagem genérica da ação.
      this.handleCombatEvents(result.events);
    }
  }

  private handleCombatEvents(events: CombatEvent[]): void {
    for (const event of events) {
      if (event.type === 'reward') { this.pendingRewards.push(event); continue; }
      if (event.type === 'damage' && event.x !== undefined && event.y !== undefined) {
        const text = this.add.text(event.x, event.y - 36, `-${event.amount}`, {
          fontSize: '13px', color: '#fff1cb', stroke: '#3b1715', strokeThickness: 3,
        }).setDepth(1000);
        this.tweens.add({ targets: text, y: text.y - 25, alpha: 0, duration: 720,
          onComplete: () => text.destroy() });
      }
      if (event.type === 'resurrect') {
        this.combatHUD?.say('Cigarra da Primavera e Outono! 50% de vida restaurada.');
        this.cameras.main.flash(300, 194, 211, 134);
      }
      if (event.type === 'hero-death') {
        this.waypoints = []; this.destination?.destroy(); this.destination = undefined;
        this.player.move(null); this.player.setAlpha(0.5);
        this.combatHUD?.say('Derrotado. A penalidade por morte ainda não foi definida.');
      }
      if (event.type === 'dash' && event.x !== undefined && event.y !== undefined) {
        const trail = this.add.line(0, 0, event.x, event.y - 16, this.combat.hero.x,
          this.combat.hero.y - 16, 0xcde6b0, 0.8).setOrigin(0).setDepth(500);
        this.tweens.add({ targets: trail, alpha: 0, duration: 280, onComplete: () => trail.destroy() });
      }
      if (event.type === 'defeat' && event.targetId) {
        this.enemyViews.get(event.targetId)?.destroy();
        this.enemyViews.delete(event.targetId);
      }
    }
    if (this.pendingRewards.length && this.time.now >= this.nextRewardRetryAt) this.flushRewards();
  }

  private flushRewards(): void {
    while (this.pendingRewards.length) {
      const reward = this.pendingRewards[0];
      try {
        this.cultivation.receiveLoot(reward.stoneReward!, reward.materialId!, reward.materialQuantity!);
        this.pendingRewards.shift();
        this.combatHUD?.say(`+${reward.stoneReward} pedras espirituais · +${reward.materialQuantity} material de ruptura`);
        this.characterSheet?.update(this.player.facingDirection, this.player.movingDirection !== null);
      } catch {
        this.nextRewardRetryAt = this.time.now + 2000;
        this.combatHUD?.say('Não foi possível salvar o drop. Recompensa pendente; verifique o armazenamento.');
        break;
      }
    }
  }

  private createGround(): void {
    for (let chunkY = 0; chunkY < AREA_SIZE; chunkY++) {
      for (let chunkX = 0; chunkX < AREA_SIZE; chunkX++) {
        const data = buildGroundChunk(chunkX, chunkY);
        const offsetX = chunkX * CHUNK_SIZE * TILE_SIZE;
        const offsetY = chunkY * CHUNK_SIZE * TILE_SIZE;
        for (const [depth, { layer, atlas }] of LAYERS.entries()) {
          const map = this.make.tilemap({ data: data[layer], tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
          const tiles = map.addTilesetImage(atlas, atlas, TILE_SIZE, TILE_SIZE);
          if (!tiles) throw new Error(`Tileset não carregado: ${atlas}`);
          map.createLayer(0, tiles, offsetX, offsetY)
            ?.setName(layer === 'base' ? 'Ground' : 'Ground_Details').setDepth(depth);
        }
      }
    }
  }

  /** World_Objects_YSort/Trees: cada imagem reúne um mosaico de 3×4 tiles. */
  private createTrees(): void {
    const atlas = this.textures.get('forest-trees');
    for (let variant = 0; variant < 3; variant++) {
      if (!atlas.has(`large-${variant}`)) {
        atlas.add(`large-${variant}`, 0, variant * 3 * TILE_SIZE, 0, 3 * TILE_SIZE, 4 * TILE_SIZE);
      }
    }
    for (const tree of buildForestTrees()) {
      this.worldObjects.add(this.add.image(tree.x, tree.y, 'forest-trees', `large-${tree.variant}`)
        .setName('Trees').setOrigin(0, 0).setDepth(tree.y + 4 * TILE_SIZE));
    }
  }

  /** Collision: a navegação veda a mata inteira; o tilemap invisível é proteção física. */
  private createCollision(): void {
    const solid = Array.from({ length: TILES_PER_SIDE }, (_, y) =>
      Array.from({ length: TILES_PER_SIDE }, (_, x) => isSolidForestTile(x, y) ? 11 : -1));
    const map = this.make.tilemap({ data: solid, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tiles = map.addTilesetImage('ground', 'ground', TILE_SIZE, TILE_SIZE);
    if (!tiles) throw new Error('Tileset de colisão não carregado');
    const collision = map.createLayer(0, tiles);
    if (!collision) throw new Error('Camada de colisão não criada');
    collision.setName('Collision').setCollision(11).setVisible(false);
    this.physics.add.collider(this.player, collision);
  }

  private walkTo(x: number, y: number): void {
    if (!this.combat.hero.alive) return;
    const previousDirection = this.player.movingDirection;
    this.waypoints = [];
    this.destination?.destroy();
    this.destination = undefined;
    const goal = walkableDestination(x, y);
    const route = goal && shortestWorldWaypoints(
      { x: this.player.x, y: this.player.y }, goal, TILES_PER_SIDE, TILE_SIZE,
      isWalkableTile, canTraverseTiles, previousDirection ?? this.player.facingDirection,
      previousDirection !== null,
    );
    // Cancele imediatamente a velocidade anterior; o novo toque parte da posição real.
    this.player.move(null);
    if (!route) return;
    this.waypoints = route;
    const last = this.waypoints.at(-1);
    if (last) this.destination = this.add.circle(last.x, last.y, 5, 0xf4e3b6, 0.2)
      .setStrokeStyle(2, 0xf4e3b6).setDepth(5);
  }

  update(time: number, delta: number): void {
    this.combat.hero.x = this.player.x;
    this.combat.hero.y = this.player.y;
    this.handleCombatEvents(this.combat.tick(time, delta, this.isFree));
    for (const [id, view] of this.enemyViews) {
      const enemy = this.combat.enemies.get(id);
      if (!enemy?.alive) continue;
      view.setPosition(enemy.x, enemy.y).setDepth(enemy.y);
      const hp = view.getByName('hp') as Phaser.GameObjects.Rectangle;
      hp.width = 28 * enemy.health / enemy.maxHealth;
    }
    const shots = this.combat.activeProjectiles;
    while (this.projectileViews.length > shots.length) this.projectileViews.pop()?.destroy();
    while (this.projectileViews.length < shots.length) {
      const slash = this.add.graphics().setDepth(900);
      slash.fillStyle(0xcdefff, 0.95).lineStyle(1, 0x468bcc);
      slash.beginPath();
      slash.arc(0, 0, 12, -Math.PI / 2, Math.PI / 2);
      slash.arc(5, 0, 9, Math.PI / 2, -Math.PI / 2, true);
      slash.closePath(); slash.fillPath(); slash.strokePath();
      this.projectileViews.push(slash);
    }
    shots.forEach((shot, i) => this.projectileViews[i].setPosition(shot.x, shot.y)
      .setRotation(shot.direction === 'right' ? 0 : shot.direction === 'left' ? Math.PI
        : shot.direction === 'up' ? -Math.PI / 2 : Math.PI / 2));
    this.combatHUD?.update(time);
    this.characterSheet?.update(this.player.facingDirection, this.player.movingDirection !== null);
    if (!this.combat.hero.alive) { this.player.move(null); return; }
    const speed = WALK_SPEED * this.combat.speedMultiplier(time);
    const stick = this.combatHUD?.direction;
    if (stick) {
      if (this.waypoints.length) { this.waypoints = []; this.destination?.destroy(); this.destination = undefined; }
      const v = directionVector(stick);
      const travel = speed * Math.min(delta, 100) / 1000;
      let clear = true;
      for (let d = 4; d <= travel + 3; d += 4) {
        const sample = Math.min(d, travel);
        if (!this.isFree(this.player.x + v.x * sample, this.player.y + v.y * sample)) {
          clear = false; break;
        }
      }
      this.player.move(clear ? stick : null, true, speed);
      return;
    }
    const target = this.waypoints[0];
    if (!target) { this.player.move(null); return; }
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const step = speed * Math.min(delta, 50) / 1000 + 0.1;
    if (Math.abs(dx) <= step && Math.abs(dy) <= step) {
      // Snap de no máximo um frame: impede ultrapassar a curva ao mudar de eixo.
      (this.player.body as Phaser.Physics.Arcade.Body).reset(target.x, target.y);
      this.waypoints.shift();
      if (this.waypoints.length === 0) {
        this.player.move(null);
        this.destination?.destroy(); this.destination = undefined;
      }
      return;
    }
    const direction: CardinalDirection = Math.abs(dx) > 0.5
      ? dx > 0 ? 'right' : 'left'
      : dy > 0 ? 'down' : 'up';
    this.player.move(direction, shouldTurnForSegment(Math.abs(dx) + Math.abs(dy)), speed);
  }
}

setupDisplayMode();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#9ab037',
  pixelArt: true,
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  input: { activePointers: 2 },
  scale: { mode: Phaser.Scale.RESIZE },
  scene: [QingMaoScene],
});
