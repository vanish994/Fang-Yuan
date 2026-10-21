import type { CombatEngine } from '../combat/combatEngine';
import { GU_CATALOG } from '../combat/guCatalog';
import type { Direction, GuId } from '../combat/types';
import { cardinalFromTouch } from './cardinalStick';

const formatTime = (ms: number) => ms ? `${(ms / 1000).toFixed(1)}s` : 'pronto';

/**
 * Rótulo compacto dos botões do HUD. É um conjunto próprio (mais curto que o
 * `short` do catálogo, usado no mundo): o botão tem 72 px e mostra
 * `rótulo ·custo`. O catálogo continua sendo a fonte dos nomes completos.
 */
const SHORT_NAMES: Readonly<Record<GuId, string>> = {
  moonlight: 'Lua', 'bone-spear': 'Osso', 'star-arrow': 'Flecha', 'star-dart': 'Dardos',
  'ghost-fire': 'Fogo', 'exploding-egg': 'Ovo',
  'stone-skin': 'Pedra', 'bronze-skin': 'Bronze', 'iron-skin': 'Ferro', 'rock-skin': 'Rocha',
  'jade-skin': 'Jade', 'beast-skin': 'Besta',
  'liquor-worm': 'Licor', 'little-light': 'Luz', 'amplify-effect': 'Ampliar',
  'cleansing-water': 'Água', 'flash-blink': 'Clarão', 'all-out-effort': 'Esforço',
  whirlwind: 'Redemoinho', 'clear-wind-wheel': 'Roda', 'dragonpill-cricket': 'Salto',
  'bear-strength': 'Urso', 'white-boar': 'Javali B', 'black-boar': 'Javali N',
  moonglow: 'Brilho', 'white-jade': 'Jade B',
};

/**
 * Interface DOM de toque. Os botões são genéricos: leem o Gu equipado no motor,
 * então trocar o Gu no inventário muda a habilidade sem criar uma segunda
 * fonte de verdade.
 */
export class CombatHUD {
  readonly root: HTMLElement;
  private readonly health: HTMLProgressElement;
  private readonly essence: HTMLProgressElement;
  private readonly healthValue: HTMLOutputElement;
  private readonly essenceValue: HTMLOutputElement;
  private readonly target: HTMLElement;
  private readonly feedback: HTMLElement;
  private readonly actions = new Map<string, HTMLButtonElement>();
  private readonly icons = new Map<string, HTMLElement>();
  private readonly auto: HTMLButtonElement;
  private readonly respawn: HTMLButtonElement;
  private readonly joystick: HTMLElement;
  direction: Direction | null = null;
  private steeringPointer: number | null = null;
  private feedbackUntil = 0;
  private lastPaintAt = -Infinity;

