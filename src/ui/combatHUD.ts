import type { CombatEngine } from '../combat/combatEngine';
import type { Direction } from '../combat/types';
import { cardinalFromTouch } from './cardinalStick';


const formatTime = (ms: number) => ms ? `${(ms / 1000).toFixed(1)}s` : 'pronto';

/** Interface DOM de toque: controles não dependem da renderização do mundo. */
export class CombatHUD {
  readonly root: HTMLElement;
  private readonly health: HTMLProgressElement;
  private readonly essence: HTMLProgressElement;
  private readonly stats: HTMLElement;
  private readonly target: HTMLElement;
  private readonly feedback: HTMLElement;
  private readonly actions = new Map<string, HTMLButtonElement>();
  private readonly auto: HTMLButtonElement;
  private readonly respawn: HTMLButtonElement;
  private readonly joystick: HTMLElement;
  direction: Direction | null = null;

  constructor(private readonly engine: CombatEngine, onAction: (action: string) => void) {
    const root = document.createElement('div');
    root.className = 'combat-hud';
    root.innerHTML = `<section class="combat-top" aria-label="Estado de combate">
      <div class="combat-topline"><strong>Fang Yuan</strong><span>Estado de combate</span></div>
      <div class="combat-bars">
        <label>Vida <progress id="combat-health" max="100" value="100"></progress></label>
        <label>Essência primordial <progress id="combat-essence" max="100" value="100"
          aria-label="Essência primordial"></progress></label>
        <small id="combat-stats"></small>
      </div>
      <div class="combat-target"><strong id="combat-target-name">Alvo: nenhum</strong>
      <button type="button" data-action="auto" aria-pressed="false">Alvo auto: desligado</button></div>
    </section>
    <div class="combat-feedback" role="status" aria-live="polite"></div>
    <div class="combat-joystick" aria-label="Direcional de movimento" role="group"><span class="joystick-knob">✥</span></div>
    <div class="combat-actions" aria-label="Ações de combate">
      <button type="button" data-action="basic">⚔ <small>Básico</small></button>
      <button type="button" data-action="moonlight" aria-label="Usar Moonlight Gu"><span class="gu-icon" data-gu="moonlight" aria-hidden="true"></span><small>Lua</small></button>
      <button type="button" data-action="dash" aria-label="Usar Whirlwind Gu (dash)"><span class="gu-icon" data-gu="whirlwind" aria-hidden="true"></span><small>Dash</small></button>
    </div>
    <button type="button" class="combat-respawn" data-action="respawn" hidden>Retornar ao início</button>
    <div class="combat-cicada" aria-label="Recarga da Cigarra"></div>`;
    document.body.append(root);
    this.root = root;
    this.health = root.querySelector('#combat-health')!;
    this.essence = root.querySelector('#combat-essence')!;
    this.stats = root.querySelector('#combat-stats')!;
    this.target = root.querySelector('#combat-target-name')!;
    this.feedback = root.querySelector('.combat-feedback')!;
    this.auto = root.querySelector('[data-action="auto"]')!;
    this.respawn = root.querySelector('[data-action="respawn"]')!;
    this.joystick = root.querySelector('.combat-joystick')!;
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-action]')) {
      const action = button.dataset.action!;
      if (action !== 'auto' && action !== 'respawn') this.actions.set(action, button);
      button.addEventListener('click', () => onAction(action));
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
      this.joystick.setPointerCapture(event.pointerId);
      steer(event); event.preventDefault();
    });
    this.joystick.addEventListener('pointermove', event => {
      if (this.joystick.hasPointerCapture(event.pointerId)) steer(event);
    });
    const release = () => { this.direction = null; this.joystick.dataset.direction = ''; };
    this.joystick.addEventListener('pointerup', release);
    this.joystick.addEventListener('pointercancel', release);
    this.joystick.addEventListener('lostpointercapture', release);
  }

  say(message: string): void { this.feedback.textContent = message; }
  update(now: number): void {
    const { engine } = this;
    this.health.max = engine.hero.maxHealth;
    this.health.value = engine.hero.health;
    this.essence.max = engine.config.hero.maxEssence;
    this.essence.value = engine.essence;
    this.stats.textContent = `${Math.ceil(engine.hero.health)}/${engine.hero.maxHealth} PV · ${Math.floor(engine.essence)}/${engine.config.hero.maxEssence} essência primordial · Def ${engine.defense}`;
    const target = engine.target;
    const targetDescription = target ? `Alvo: ${target.id} · ${target.health}/${target.maxHealth} PV`
      : 'Alvo: nenhum — toque num inimigo';
    const compact = window.innerWidth <= 600 ||
      (window.innerHeight <= 420 && window.innerWidth <= 900);
    this.target.textContent = compact
      ? target ? `${target.id} · ${target.health} PV` : 'Alvo: nenhum'
      : targetDescription;
    this.target.setAttribute('aria-label', targetDescription);
    this.target.title = targetDescription;
    const autoState = engine.autoTarget ? 'ligado' : 'desligado';
    this.auto.textContent = compact ? `Auto: ${autoState}` : `Alvo auto: ${autoState}`;
    this.auto.setAttribute('aria-label', `Alvo automático: ${autoState}`);
    this.auto.setAttribute('aria-pressed', String(engine.autoTarget));
    const basic = this.actions.get('basic')!;
    basic.querySelector('small')!.textContent = formatTime(engine.cooldownRemaining('basic', now)) === 'pronto' ? 'Básico' : formatTime(engine.cooldownRemaining('basic', now));
    basic.disabled = !engine.hero.alive || engine.cooldownRemaining('basic', now) > 0;
    const moon = this.actions.get('moonlight')!;
    moon.hidden = engine.equipment.attack !== 'moonlight';
    moon.title = `Custo: ${engine.config.moonlight.essenceCost} essência primordial · Alcance: ${engine.config.moonlight.range}px`;
    moon.querySelector('small')!.textContent = engine.cooldownRemaining('moonlight', now) ? formatTime(engine.cooldownRemaining('moonlight', now)) : `Lua ·${engine.config.moonlight.essenceCost}`;
    moon.disabled = !engine.hero.alive || engine.cooldownRemaining('moonlight', now) > 0 || engine.essence < engine.config.moonlight.essenceCost;
    const dash = this.actions.get('dash')!;
    dash.hidden = engine.equipment.movement !== 'whirlwind';
    dash.title = `Custo: ${engine.config.movement.essenceCost} essência primordial · Distância: ${engine.config.movement.distance}px`;
    dash.querySelector('small')!.textContent = engine.cooldownRemaining('dash', now) ? formatTime(engine.cooldownRemaining('dash', now)) : `Dash ·${engine.config.movement.essenceCost}`;
    dash.disabled = !engine.hero.alive || engine.cooldownRemaining('dash', now) > 0 || engine.essence < engine.config.movement.essenceCost;
    this.respawn.hidden = engine.hero.alive;
    this.root.querySelector('.combat-cicada')!.textContent = `Cigarra · ${formatTime(engine.cooldownRemaining('cicada', now))}`;
  }
  destroy(): void { this.root.remove(); }
}
