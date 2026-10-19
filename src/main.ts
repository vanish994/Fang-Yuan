import Phaser from 'phaser';
import { TILE_SIZE, WORLD_SIZE } from './world/qingMaoGround';
import { AREA_TILES, INITIAL_WORLD, OPPOSITE, RISK_LABELS, areaMobDefinitions, areaNpcDefinitions,
  type AreaId, type Side } from './world/initialWorld';
import { generateArea, type GeneratedArea } from './world/areaGenerator';
import { renderArea } from './world/areaRenderer';
import { shortestWorldWaypoints, type WorldPoint } from './world/cardinalNavigation';
import { FangYuan, registerWalkAnimations, WALK_SPEED } from './entities/FangYuan';
import { directionVector, shouldTurnForSegment, type CardinalDirection } from './entities/directions';
import { CharacterSheet } from './ui/characterSheet';
import { CharacterCultivation } from './entities/characterCultivation';
import { CombatEngine } from './combat/combatEngine';
import { TEST_ENEMY_OFFSETS } from './combat/combatConfig';
import type { ActionResult, CombatEvent, Direction } from './combat/types';
import { CombatHUD } from './ui/combatHUD';
import { MinimapView } from './ui/minimap';
import { setupDisplayMode } from './ui/displayMode';
import { createTestNpcViews, preloadNpcSprites, registerNpcAnimations,
  updateTestNpcViews, type NpcViewRecord } from './entities/npcView';
import type { MobDefinition } from './combat/mobCatalog';
import { bossFrame } from './combat/bossSprites';
import { mobFrame } from './combat/mobSprites';

class QingMaoScene extends Phaser.Scene {
  private player!: FangYuan;
  private cultivation!: CharacterCultivation;
  private characterSheet?: CharacterSheet;
  private combat!: CombatEngine;
  private combatHUD?: CombatHUD;
  private minimap?: MinimapView;
  private enemyViews = new Map<string, Phaser.GameObjects.Container>();
  private staticEnemyViews = new Map<string, { sprite: Phaser.GameObjects.Sprite; facing: Direction;
    x: number; y: number; frame: (id: string, direction: Direction) => number }>();
  private npcViews: NpcViewRecord[] = [];
  private projectileViews: Phaser.GameObjects.Graphics[] = [];
  private pendingRewards: CombatEvent[] = [];
  private nextRewardRetryAt = 0;
  private worldObjects!: Phaser.GameObjects.Layer;
  private currentArea!: GeneratedArea;
  private disposeArea?: () => void;
  private readonly defeatedInArea = new Set<string>();
  private nextAreaTransitionAt = 0;
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
    this.load.spritesheet('water', 'assets/qing-mao/WaterTileset.PNG', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('ruins', 'assets/qing-mao/Ruins.PNG', { frameWidth: 32, frameHeight: 32 });
    this.load.image('rocks', 'assets/qing-mao/Rocks%201.2.PNG');
    this.load.image('bushes', 'assets/qing-mao/Bushes%201.1.PNG');
    this.load.image('logs', 'assets/qing-mao/Tree%20Stumps%20and%20Logs%201.2.PNG');
    this.load.image('mushrooms', 'assets/qing-mao/Mushrooms.png');
    this.load.spritesheet('fang-yuan-walk', 'assets/characters/fang-yuan-walk-32.png', {
      frameWidth: TILE_SIZE, frameHeight: TILE_SIZE,
    });
    preloadNpcSprites(this);
    // Atlas: 15 mobs (12 em jogo + 3 artes reservadas) × 4 direções, quadros 32×32.
    this.load.spritesheet('mob-static-4dir', 'assets/mobs/mob-static-4dir-32.png', {
      frameWidth: 32, frameHeight: 32,
    });
    // Atlas fornecido: 4 bosses × (baixo, esquerda, cima, direita), quadro 48×48.
    this.load.spritesheet('boss-static-4dir', 'assets/bosses/boss-static-4dir-48.png', {
      frameWidth: 48, frameHeight: 48,
    });
  }

  create(): void {
    // Uma Area é carregada por vez; seus nove chunks compartilham dados e seed.
    this.worldObjects = this.add.layer().setName('ENTITIES_Y_SORT').setDepth(6);
    this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    registerWalkAnimations(this);
    registerNpcAnimations(this);
    this.player = new FangYuan(this, 24.5 * TILE_SIZE, 24.5 * TILE_SIZE);
    this.worldObjects.add(this.player);
    this.cultivation = new CharacterCultivation();
    this.cultivation.grantTestStonesOnce();
    this.combat = new CombatEngine(undefined, this.player.x, this.player.y);
    this.characterSheet = new CharacterSheet(this.cultivation, this.combat, () => this.time.now);
    this.combatHUD = new CombatHUD(this.combat, action => this.onCombatAction(action));
    this.minimap = new MinimapView(this.combatHUD.root);
    this.loadArea('vila_gu_yue', this.player.x, this.player.y);
    this.cameras.main.setZoom(2).setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);