  constructor(private readonly engine: CombatEngine, onAction: (action: string) => void) {
    const root = document.createElement('div');
    root.className = 'combat-hud';
    root.innerHTML = `<section class="combat-top" aria-label="Vida e essência primordial">
      <div class="combat-bars">
        <label><span>Vida</span><progress id="combat-health" max="100" value="100"></progress>
          <output id="combat-health-value" for="combat-health">100/100</output></label>
        <label><span>Essência primordial</span><progress id="combat-essence" max="100" value="100"></progress>
          <output id="combat-essence-value" for="combat-essence">100/100</output></label>
      </div>
      <div class="combat-target"><strong id="combat-target-name" hidden></strong>
        <button type="button" data-action="auto" aria-pressed="false">Auto: não</button></div>
    </section>
    <div class="combat-feedback" role="status" aria-live="polite"></div>
    <div class="combat-joystick" aria-label="Direcional de movimento" role="group"><span class="joystick-knob">✥</span></div>
    <div class="combat-actions" aria-label="Ações de combate">
      <button type="button" data-action="basic">⚔ <small>Básico</small></button>
      <button type="button" data-action="attack" aria-label="Ativar Gu de ataque"><span class="gu-icon" data-gu="moonlight" aria-hidden="true"></span><small>Lua</small></button>
      <button type="button" data-action="movement" aria-label="Ativar Gu de movimento"><span class="gu-icon" data-gu="whirlwind" aria-hidden="true"></span><small>Dash</small></button>
      <button type="button" data-action="support" aria-label="Ativar Gu de apoio" hidden><span class="gu-icon" aria-hidden="true"></span><small>Apoio</small></button>
      <button type="button" data-action="item:flash-blink" aria-label="Usar Flash Blink Gu" hidden><span class="gu-icon" aria-hidden="true"></span><small>Clarão</small></button>
    </div>
    <button type="button" class="combat-respawn" data-action="respawn" hidden>Retornar ao início</button>
    <div class="combat-cicada" aria-label="Recarga da Cigarra"></div>`;
    document.body.append(root);
    this.root = root;
    this.health = root.querySelector('#combat-health')!;
    this.essence = root.querySelector('#combat-essence')!;
    this.healthValue = root.querySelector('#combat-health-value')!;
    this.essenceValue = root.querySelector('#combat-essence-value')!;
    this.target = root.querySelector('#combat-target-name')!;
    this.feedback = root.querySelector('.combat-feedback')!;
    this.auto = root.querySelector('[data-action="auto"]')!;
    this.respawn = root.querySelector('[data-action="respawn"]')!;
    this.joystick = root.querySelector('.combat-joystick')!;
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-action]')) {
      const action = button.dataset.action!;
      if (action !== 'auto' && action !== 'respawn') this.actions.set(action, button);
      const icon = button.querySelector<HTMLElement>('.gu-icon');
      if (icon) this.icons.set(action, icon);
      // Clique sintético costuma ser suprimido pelo navegador no segundo dedo.
      // pointerdown funciona mesmo segurando o direcional; click fica para teclado.
      button.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        onAction(action);
      });
      button.addEventListener('click', event => {
        if (event.detail === 0) onAction(action);
      });
    }
    // Analógico cardinal, separado do toque no mapa. Pointer capture mantém o dedo no controle.
    const steer = (event: PointerEvent) => {
      const rect = this.joystick.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      this.direction = cardinalFromTouch(dx, dy);
      this.joystick.dataset.direction = this.direction ?? '';
    };
    this.joystick.addEventListener('pointerdown', event => {
      if (this.steeringPointer !== null) return;
      this.steeringPointer = event.pointerId;
      this.joystick.setPointerCapture(event.pointerId);
      steer(event); event.preventDefault();
    });
    this.joystick.addEventListener('pointermove', event => {
      if (this.joystick.hasPointerCapture(event.pointerId)) steer(event);
    });
    const release = (event: PointerEvent) => {
      if (event.pointerId !== this.steeringPointer) return;
      this.steeringPointer = null;
      this.direction = null; this.joystick.dataset.direction = '';
    };
    this.joystick.addEventListener('pointerup', release);
    this.joystick.addEventListener('pointercancel', release);
    this.joystick.addEventListener('lostpointercapture', release);
  }

  say(message: string): void {
    this.feedback.textContent = message;
    this.feedbackUntil = performance.now() + 3500;
  }

  /**
   * Marca no botão Básico que o golpe está repetindo sozinho (`data-auto`).
   * É só indicação visual: quem decide bater continua sendo a cena + o motor.
   */
  setAutoBasic(armed: boolean): void {
    const basic = this.actions.get('basic');
    if (!basic || basic.hasAttribute('data-auto') === armed) return;
    basic.toggleAttribute('data-auto', armed);
    basic.title = armed ? 'Ataque básico automático ligado: ande ou troque de alvo para parar.' : '';
  }

  private paintIcon(icon: HTMLElement | undefined, id: GuId | null): void {
    if (!icon) return;
    if (!id) {
      icon.removeAttribute('data-gu'); icon.removeAttribute('data-glyph');
      icon.removeAttribute('data-sprite');
      icon.style.backgroundColor = '';
      icon.textContent = '';
      return;
    }
    const gu = GU_CATALOG[id];
    icon.setAttribute('data-gu', id);
    if (gu.visual.sprite) {
      icon.setAttribute('data-glyph', gu.visual.glyph);
      icon.setAttribute('data-sprite', '');
      icon.textContent = '';
      icon.style.backgroundColor = '';
    } else {
      icon.setAttribute('data-glyph', gu.visual.glyph);
      icon.removeAttribute('data-sprite');
      icon.style.backgroundColor = gu.visual.color;
      icon.textContent = gu.visual.glyph;
    }
  }

  private paintAbility(action: 'attack' | 'movement' | 'support', now: number, id: GuId | null): void {
    const button = this.actions.get(action)!;
    const icon = this.icons.get(action);
    this.paintIcon(icon, id);
    if (!id) { button.hidden = true; return; }
    const gu = GU_CATALOG[id];
    const active = gu.active;
    button.hidden = !active;
    if (!active) return;
    const cooldown = this.engine.cooldownRemaining(id, now);
    const cost = gu.usage.essenceCost;
    const short = SHORT_NAMES[id];
    button.title = `${gu.label} · ${gu.usage.essenceCost} essência · ${(gu.usage.cooldownMs / 1000).toFixed(1)}s`;
    button.querySelector('small')!.textContent = cooldown ? formatTime(cooldown) : `${short} ·${cost}`;
    button.setAttribute('aria-label', `${cooldown ? 'Em recarga: ' : 'Ativar '}${gu.label}`);
    button.disabled = !this.engine.hero.alive || cooldown > 0 || this.engine.essence < cost
      || this.engine.cultivationRank < gu.usage.requiresRank;
  }

  update(now: number): void {
    if (this.feedback.textContent && performance.now() > this.feedbackUntil)
      this.feedback.textContent = '';
    // Números e textos DOM não precisam ser reescritos a 60 FPS; movimento e combate continuam livres.
    if (now - this.lastPaintAt < 100 && now >= this.lastPaintAt) return;
    this.lastPaintAt = now;
    const { engine } = this;
    this.health.max = engine.hero.maxHealth;
    this.health.value = engine.hero.health;
    this.essence.max = engine.cultivationMaxEssence;
    this.essence.value = engine.essence;
    this.healthValue.textContent = `${Math.ceil(engine.hero.health)}/${engine.hero.maxHealth}`;
    this.essenceValue.textContent = `${Math.floor(engine.essence)}/${engine.cultivationMaxEssence}`;
    const target = engine.target;
    const targetDescription = target ? `Alvo: ${target.name ?? target.id} · ${target.health}/${target.maxHealth} PV`
      : 'Alvo: nenhum — toque num inimigo';
    this.target.hidden = !target;
    this.target.textContent = target ? `${target.name ?? target.id} · ${target.health} PV` : '';
    this.target.setAttribute('aria-label', targetDescription);
    this.target.title = targetDescription;
    const autoState = engine.autoTarget ? 'ligado' : 'desligado';
    this.auto.textContent = `Auto: ${engine.autoTarget ? 'sim' : 'não'}`;
    this.auto.setAttribute('aria-label', `Alvo automático: ${autoState}`);
    this.auto.setAttribute('aria-pressed', String(engine.autoTarget));
    const basic = this.actions.get('basic')!;
    const basicCooldown = engine.cooldownRemaining('basic', now);
    basic.querySelector('small')!.textContent = basicCooldown ? formatTime(basicCooldown) : 'Básico';
    basic.disabled = !engine.hero.alive || basicCooldown > 0;

    this.paintAbility('attack', now, engine.equipment.attack);
    this.paintAbility('movement', now, engine.equipment.movement);
    this.paintAbility('support', now, engine.equipment.support);

    const item = this.actions.get('item:flash-blink')!;
    const itemIcon = this.icons.get('item:flash-blink');
    const count = engine.inventoryCount('flash-blink');
    item.hidden = count <= 0;
    item.disabled = count <= 0 || !engine.hero.alive;
    if (count > 0) {
      this.paintIcon(itemIcon, 'flash-blink');
      item.querySelector('small')!.textContent = `Clarão ×${count}`;
    }

    this.respawn.hidden = engine.hero.alive;
    const cicada = this.root.querySelector('.combat-cicada')!;
    const remaining = engine.cooldownRemaining('cicada', now);
    cicada.textContent = `Cigarra · ${formatTime(remaining)}`;
    cicada.toggleAttribute('hidden', remaining === 0);
  }
  destroy(): void { this.root.remove(); }
}
