import { characterSheetState, FANG_YUAN_PROFILE } from '../entities/characterProfile';
import { breakthroughMaterialName } from '../entities/cultivationBalance';
import { CharacterCultivation, TEST_STONE_GRANT } from '../entities/characterCultivation';
import type { CardinalDirection } from '../entities/directions';
import { AdvanceIntent } from './advanceIntent';
import type { CombatEngine } from '../combat/combatEngine';
import { GU_CATALOG, GU_SLOTS, type CombatSettings } from '../combat/combatConfig';
import type { GuId, GuSlot } from '../combat/types';
import { primordialSeaOffset, SHEET_SEA_SIZE } from './primordialSea';

type SheetTab = 'advance' | 'inventory';
const slotLabels: Record<GuSlot, string> = {
  attack: 'ataque', passive: 'passivo', movement: 'movimento', support: 'apoio',
};

/** Textos da adaptação de teste; parâmetros vêm da configuração do motor. */
function guEffect(id: GuId | null, config: CombatSettings): string {
  switch (id) {
    case 'moonlight': return `Ativo · ${config.moonlight.damage} dano, ${config.moonlight.range}px · ${config.moonlight.essenceCost} essência primordial · ${(config.moonlight.cooldownMs / 1000).toFixed(1)}s de recarga.`;
    case 'stone-skin': return `Passivo · +${config.stoneSkin.defenseBonus} defesa enquanto equipado.`;
    case 'whirlwind': return `Ativo · dash ${config.movement.distance}px · ${config.movement.essenceCost} essência primordial · ${(config.movement.cooldownMs / 1000).toFixed(1)}s de recarga e bônus temporário de velocidade.`;
    case 'liquor-worm': return `Passivo · +${config.liquorWorm.bonusEssenceRegenPerSecond} essência primordial por segundo enquanto equipado.`;
    default: return 'Slot vazio · nenhum efeito ativo.';
  }
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento da ficha não encontrado: ${id}`);
  return element as T;
}

/** Ficha de leitura e comando: validações e sorteios permanecem no motor de cultivo. */
export class CharacterSheet {
  private readonly panel = requiredElement<HTMLElement>('character-sheet');
  private readonly toggle = requiredElement<HTMLButtonElement>('character-toggle');
  private readonly closeButton = requiredElement<HTMLButtonElement>('character-close');
  private readonly activity = requiredElement<HTMLElement>('character-activity');
  private readonly direction = requiredElement<HTMLElement>('character-direction');
  private readonly rank = requiredElement<HTMLElement>('character-rank');
  private readonly stage = requiredElement<HTMLElement>('character-stage');
  private readonly stones = requiredElement<HTMLElement>('character-stones');
  private readonly materials = requiredElement<HTMLElement>('character-materials');
  private readonly sea = requiredElement<HTMLElement>('character-sea');
  private readonly seaAmount = requiredElement<HTMLElement>('character-sea-amount');
  private readonly target = requiredElement<HTMLElement>('advance-target');
  private readonly price = requiredElement<HTMLElement>('advance-stones');
  private readonly materialRow = requiredElement<HTMLElement>('advance-materials-row');
  private readonly materialPrice = requiredElement<HTMLElement>('advance-materials');
  private readonly chanceRow = requiredElement<HTMLElement>('advance-chance-row');
  private readonly chance = requiredElement<HTMLElement>('advance-chance');
  private readonly reason = requiredElement<HTMLElement>('advance-reason');
  private readonly feedback = requiredElement<HTMLElement>('advance-feedback');
  private readonly advanceButton = requiredElement<HTMLButtonElement>('advance-action');
  private readonly intent = new AdvanceIntent();
  private readonly tabs: Record<SheetTab, HTMLButtonElement> = {
    advance: requiredElement('tab-advance'), inventory: requiredElement('tab-inventory'),
  };
  private readonly panels: Record<SheetTab, HTMLElement> = {
    advance: requiredElement('panel-advance'), inventory: requiredElement('panel-inventory'),
  };
  private readonly selects = new Map<GuSlot, HTMLSelectElement>();
  private readonly equipHandlers = new Map<GuSlot, () => void>();
  private readonly generatedOptions: HTMLOptionElement[] = [];
  private readonly effects = new Map<GuSlot, HTMLElement>();
  private readonly icons = new Map<GuSlot, HTMLElement>();
  private readonly collection = requiredElement<HTMLElement>('gu-collection');
  private readonly choices = new Map<GuId, HTMLButtonElement>();
  private readonly choiceHandlers = new Map<GuId, () => void>();
  private readonly gearLock = requiredElement<HTMLElement>('gear-lock');
  private readonly guFeedback = requiredElement<HTMLElement>('gu-feedback');
  private readonly slotCount = requiredElement<HTMLElement>('gu-slot-count');
  private activeTab: SheetTab = 'advance';
  private facing: CardinalDirection = 'down';
  private moving = false;
  private lastCultivation = '';

  private readonly onToggle = () => {
    if (this.panel.hidden) this.open(); else this.close();
  };
  private readonly onClose = () => this.close();
  private readonly onAdvanceTab = () => this.selectTab('advance');
  private readonly onInventoryTab = () => this.selectTab('inventory');
  private readonly onTabKeyDown = (event: KeyboardEvent) => {
    const current = event.currentTarget === this.tabs.inventory ? 'inventory' : 'advance';
    const next = event.key === 'Home' ? 'advance' : event.key === 'End' ? 'inventory'
      : event.key === 'ArrowRight' ? 'inventory' : event.key === 'ArrowLeft' ? 'advance' : null;
    if (next) { event.preventDefault(); this.selectTab(next, true); }
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); this.selectTab(current, true);
    }
  };
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !this.panel.hidden) this.close();
  };
  private readonly onAdvance = () => {
    const requirement = this.cultivation.requirement;
    const intent = this.intent.press(requirement.canAdvance, this.cultivation.revision);
    if (intent.kind === 'blocked') return;
    if (intent.kind === 'review') {
      this.feedback.textContent = '';
    } else if (intent.kind === 'confirm') {
      this.feedback.textContent = requirement.kind === 'rank'
        ? `Confirme: gastar ${requirement.stones} pedras e os materiais indicados. Sucesso: ${Math.round(requirement.successChance * 100)}%. Na falha, as pedras são perdidas.`
        : requirement.kind === 'stage' ? `Confirme o gasto de ${requirement.stones} pedras espirituais.` : '';
    } else {
      const before = this.cultivation.state;
      try {
        const result = this.cultivation.advance(intent.revision);
        if (result.status === 'advanced') {
          this.feedback.textContent = before.rank !== result.state.rank
            ? `Ruptura bem-sucedida! Rank ${result.state.rank} · Inicial.`
            : `Estágio alcançado: Rank ${result.state.rank} · ${result.state.stage}.`;
        } else if (result.status === 'failed') {
          const lost = Object.values(result.lostMaterials ?? {}).reduce((sum, amount) => sum + amount, 0);
          this.feedback.textContent = `Ruptura falhou: ${before.spiritStones - result.state.spiritStones} pedras perdidas${lost > 0 ? ` e ${lost} materiais` : '; materiais preservados'}.`;
        } else {
          this.intent.phase = 'review';
          this.feedback.textContent = 'Os requisitos mudaram. Confira antes de tentar novamente.';
        }
      } catch {
        this.intent.phase = 'review';
        this.feedback.textContent = 'Não foi possível salvar o cultivo; nenhum recurso foi gasto.';
      }
    }
    this.renderCultivation();
  };

  constructor(private readonly cultivation: CharacterCultivation,
    private readonly combat?: CombatEngine,
    private readonly getNow: () => number = () => performance.now()) {
    requiredElement<HTMLElement>('character-name').textContent = FANG_YUAN_PROFILE.name;
    requiredElement<HTMLElement>('character-area').textContent = FANG_YUAN_PROFILE.area;
    requiredElement<HTMLElement>('character-storage-note').textContent = cultivation.persistent ? ''
      : 'Armazenamento indisponível neste navegador: o progresso desta sessão não será salvo.';
    requiredElement<HTMLElement>('character-test-stones').textContent = cultivation.hasTestStones
      ? `Modo de teste: +${TEST_STONE_GRANT.toLocaleString('pt-BR')} pedras espirituais concedidas uma vez. Não são essência primordial.`
      : '';
    this.renderCultivation();
    this.renderSea();
    for (const slot of GU_SLOTS) {
      const select = requiredElement<HTMLSelectElement>(`gu-${slot}`);
      this.selects.set(slot, select);
      this.effects.set(slot, requiredElement(`gu-effect-${slot}`));
      this.icons.set(slot, requiredElement(`gu-icon-${slot}`));
      if (combat) {
        for (const [id, gu] of Object.entries(GU_CATALOG)) {
          if (gu.slot !== slot || !combat.testInventory.has(id as GuId)) continue;
          const option = document.createElement('option');
          option.value = id;
          option.textContent = gu.label;
          select.appendChild(option);
          this.generatedOptions.push(option);
        }
      }
      const handler = () => this.onEquip(slot);
      this.equipHandlers.set(slot, handler);
      select.addEventListener('change', handler);
    }
    if (combat) {
      for (const id of ['moonlight', 'liquor-worm', 'stone-skin', 'whirlwind'] as const) {
        if (!combat.testInventory.has(id)) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gu-choice';
        button.setAttribute('aria-label', `Equipar ou remover ${GU_CATALOG[id].label}`);
        const icon = document.createElement('span');
        icon.className = 'gu-icon';
        icon.setAttribute('data-gu', id);
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.textContent = {
          moonlight: 'Moonlight', 'liquor-worm': 'Licor', 'stone-skin': 'Stone Skin', whirlwind: 'Whirlwind',
        }[id];
        button.appendChild(icon);
        button.appendChild(label);
        const handler = () => this.changeEquipment(GU_CATALOG[id].slot,
          combat.equipment[GU_CATALOG[id].slot] === id ? null : id);
        button.addEventListener('click', handler);
        this.choiceHandlers.set(id, handler);
        this.choices.set(id, button);
        this.collection.appendChild(button);
      }
    }
    this.renderEquipment();
    this.toggle.addEventListener('click', this.onToggle);
    this.closeButton.addEventListener('click', this.onClose);
    this.advanceButton.addEventListener('click', this.onAdvance);
    this.tabs.advance.addEventListener('click', this.onAdvanceTab);
    this.tabs.inventory.addEventListener('click', this.onInventoryTab);
    this.tabs.advance.addEventListener('keydown', this.onTabKeyDown);
    this.tabs.inventory.addEventListener('keydown', this.onTabKeyDown);
    document.addEventListener('keydown', this.onKeyDown);
  }

  update(facing: CardinalDirection, moving: boolean): void {
    if (this.facing !== facing || this.moving !== moving) {
      this.facing = facing;
      this.moving = moving;
      if (!this.panel.hidden) this.renderMovement();
    }
    if (!this.panel.hidden) {
      if (this.activeTab === 'advance') this.renderSea();
      else this.renderEquipment();
      const state = this.cultivation.state;
      const key = `${state.rank}:${state.stage}:${state.spiritStones}:${JSON.stringify(state.materials)}`;
      if (key !== this.lastCultivation) this.renderCultivation();
    }
  }

  private selectTab(tab: SheetTab, focus = false): void {
    if (tab !== 'advance' && this.intent.phase === 'confirm') {
      this.intent.phase = 'review';
      this.feedback.textContent = '';
      this.renderCultivation();
    }
    this.activeTab = tab;
    for (const name of ['advance', 'inventory'] as const) {
      const selected = tab === name;
      this.tabs[name].setAttribute('aria-selected', String(selected));
      this.tabs[name].tabIndex = selected ? 0 : -1;
      this.panels[name].hidden = !selected;
    }
    this.panel.scrollTop = 0;
    if (tab === 'inventory') this.renderEquipment();
    if (focus) this.tabs[tab].focus();
  }

  private onEquip(slot: GuSlot): void {
    const chosen = this.selects.get(slot)!.value as GuId | '';
    this.changeEquipment(slot, chosen || null);
  }

  private changeEquipment(slot: GuSlot, chosen: GuId | null): void {
    if (!this.combat) return;
    const result = this.combat.equip(slot, chosen, this.getNow());
    this.guFeedback.textContent = result.ok
      ? chosen ? `${GU_CATALOG[chosen].label} equipado no slot de ${slotLabels[slot]}.`
        : `Slot de ${slotLabels[slot]} vazio.`
      : result.reason ?? 'Não foi possível equipar o Gu.';
    this.renderEquipment(); // Também restaura a seleção anterior após uma tentativa bloqueada.
  }

  private renderEquipment(): void {
    const combat = this.combat;
    const locked = !combat || !combat.hero.alive || combat.inCombat(this.getNow());
    this.gearLock.textContent = !combat ? 'Inventário de teste indisponível.'
      : !combat.hero.alive ? 'Troca bloqueada enquanto Fang Yuan está derrotado.'
        : locked ? 'Em combate · não é possível trocar Gu agora.'
          : 'Fora de combate · toque em um slot para equipar ou remover Gu.';
    this.gearLock.setAttribute('data-locked', String(locked));
    this.slotCount.textContent = `${combat ? GU_SLOTS.filter(slot => combat.equipment[slot] !== null).length : 0} / 4`;
    for (const slot of GU_SLOTS) {
      const select = this.selects.get(slot)!;
      const equipped = combat?.equipment[slot] ?? null;
      select.disabled = locked;
      select.value = equipped ?? '';
      const icon = this.icons.get(slot)!;
      if (equipped) icon.setAttribute('data-gu', equipped);
      else icon.removeAttribute('data-gu');
      this.effects.get(slot)!.textContent = combat
        ? guEffect(equipped, combat.config) : 'Nenhum Gu disponível.';
    }
    for (const [id, choice] of this.choices) {
      choice.disabled = locked;
      choice.setAttribute('aria-pressed', String(combat?.equipment[GU_CATALOG[id].slot] === id));
    }
  }

  private renderSea(): void {
    if (!this.combat) return;
    const { essence, config } = this.combat;
    const maximum = config.hero.maxEssence;
    this.sea.style.backgroundPositionX = `${primordialSeaOffset(essence, maximum, SHEET_SEA_SIZE)}px`;
    this.sea.setAttribute('aria-label', `Mar Primordial na abertura: ${Math.floor(essence)} de ${maximum} de essência primordial`);
    this.seaAmount.textContent = `${Math.floor(essence)} / ${maximum} de essência primordial`;
  }

  private renderMovement(): void {
    const state = characterSheetState(this.facing, this.moving);
    this.activity.textContent = state.activity;
    this.direction.textContent = state.direction;
  }

  private renderCultivation(): void {
    const state = this.cultivation.state;
    const next = this.cultivation.requirement;
    this.intent.resetIfStale(this.cultivation.revision);
    this.rank.textContent = String(state.rank);
    this.stage.textContent = state.stage;
    this.stones.textContent = state.spiritStones.toLocaleString('pt-BR');
    this.materials.textContent = String(Object.values(state.materials).reduce((sum, count) => sum + count, 0));
    this.materialRow.hidden = next.kind !== 'rank';
    this.chanceRow.hidden = next.kind !== 'rank';
    this.advanceButton.disabled = !next.canAdvance;
    if (next.kind === 'stage') {
      this.target.textContent = `Rank ${state.rank} · ${next.nextStage}`;
      this.price.textContent = `${next.stones} pedras`;
      this.reason.textContent = next.missingStones > 0
        ? `Faltam ${next.missingStones} pedras espirituais.` : 'Requisitos atendidos.';
      this.advanceButton.textContent = 'Avançar de estágio';
    } else if (next.kind === 'rank') {
      this.target.textContent = `Rank ${state.rank + 1} · Inicial`;
      this.price.textContent = `${next.stones} pedras`;
      this.materialPrice.textContent = next.materials.map(({ id, quantity }) =>
        `${state.materials[id] ?? 0}/${quantity} ${breakthroughMaterialName(state.rank)}`).join(', ');
      this.chance.textContent = `${Math.round(next.successChance * 100)}% de sucesso · ${Math.round(next.materialLossChance * 100)}% de perda por material na falha`;
      const gaps = [next.missingStones > 0 ? `${next.missingStones} pedras` : '',
        ...next.missingMaterials.map(({ quantity }) => `${quantity} materiais`)].filter(Boolean);
      this.reason.textContent = gaps.length ? `Faltam: ${gaps.join(' e ')}.` : 'Requisitos atendidos. A ruptura pode falhar.';
      this.advanceButton.textContent = 'Tentar ruptura';
    } else {
      this.target.textContent = next.kind === 'maximum' ? 'Rank 9 · Pico (limite)' : 'A definir';
      this.price.textContent = '—';
      this.reason.textContent = next.kind === 'maximum' ? 'Limite de cultivo alcançado.' : 'Requisitos indisponíveis.';
      this.advanceButton.textContent = 'Avançar';
    }
    if (this.intent.phase === 'confirm') {
      this.advanceButton.textContent = 'Confirmar gasto';
    } else if (this.intent.phase === 'settled') {
      this.advanceButton.textContent = 'Revisar próximo avanço';
      this.advanceButton.disabled = false;
    }
    this.lastCultivation = `${state.rank}:${state.stage}:${state.spiritStones}:${JSON.stringify(state.materials)}`;
  }

  private open(): void {
    if (this.intent.phase === 'settled') this.intent.phase = 'review';
    this.renderMovement();
    this.renderCultivation();
    this.renderSea();
    this.renderEquipment();
    this.panel.hidden = false;
    this.toggle.setAttribute('aria-expanded', 'true');
    this.closeButton.focus();
  }

  private close(): void {
    if (this.intent.phase === 'confirm') {
      this.intent.phase = 'review';
      this.feedback.textContent = '';
    }
    this.panel.hidden = true;
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.focus();
  }

  destroy(): void {
    this.toggle.removeEventListener('click', this.onToggle);
    this.closeButton.removeEventListener('click', this.onClose);
    this.advanceButton.removeEventListener('click', this.onAdvance);
    this.tabs.advance.removeEventListener('click', this.onAdvanceTab);
    this.tabs.inventory.removeEventListener('click', this.onInventoryTab);
    this.tabs.advance.removeEventListener('keydown', this.onTabKeyDown);
    this.tabs.inventory.removeEventListener('keydown', this.onTabKeyDown);
    for (const [slot, select] of this.selects) select.removeEventListener('change', this.equipHandlers.get(slot)!);
    for (const [id, choice] of this.choices) choice.removeEventListener('click', this.choiceHandlers.get(id)!);
    for (const option of this.generatedOptions) option.remove();
    this.collection.replaceChildren();
    document.removeEventListener('keydown', this.onKeyDown);
  }
}