    this.chunkGuide = this.add.graphics().lineStyle(2, 0xf5d492, 0.75).setDepth(2000).setVisible(false);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        this.chunkGuide.strokeRect(col * 16 * TILE_SIZE, row * 16 * TILE_SIZE,
          16 * TILE_SIZE, 16 * TILE_SIZE);
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
      this.npcViews = [];
      this.staticEnemyViews.clear();
      this.disposeArea?.();
      this.characterSheet?.destroy();
      this.characterSheet = undefined;
      this.minimap?.destroy();
      this.minimap = undefined;
      this.combatHUD?.destroy();
      this.combatHUD = undefined;
    });
  }

  /** Bosses e 12 mobs usam atlas direcionais; seis alvos de teste mantêm seus marcadores. */
  private createEnemies(): void {
    const spawn = (id: string, x: number, y: number, color: number, labelText: string,
      mob?: Readonly<MobDefinition>) => {
      if (!this.isFree(x, y)) return;
      const enemy = this.combat.addEnemy(id, x, y, mob?.health, mob);
      const boss = mob?.tier === 'boss';
      const hasArt = boss ? this.textures.exists('boss-static-4dir')
        : !!mob && this.textures.exists('mob-static-4dir');
      const frame = boss ? bossFrame : (instanceId: string, direction: Direction) =>
        mobFrame(mob?.spriteId ?? instanceId, direction);
      const graphic = hasArt
        ? this.add.sprite(0, 0, boss ? 'boss-static-4dir' : 'mob-static-4dir', frame(id, 'down'))
          .setOrigin(0.5, 1).setInteractive({ useHandCursor: true })
        : this.add.circle(0, -13, 13, color).setStrokeStyle(2, 0xf4ce8d)
          .setInteractive({ useHandCursor: true });
      graphic.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number,
        event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (this.combat.select(enemy.id)) this.combatHUD?.say(`Alvo selecionado: ${enemy.name ?? enemy.id}`);
      });
      // Identificação do boss abaixo da arte: acima ficaria sob Menu/tela cheia no celular.
      const label = this.add.text(0, boss ? 14 : -39, labelText, {
        fontSize: '8px', color: '#fff0d0', backgroundColor: '#192318bb',
      }).setOrigin(0.5);
      const barY = boss ? 28 : -29;
      const back = this.add.rectangle(0, barY, 28, 4, 0x291e1d);
      const hp = this.add.rectangle(-14, barY, 28, 4, 0xe7876e).setOrigin(0, 0.5).setName('hp');
      const view = this.add.container(x, y, [graphic, label, back, hp]).setDepth(y);
      this.worldObjects.add(view);
      this.enemyViews.set(enemy.id, view);
      if (hasArt) this.staticEnemyViews.set(enemy.id, { sprite: graphic as Phaser.GameObjects.Sprite,
        facing: 'down', x, y, frame });
    };
    if (this.currentArea.definition.id === 'floresta_exterior') {
      TEST_ENEMY_OFFSETS.forEach(([dx, dy], index) =>
        spawn(`Criatura ${index + 1}`, 24.5 * TILE_SIZE + dx, 24.5 * TILE_SIZE + dy,
          0x9a433e, 'INIMIGO · TESTE'));
    }
    for (const mob of areaMobDefinitions(this.currentArea.definition)) {
      if (this.defeatedInArea.has(`${this.currentArea.definition.id}:${mob.id}`)) continue;
      const color = mob.tier === 'boss' ? 0xb37e35
        : mob.tier === 3 ? 0x873367 : mob.tier === 2 ? 0x9a543e : 0x81634a;
      spawn(mob.id, mob.x, mob.y, color, `${mob.name} · TESTE`, mob);
    }
  }

  private isFree = (x: number, y: number): boolean => {
    return x >= 8 && y >= 10 && x < WORLD_SIZE - 8 && y < WORLD_SIZE - 2 &&
      [-7, 7].every(dx => [-7, 0].every(dy =>
        this.currentArea.isFreeTile(Math.floor((x + dx) / TILE_SIZE), Math.floor((y + dy) / TILE_SIZE))));
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
        if (this.currentArea.definition.id !== 'vila_gu_yue')
          this.loadArea('vila_gu_yue', 24.5 * TILE_SIZE, 24.5 * TILE_SIZE);
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
        this.defeatedInArea.add(`${this.currentArea.definition.id}:${event.targetId}`);
        this.enemyViews.get(event.targetId)?.destroy();
        this.enemyViews.delete(event.targetId);
        this.staticEnemyViews.delete(event.targetId);
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

  /** Troca a unidade de gameplay; não reinicia o cultivo nem o motor de Gu. */
  private loadArea(id: AreaId, x: number, y: number): void {
    this.waypoints = [];
    this.destination?.destroy(); this.destination = undefined;
    this.player.move(null);
    for (const view of this.enemyViews.values()) view.destroy();
    this.enemyViews.clear(); this.staticEnemyViews.clear();
    for (const npc of this.npcViews) npc.view.destroy();
    this.npcViews = [];
    this.projectileViews.forEach(view => view.destroy()); this.projectileViews = [];
    this.disposeArea?.();
    this.combat.clearAreaEnemies();
    this.currentArea = generateArea(INITIAL_WORLD[id]);
    this.minimap?.setArea(this.currentArea);
    this.minimap?.update(x, y);
    (this.player.body as Phaser.Physics.Arcade.Body).reset(x, y);
    this.combat.hero.x = x; this.combat.hero.y = y;
    this.disposeArea = renderArea(this, this.currentArea, this.worldObjects, this.player);
    this.createEnemies();
    this.npcViews = createTestNpcViews(this, this.worldObjects, this.isFree,
      message => this.combatHUD?.say(message), areaNpcDefinitions(this.currentArea.definition));
    this.combatHUD?.say(`Área: ${this.currentArea.definition.name} · risco ${RISK_LABELS[this.currentArea.definition.risk]}`);
  }

  /** Entrada bidirecional nos portões; nunca troca de área pela emenda de um chunk. */
  private checkAreaTransition(now: number): boolean {
    if (now < this.nextAreaTransitionAt || !this.combat.hero.alive) return false;
    const x = this.player.x / TILE_SIZE, y = this.player.y / TILE_SIZE;
    let side: Side | null = null;
    if (y >= 21 && y <= 27) {
      if (x >= AREA_TILES - 2 && this.currentArea.definition.exits.east) side = 'east';
      else if (x <= 2 && this.currentArea.definition.exits.west) side = 'west';
    }
    if (!side && x >= 21 && x <= 27) {
      if (y >= AREA_TILES - 2 && this.currentArea.definition.exits.south) side = 'south';
      else if (y <= 2 && this.currentArea.definition.exits.north) side = 'north';
    }
    if (!side) return false;
    const destination = this.currentArea.definition.exits[side];
    if (!destination || INITIAL_WORLD[destination].exits[OPPOSITE[side]] !== this.currentArea.definition.id)
      throw new Error(`Saída sem retorno: ${this.currentArea.definition.id} → ${destination}`);
    const nx = side === 'east' ? 2.5 : side === 'west' ? AREA_TILES - 2.5 : 24.5;
    const ny = side === 'south' ? 2.5 : side === 'north' ? AREA_TILES - 2.5 : 24.5;
    this.nextAreaTransitionAt = now + 850;
    this.loadArea(destination, nx * TILE_SIZE, ny * TILE_SIZE);
    return true;
  }

  private walkableDestination(x: number, y: number): WorldPoint | null {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE)
      return null;
    if (this.isFree(x, y)) return { x, y };
    let nearest: WorldPoint | null = null, best = Infinity;
    for (let row = 0; row < AREA_TILES; row++) for (let col = 0; col < AREA_TILES; col++) {
      const point = { x: (col + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
      if (!this.isFree(point.x, point.y)) continue;
      const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (distance < best) { nearest = point; best = distance; }
    }
    return nearest;
  }

  private walkTo(x: number, y: number): void {
    if (!this.combat.hero.alive) return;
    const previousDirection = this.player.movingDirection;
    this.waypoints = [];
    this.destination?.destroy();
    this.destination = undefined;
    const goal = this.walkableDestination(x, y);
    const route = goal && shortestWorldWaypoints(
      { x: this.player.x, y: this.player.y }, goal, AREA_TILES, TILE_SIZE,
      (tx, ty) => this.currentArea.isFreeTile(tx, ty),
      (tx, ty, nx, ny) => Math.abs(tx - nx) + Math.abs(ty - ny) === 1
        && this.currentArea.isFreeTile(tx, ty) && this.currentArea.isFreeTile(nx, ny),
      previousDirection ?? this.player.facingDirection,
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
    if (this.checkAreaTransition(time)) return;
    this.minimap?.update(this.player.x, this.player.y);
    this.combat.hero.x = this.player.x;
    this.combat.hero.y = this.player.y;
    updateTestNpcViews(this.npcViews, time, delta, this.isFree, Math.random, position => {
      const nearby = [...this.combat.enemies.values()].filter(enemy => enemy.alive
        && enemy.id.startsWith('mob-') && Math.hypot(enemy.x - position.x, enemy.y - position.y) < 85)
        .sort((a, b) => Math.hypot(a.x - position.x, a.y - position.y)
          - Math.hypot(b.x - position.x, b.y - position.y))[0];
      return nearby ? { x: nearby.x, y: nearby.y } : null;
    });
    this.handleCombatEvents(this.combat.tick(time, delta, this.isFree));
    for (const [id, view] of this.enemyViews) {
      const enemy = this.combat.enemies.get(id);
      if (!enemy?.alive) continue;
      view.setPosition(enemy.x, enemy.y).setDepth(enemy.y);
      const art = this.staticEnemyViews.get(id);
      if (art) {
        const dx = enemy.x - art.x, dy = enemy.y - art.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.1) {
          art.facing = Math.abs(dx) >= Math.abs(dy)
            ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
          art.sprite.setFrame(art.frame(id, art.facing));
        }
        art.x = enemy.x; art.y = enemy.y;
      }
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
