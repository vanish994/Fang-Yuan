import Phaser from 'phaser';
import { TILE_SIZE, WORLD_SIZE } from './world/qingMaoGround';
import { AREA_TILES, INITIAL_WORLD, OPPOSITE, RISK_LABELS, areaMobDefinitions, areaNpcDefinitions,
  type AreaId, type Side } from './world/initialWorld';
import { generateArea, type GeneratedArea } from './world/areaGenerator';
import { renderArea } from './world/areaRenderer';
import { shortestWorldWaypoints, type WorldPoint } from './world/cardinalNavigation';
import { FangYuan, registerWalkAnimations, WALK_SPEED } from './entities/FangYuan';
import { shouldTurnForSegment, type CardinalDirection } from './entities/directions';
import { CharacterSheet } from './ui/characterSheet';
import { CharacterCultivation } from './entities/characterCultivation';
import { CombatEngine } from './combat/combatEngine';
import { GuStateStore } from './combat/guState';
import { GU_CATALOG } from './combat/guCatalog';
import { canStandAt, canWalkSegment, releaseWallSnag } from './world/footprint';
import type { ActionResult, CombatEvent, Direction, GuId } from './combat/types';
import { wildGuShortLabel } from './combat/wildGu';
import { RewardQueue, type RewardMessage } from './combat/rewardFlow';
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
    x: number; y: number; boss: boolean; frame: (id: string, direction: Direction) => number }>();
  private npcViews: NpcViewRecord[] = [];
  private projectileViews: Phaser.GameObjects.Graphics[] = [];
  private enemyProjectileViews: Phaser.GameObjects.Graphics[] = [];
  /** Fila de recompensas: entrega Gu/pedras/material com retry e degradação. */
  private readonly rewards = new RewardQueue();
  private worldObjects!: Phaser.GameObjects.Layer;
  private currentArea!: GeneratedArea;
  private disposeArea?: () => void;
  private readonly defeatedInArea = new Set<string>();
  /** Gu sorteado por criatura na sessão; `null` = nasceu sem Gu. */
  private readonly wildGuBySpawn = new Map<string, GuId | null>();
  private nextAreaTransitionAt = 0;
  private waypoints: WorldPoint[] = [];
  private navigationPrevious?: WorldPoint;
  private blockedTravelMs = 0;
  private retriedTravel = false;
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
    // Quadros 2× a resolução lógica: 64px na textura, 32px no mapa.
    this.load.spritesheet('fang-yuan-walk', 'assets/characters/fang-yuan-walk-64.png', {
      frameWidth: 64, frameHeight: 64,
    });
    preloadNpcSprites(this);
    // Atlas: 15 mobs × 4 direções; todos os 15 têm spawn definido no mundo.
    this.load.spritesheet('mob-static-4dir', 'assets/mobs/mob-static-4dir-64.png', {
      frameWidth: 64, frameHeight: 64,
    });
    // Bosses usam 96px por quadro, mas continuam ~43px no mundo.
    this.load.spritesheet('boss-static-4dir', 'assets/bosses/boss-static-4dir-96.png', {
      frameWidth: 96, frameHeight: 96,
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
    // RNG explícito: o mundo pode ser reproduzido em testes/depuração.
    this.combat = new CombatEngine(undefined, this.player.x, this.player.y, undefined,
      new GuStateStore(), Math.random);
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
      this.rewards.clear();
      this.minimap?.destroy();
      this.minimap = undefined;
      this.combatHUD?.destroy();
      this.combatHUD = undefined;
      this.combat.destroy(); // cancela a assinatura do cultivo
    });
  }

  /** Apenas encontros definidos no mundo: nenhum alvo de teste em forma de círculo. */
  private createEnemies(): void {
    const spawn = (mob: Readonly<MobDefinition>) => {
      if (!this.isFree(mob.x, mob.y)) return;
      // O Gu da criatura é sorteado no nascimento e guardado na sessão: sair e
      // voltar da área não re-sorteia o Gu de um inimigo que continua vivo.
      const key = `${this.currentArea.definition.id}:${mob.id}`;
      const forcedWildGu = this.wildGuBySpawn.has(key) ? this.wildGuBySpawn.get(key) : undefined;
      // O sorteio usa o RNG do motor; `forcedWildGu` só repete o resultado já
      // registrado para esta criatura nesta sessão.
      const enemy = this.combat.addEnemy(mob.id, mob.x, mob.y, mob.health, mob, { forcedWildGu });
      if (!this.wildGuBySpawn.has(key)) this.wildGuBySpawn.set(key, enemy.wildGu ?? null);
      const boss = mob.tier === 'boss';
      const atlas = boss ? 'boss-static-4dir' : 'mob-static-4dir';
      const frame = boss ? bossFrame : (instanceId: string, direction: Direction) =>
        mobFrame(mob.spriteId ?? instanceId, direction);
      const graphic = this.add.sprite(0, 0, atlas, frame(mob.id, 'down'))
        .setOrigin(0.5, 1).setScale(boss ? 0.45 : 0.425)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(0, boss ? -47 : -32, mob.name, {
        fontSize: '8px', color: '#fff0d0', backgroundColor: '#192318bb',
      }).setOrigin(0.5).setVisible(boss);
      // Gu selvagem é raro: o jogador vê a criatura portadora desde o nascimento.
      const wild = enemy.wildGu ? GU_CATALOG[enemy.wildGu] : null;
      const wildLabel = this.add.text(0, boss ? -58 : -44,
        wild ? `◆ ${wildGuShortLabel(wild)}` : '', {
        fontSize: '7px', color: '#ffe6a8', backgroundColor: '#3a2c0fcc',
        stroke: '#1a1206', strokeThickness: 2,
      }).setOrigin(0.5).setVisible(wild !== null);
      graphic.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number,
        event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (this.combat.select(enemy.id)) this.combatHUD?.say(`Alvo selecionado: ${enemy.name ?? enemy.id}`);
      });
      const barY = boss ? 10 : 6;
      const back = this.add.rectangle(0, barY, 28, 4, 0x291e1d).setVisible(false);
      const hp = this.add.rectangle(-14, barY, 28, 4, 0xe7876e)
        .setOrigin(0, 0.5).setName('hp').setVisible(false);
      const view = this.add.container(mob.x, mob.y, [graphic, label, wildLabel, back, hp])
        .setDepth(mob.y);
      this.worldObjects.add(view);
      this.enemyViews.set(enemy.id, view);
      this.staticEnemyViews.set(enemy.id, { sprite: graphic, facing: 'down',
        x: mob.x, y: mob.y, boss, frame });
    };
    for (const mob of areaMobDefinitions(this.currentArea.definition)) {
      if (!this.defeatedInArea.has(`${this.currentArea.definition.id}:${mob.id}`)) spawn(mob);
    }
  }

  private isFree = (x: number, y: number): boolean =>
    canStandAt(x, y, TILE_SIZE, (column, row) => this.currentArea.isFreeTile(column, row));

  private onCombatAction(action: string): void {
    const now = this.time.now;
    // Ações DOM podem chegar entre dois updates enquanto o corpo Arcade se desloca.
    this.combat.hero.x = this.player.x; this.combat.hero.y = this.player.y;
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
      : this.combatHUD?.direction ?? this.player.facingDirection;
    const movementDirection = this.combatHUD?.direction ?? this.player.movingDirection ?? this.player.facingDirection;
    let result: ActionResult;
    let message = '';
    if (action === 'basic') {
      result = this.combat.basicAttack(now, this.isFree);
      message = 'Ataque básico!';
    } else if (action === 'moonlight') {
      result = this.combat.castMoonlight(now, aiming);
      message = 'Corte lunar lançado!';
    } else if (action === 'dash') {
      result = this.combat.dash(now, movementDirection, this.isFree);
      message = 'Arrancada! Velocidade temporária aumentada.';
    } else if (action === 'attack' || action === 'movement' || action === 'support') {
      const slot = action === 'attack' ? 'attack' : action === 'movement' ? 'movement' : 'support';
      const equipped = this.combat.equipment[slot];
      if (!equipped) {
        this.combatHUD?.say(`Nenhum Gu de ${slot === 'support' ? 'apoio' : slot === 'attack' ? 'ataque' : 'movimento'} equipado.`);
        return;
      }
      const direction = slot === 'movement' ? movementDirection : aiming;
      result = this.combat.activate(equipped, now, direction, this.isFree);
      message = this.activationMessage(equipped);
      if (result.ok && slot === 'movement') this.settleAfterDash();
    } else if (action.startsWith('item:')) {
      result = this.combat.useItem(action.slice(5) as GuId, now);
      message = result.ok ? 'Clarão ofuscante!' : '';
    } else return;
    if (result.ok && (action === 'dash' || action === 'movement')) this.settleAfterDash();
    if (!result.ok) this.combatHUD?.say(result.reason ?? 'Ação indisponível.');
    else {
      if (message) this.combatHUD?.say(message);
      // Recompensa/morte têm prioridade sobre a mensagem genérica da ação.
      this.handleCombatEvents(result.events);
    }
  }

  private activationMessage(id: GuId): string {
    const active = GU_CATALOG[id].active;
    if (active?.kind === 'dash') return 'Arrancada! Velocidade temporária aumentada.';
    if (active?.kind === 'heal') return 'Água purificadora restaura a vida.';
    if (active?.kind === 'buff') return 'Efeito temporário ativado.';
    if (active?.kind === 'empower') return 'Próxima ativação amplificada.';
    return `${GU_CATALOG[id].label} ativado.`;
  }

  private settleAfterDash(): void {
    this.waypoints = [];
    this.destination?.destroy(); this.destination = undefined;
    this.player.move(null);
    (this.player.body as Phaser.Physics.Arcade.Body).reset(this.combat.hero.x, this.combat.hero.y);
  }

  private handleCombatEvents(events: CombatEvent[]): void {
    for (const event of events) {
      if (event.type === 'reward') { this.rewards.enqueue(event); continue; }
      if (event.type === 'damage' && event.x !== undefined && event.y !== undefined) {
        const text = this.add.text(event.x, event.y - 36, `-${event.amount}`, {
          fontSize: '13px', color: '#fff1cb', stroke: '#3b1715', strokeThickness: 3,
        }).setDepth(1000);
        this.tweens.add({ targets: text, y: text.y - 25, alpha: 0, duration: 720,
          onComplete: () => text.destroy() });
      }
      if (event.type === 'heal' && event.x !== undefined && event.y !== undefined) {
        const text = this.add.text(event.x, event.y - 40, `+${event.amount}`, {
          fontSize: '13px', color: '#bce8c2', stroke: '#17301c', strokeThickness: 3,
        }).setDepth(1000);
        this.tweens.add({ targets: text, y: text.y - 25, alpha: 0, duration: 720,
          onComplete: () => text.destroy() });
        if (event.targetId && event.targetId !== 'hero') {
          const healed = this.combat.enemies.get(event.targetId)?.name ?? 'Criatura';
          this.combatHUD?.say(`${healed} recuperou ${event.amount} de vida com o Gu!`);
        }
      }
      if (event.type === 'enemy-ability' && event.guId && event.x !== undefined && event.y !== undefined) {
        const gu = GU_CATALOG[event.guId];
        const actor = this.combat.enemies.get(event.targetId ?? '')?.name ?? 'Criatura';
        this.combatHUD?.say(`${actor} usou ${gu.label}!`);
        const ring = this.add.graphics({ x: event.x, y: event.y - 12 }).setDepth(1000);
        const color = Number.parseInt(gu.visual.color.replace('#', ''), 16);
        ring.lineStyle(1.5, color, 0.95).strokeCircle(0, 0, 8);
        this.tweens.add({ targets: ring, alpha: 0, scale: 2.2, duration: 420,
          onComplete: () => ring.destroy() });
        const text = this.add.text(event.x, event.y - 46, wildGuShortLabel(gu), {
          fontSize: '10px', color: gu.visual.color, stroke: '#120d06', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(1001);
        this.tweens.add({ targets: text, y: text.y - 22, alpha: 0, duration: 900,
          onComplete: () => text.destroy() });
      }
      if (event.type === 'barrier') {
        this.combatHUD?.say(`Barreira absorveu ${event.amount} de dano.`);
      }
      if (event.type === 'blind') this.cameras.main.flash(140, 255, 252, 224);
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
    if (this.rewards.size > 0 && this.time.now >= this.rewards.nextRetryAt) this.flushRewards();
  }

  private flushRewards(): void {
    const messages = this.rewards.drain(this.combat, this.cultivation, this.time.now);
    for (const message of messages) this.announceReward(message);
    if (messages.some(message => message.kind === 'loot')) {
      this.characterSheet?.update(this.player.facingDirection, this.player.movingDirection !== null);
    }
  }

  private announceReward(message: RewardMessage): void {
    // Tentativas intermediárias de retry ficam em silêncio para não inundar o HUD.
    if (message.kind === 'retry' && !message.notify) return;
    this.combatHUD?.say(message.text);
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
    this.enemyProjectileViews.forEach(view => view.destroy()); this.enemyProjectileViews = [];
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

  private walkTo(x: number, y: number, recovering = false): void {
    if (!this.combat.hero.alive) return;
    const previousDirection = this.player.movingDirection;
    this.waypoints = [];
    this.navigationPrevious = undefined;
    this.blockedTravelMs = 0;
    if (!recovering) this.retriedTravel = false;
    this.destination?.destroy();
    this.destination = undefined;
    const goal = this.walkableDestination(x, y);
    const tileFree = (tx: number, ty: number) => this.currentArea.isFreeTile(tx, ty);
    const centerFree = (tx: number, ty: number) => tileFree(tx, ty)
      && canStandAt((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE, TILE_SIZE, tileFree);
    const route = goal && shortestWorldWaypoints(
      { x: this.player.x, y: this.player.y }, goal, AREA_TILES, TILE_SIZE,
      centerFree,
      (tx, ty, nx, ny) => Math.abs(tx - nx) + Math.abs(ty - ny) === 1
        && centerFree(tx, ty) && centerFree(nx, ny),
      previousDirection ?? this.player.facingDirection,
      previousDirection !== null,
      (from, to) => canWalkSegment(from, to, TILE_SIZE, tileFree),
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
      if (view.x !== enemy.x || view.y !== enemy.y)
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
      const selected = this.combat.target?.id === id;
      const [ , label, back, hp] = view.list as [Phaser.GameObjects.Sprite,
        Phaser.GameObjects.Text, Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle];
      const showLabel = selected || art?.boss === true;
      const showHealth = selected || enemy.health < enemy.maxHealth;
      if (label.visible !== showLabel) label.setVisible(showLabel);
      if (back.visible !== showHealth) back.setVisible(showHealth);
      if (hp.visible !== showHealth) hp.setVisible(showHealth);
      const width = 28 * enemy.health / enemy.maxHealth;
      if (hp.width !== width) hp.width = width;
    }
    const shots = this.combat.activeProjectiles;
    while (this.projectileViews.length > shots.length) this.projectileViews.pop()?.destroy();
    while (this.projectileViews.length < shots.length) {
      const shot = shots[this.projectileViews.length];
      const color = Number.parseInt(GU_CATALOG[shot.guId].visual.color.replace('#', ''), 16);
      const slash = this.add.graphics().setDepth(900);
      slash.fillStyle(color, 0.95).lineStyle(1, 0x2c2b3a);
      slash.beginPath();
      slash.arc(0, 0, shot.width / 2, -Math.PI / 2, Math.PI / 2);
      slash.arc(5, 0, Math.max(5, shot.width / 2 - 4), Math.PI / 2, -Math.PI / 2, true);
      slash.closePath(); slash.fillPath(); slash.strokePath();
      this.projectileViews.push(slash);
    }
    shots.forEach((shot, i) => this.projectileViews[i].setPosition(shot.x, shot.y)
      .setRotation(shot.direction === 'right' ? 0 : shot.direction === 'left' ? Math.PI
        : shot.direction === 'up' ? -Math.PI / 2 : Math.PI / 2));
    // Projéteis de Gu selvagem: orbes coloridos, visualmente distintos das lâminas do jogador.
    const enemyShots = this.combat.activeEnemyProjectiles;
    while (this.enemyProjectileViews.length > enemyShots.length) {
      this.enemyProjectileViews.pop()?.destroy();
    }
    while (this.enemyProjectileViews.length < enemyShots.length) {
      const orb = this.add.graphics().setDepth(901);
      this.enemyProjectileViews.push(orb);
    }
    enemyShots.forEach((shot, i) => {
      const color = Number.parseInt(GU_CATALOG[shot.guId].visual.color.replace('#', ''), 16);
      const orb = this.enemyProjectileViews[i];
      orb.clear().setPosition(shot.x, shot.y);
      orb.fillStyle(0x120d06, 0.85).fillCircle(0, 0, 7);
      orb.fillStyle(color, 0.95).fillCircle(0, 0, 4.5);
      orb.lineStyle(1, 0xffe6a8, 0.9).strokeCircle(0, 0, 6.5);
    });
    this.combatHUD?.update(time);
    this.characterSheet?.update(this.player.facingDirection, this.player.movingDirection !== null);
    if (!this.combat.hero.alive) { this.player.move(null); return; }
    const speed = WALK_SPEED * this.combat.speedMultiplier(time);
    const stick = this.combatHUD?.direction;
    if (stick) {
      if (this.waypoints.length) { this.waypoints = []; this.destination?.destroy(); this.destination = undefined; }
      this.navigationPrevious = undefined;
      this.blockedTravelMs = 0;
      // O joystick não deve vetar a movimentação por outro teste de colisão.
      // Se o Arcade deixou menos de 2px do corpo sobre a lateral da parede,
      // solte-o para fora antes do próximo passo paralelo (sem atravessar tiles).
      const foot = releaseWallSnag(this.player.x, this.player.y, stick, TILE_SIZE,
        (tx, ty) => this.currentArea.isFreeTile(tx, ty));
      if (foot.x !== this.player.x || foot.y !== this.player.y)
        (this.player.body as Phaser.Physics.Arcade.Body).reset(foot.x, foot.y);
      this.player.move(stick, true, speed);
      return;
    }
    const target = this.waypoints[0];
    if (!target) { this.navigationPrevious = undefined; this.player.move(null); return; }
    if (this.navigationPrevious && this.player.movingDirection
      && Math.hypot(this.player.x - this.navigationPrevious.x,
        this.player.y - this.navigationPrevious.y) < 0.35
      && Math.hypot(target.x - this.player.x, target.y - this.player.y) > 5) {
      this.blockedTravelMs += Math.min(delta, 50);
      if (this.blockedTravelMs > 350) {
        if (!this.retriedTravel) {
          this.retriedTravel = true;
          const goal = this.waypoints.at(-1)!;
          this.walkTo(goal.x, goal.y, true);
          return;
        }
        this.waypoints = [];
        this.destination?.destroy(); this.destination = undefined;
        this.player.move(null);
        this.combatHUD?.say('Caminho bloqueado. Toque em outro ponto.');
        return;
      }
    } else this.blockedTravelMs = 0;
    this.navigationPrevious = { x: this.player.x, y: this.player.y };
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
