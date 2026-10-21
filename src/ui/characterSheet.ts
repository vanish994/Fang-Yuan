import { characterSheetState, FANG_YUAN_PROFILE } from '../entities/characterProfile';
import { playerCharacter, type PlayerCharacterId } from '../combat/characterCatalog';
import { breakthroughMaterialName } from '../entities/cultivationBalance';
import { recipeAvailability, recipeBlockReason, recipeRenderKey, type RecipeContext }
  from './recipeView';
import { TEST_STONE_GRANT } from '../entities/characterCultivation';
import type { CharacterCultivation } from '../entities/characterCultivation';
import type { CardinalDirection } from '../entities/directions';
import { AdvanceIntent } from './advanceIntent';
import type { CombatEngine } from '../combat/combatEngine';
import { GU_SLOTS } from '../combat/combatConfig';
import { CATEGORY_LABELS, FIDELITY_LABELS, GU_CATALOG, GU_IDS, PENDING_GU_SLOTS,
  isAssimilable, isEquippable } from '../combat/guCatalog';
import type { GuDefinition, GuId, GuRecipe, GuSlot } from '../combat/types';
import { primordialSeaOffset, SHEET_SEA_SIZE } from './primordialSea';

type SheetTab = 'advance' | 'inventory';
const slotLabels: Record<GuSlot, string> = {
  attack: 'ataque', passive: 'passivo', movement: 'movimento', support: 'apoio',
};

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento da ficha não encontrado: ${id}`);
  return element as T;
}

function create(tag: string, className = '', text = ''): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;

/**
 * Só quatro Gu têm arte própria (atlas 2x2). Os demais usam o glifo declarado
 * em `visual.glyph`, para que nenhum Gu fique sem identificação visual.
 */
function applyGuIcon(element: HTMLElement, id: GuId | null): void {
  if (!id) {
    element.removeAttribute('data-gu');
    element.removeAttribute('data-glyph');
    element.removeAttribute('data-sprite');
    element.style.backgroundColor = '';
    element.textContent = '';
    return;
  }
  const gu = GU_CATALOG[id];
  element.setAttribute('data-gu', id);
  if (gu.visual.sprite) {
    element.setAttribute('data-glyph', gu.visual.glyph);
    element.setAttribute('data-sprite', '');
    element.style.backgroundColor = '';
    element.textContent = '';
  } else {
    element.setAttribute('data-glyph', gu.visual.glyph);
    element.removeAttribute('data-sprite');
    element.style.backgroundColor = gu.visual.color;
    element.textContent = gu.visual.glyph;
  }
}

/** Texto derivado exclusivamente da definição central do Gu. */
function guEffectText(gu: GuDefinition): string {
  if (gu.assimilation) {
    const parts: string[] = [];
    if (gu.assimilation.physicalDamageBonus !== undefined) {
      parts.push(`+${Math.round(gu.assimilation.physicalDamageBonus * 100)}% dano físico`);
    }
    if (gu.assimilation.meleeDamageBonus !== undefined) {
      parts.push(`+${Math.round(gu.assimilation.meleeDamageBonus * 100)}% dano corpo a corpo`);
    }
    if (gu.assimilation.maxHealthBonus) parts.push(`+${gu.assimilation.maxHealthBonus} vida`);
    return `Assimilável · ${parts.join(' · ')} permanente.`;
  }
  if (gu.categories.includes('consumable') && gu.active) {
    if (gu.active.kind === 'blind') {
      return `Consumível · cega inimigos num raio de ${gu.active.radius}px por ${seconds(gu.active.durationMs)}. Uso único.`;
    }
    return 'Consumível · efeito de uso único.';
  }
  const passiveParts: string[] = [];
  if (gu.passive) {
    if (gu.passive.defense) passiveParts.push(`+${gu.passive.defense} defesa`);
    if (gu.passive.maxHealthMultiplier) {
      passiveParts.push(`+${Math.round((gu.passive.maxHealthMultiplier - 1) * 100)}% vida máxima`);
    }
    if (gu.passive.maxHealthBonus) passiveParts.push(`+${gu.passive.maxHealthBonus} vida`);
    if (gu.passive.essenceRegenBonus) passiveParts.push(`+${gu.passive.essenceRegenBonus} essência/s`);
    if (gu.passive.essenceRegenMultiplier) {
      passiveParts.push(`${Math.round((gu.passive.essenceRegenMultiplier - 1) * 100)}% regeneração de essência`);
    }
    if (gu.passive.movementMultiplier && gu.passive.movementMultiplier !== 1) {
      passiveParts.push(`${Math.round((gu.passive.movementMultiplier - 1) * 100)}% velocidade`);
    }
    if (gu.passive.lowHealthDefense) {
      passiveParts.push(`+${gu.passive.lowHealthDefense.defense} defesa abaixo de `
        + `${Math.round(gu.passive.lowHealthDefense.healthRatio * 100)}% de vida`);
    }
  }
  if (passiveParts.length) {
    return `Passivo · ${passiveParts.join(' · ')} enquanto equipado.`;
  }
  const active = gu.active;
  if (!active) return 'Efeito ainda não configurado.';
  const cost = `${gu.usage.essenceCost} essência`;
  const cooldown = `${seconds(gu.usage.cooldownMs)} de recarga`;
  if (active.kind === 'projectile') {
    const count = active.count > 1 ? ` ×${active.count}` : '';
    return `Ativo · ${active.damage} dano${count}, ${active.range}px · ${cost} · ${cooldown}`
      + `${active.pierce ? ' · perfurante' : ''}${active.splashRadius > 0 ? ' · área' : ''}.`;
  }
  if (active.kind === 'dash') {
    return `Ativo · deslocamento ${active.distance}px · ${cost} · ${cooldown} e `
      + `${active.speedMultiplier}× velocidade por ${seconds(active.durationMs)}.`;
  }
  if (active.kind === 'buff') {
    const parts: string[] = [];
    if (active.damageMultiplier > 1) parts.push(`+${Math.round((active.damageMultiplier - 1) * 100)}% dano`);
    if (active.movementMultiplier > 1) parts.push(`+${Math.round((active.movementMultiplier - 1) * 100)}% velocidade`);
    if (active.defenseBonus) parts.push(`${active.defenseBonus > 0 ? '+' : ''}${active.defenseBonus} defesa`);
    return `Ativo · ${parts.join(' · ')} por ${seconds(active.durationMs)} · ${cost} · ${cooldown}.`;
  }
  if (active.kind === 'empower') {
    return `Ativo · próxima ativação +${Math.round((active.effectMultiplier - 1) * 100)}% de efeito e `
      + `+${Math.round((active.costMultiplier - 1) * 100)}% de custo por ${seconds(active.durationMs)} · ${cost} · ${cooldown}.`;
  }
  if (active.kind === 'heal') {
    return `Ativo · restaura ${active.amount} de vida · ${cost} · ${cooldown}.`;
  }
  return `Ativo · ${cost} · ${cooldown}.`;
}

function slotRequirements(gu: GuDefinition): string {
  return `${slotLabels[gu.slot]} · Rank mínimo ${gu.usage.requiresRank}`;
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
  private readonly optionSignatures = new Map<GuSlot, string>();
  private readonly generatedOptions: HTMLOptionElement[] = [];
  private readonly effects = new Map<GuSlot, HTMLElement>();
  private readonly icons = new Map<GuSlot, HTMLElement>();
  private readonly collection = requiredElement<HTMLElement>('gu-collection');
  private readonly gearLock = requiredElement<HTMLElement>('gear-lock');
  private readonly guFeedback = requiredElement<HTMLElement>('gu-feedback');
  private readonly slotCount = requiredElement<HTMLElement>('gu-slot-count');
  private readonly statHealth = requiredElement<HTMLElement>('stat-health');
  private readonly statAttack = requiredElement<HTMLElement>('stat-attack');
  private readonly statDefense = requiredElement<HTMLElement>('stat-defense');
  private readonly statEssence = requiredElement<HTMLElement>('stat-essence');
  private readonly statBase = requiredElement<HTMLElement>('stat-base');
  private readonly statEquipped = requiredElement<HTMLElement>('stat-equipped');
  private readonly statTemporary = requiredElement<HTMLElement>('stat-temporary');
  private readonly statPermanent = requiredElement<HTMLElement>('stat-permanent');
  private readonly recipeList = requiredElement<HTMLElement>('recipe-list');
  private readonly refineFeedback = requiredElement<HTMLElement>('refine-feedback');
  private activeTab: SheetTab = 'advance';
  private facing: CardinalDirection = 'down';
  private moving = false;
  private lastCultivation = '';
  private lastInventoryKey = '';
  /** Chave dos cards de refino: sem ela, o DOM era reconstruído a cada quadro. */
  private lastRecipeKey = '';
  private readonly recipeEntries: { recipe: GuRecipe; button: HTMLButtonElement }[] = [];
  private lastPaintAt = -Infinity;

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
    this.renderEquipment(true);
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
      const handler = () => this.onEquip(slot);
      this.equipHandlers.set(slot, handler);
      select.addEventListener('change', handler);
    }
    this.renderEquipment(true);
    this.toggle.addEventListener('click', this.onToggle);
    this.closeButton.addEventListener('click', this.onClose);
    this.advanceButton.addEventListener('click', this.onAdvance);
    this.tabs.advance.addEventListener('click', this.onAdvanceTab);
    this.tabs.inventory.addEventListener('click', this.onInventoryTab);
    this.tabs.advance.addEventListener('keydown', this.onTabKeyDown);
    this.tabs.inventory.addEventListener('keydown', this.onTabKeyDown);
    document.addEventListener('keydown', this.onKeyDown);
  }

  /**
   * Identidade mostrada na ficha. O motor é a fonte do personagem em campo; aqui só
   * se troca nome, área e retrato, sem tocar em cultivo, Gu ou receitas.
   */
  setCharacter(id: PlayerCharacterId): void {
    const profile = playerCharacter(id);
    requiredElement<HTMLElement>('character-name').textContent = profile.name;
    requiredElement<HTMLElement>('character-area').textContent = profile.id === 'fang-yuan'
      ? FANG_YUAN_PROFILE.area : `${FANG_YUAN_PROFILE.area} · a distância`;
    requiredElement<HTMLElement>('sheet-title').textContent = profile.name;
    const eyebrow = document.querySelector<HTMLElement>('.sheet-header .eyebrow');
    if (eyebrow) {
      eyebrow.textContent = profile.id === 'fang-yuan' ? 'Personagem / 01' : 'Personagem / 02';
    }
    const portrait = document.querySelector<HTMLElement>('.sheet-portrait');
    if (portrait) {
      portrait.dataset.character = profile.id;
      portrait.setAttribute('aria-label', `Retrato de ${profile.name}`);
    }
  }

  update(facing: CardinalDirection, moving: boolean): void {
    if (this.facing !== facing || this.moving !== moving) {
      this.facing = facing;
      this.moving = moving;
      if (!this.panel.hidden) this.renderMovement();
    }
    if (!this.panel.hidden) {
      if (this.activeTab === 'advance') this.renderSea();
      else {
        this.renderEquipment();
        this.renderStats();
        // A essência muda a cada quadro: só a disponibilidade dos botões é
        // recalculada; os cards em si seguem intactos.
        this.renderRecipes();
      }
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
    if (tab === 'inventory') {
      this.renderEquipment(true);
      this.renderStats();
      this.renderRecipes();
    }
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
    this.renderEquipment(true); // Também restaura a seleção anterior após uma tentativa bloqueada.
    this.renderStats();
  }

  private onAssimilate(id: GuId): void {
    if (!this.combat) return;
    const result = this.combat.assimilate(id, this.getNow());
    this.guFeedback.textContent = result.ok
      ? `${GU_CATALOG[id].label} assimilado. O benefício permanente não pode ser obtido de novo.`
      : result.reason ?? 'Não foi possível assimilar o Gu.';
    this.renderEquipment(true);
    this.renderStats();
  }

  private onUseItem(id: GuId): void {
    if (!this.combat) return;
    const result = this.combat.useItem(id, this.getNow());
    this.guFeedback.textContent = result.ok
      ? `${GU_CATALOG[id].label} usado.`
      : result.reason ?? 'Não foi possível usar o item.';
    this.renderEquipment(true);
  }

  private onRefine(recipeId: string): void {
    if (!this.combat) return;
    const result = this.combat.refine(recipeId, this.getNow());
    this.refineFeedback.textContent = result.ok
      ? `Refino concluído: ${this.combat.recipes.find(recipe => recipe.id === recipeId)?.name ?? recipeId}.`
      : result.reason ?? 'Não foi possível refinar.';
    this.renderEquipment(true);
    this.renderStats();
    this.renderSea();
  }

  private renderEquipment(force = false): void {
    const combat = this.combat;
    const now = this.getNow();
    const locked = !combat || !combat.hero.alive || combat.inCombat(now);
    this.gearLock.textContent = !combat ? 'Inventário de teste indisponível.'
      : !combat.hero.alive ? 'Troca bloqueada enquanto Fang Yuan está derrotado.'
        : locked ? 'Em combate · não é possível trocar Gu agora.'
          : 'Fora de combate · toque em um cartão para equipar, assimilar ou usar.';
    this.gearLock.setAttribute('data-locked', String(locked));
    this.slotCount.textContent = `${combat ? GU_SLOTS.filter(slot => combat.equipment[slot] !== null).length : 0} / 4`;
    for (const slot of GU_SLOTS) {
      const select = this.selects.get(slot)!;
      const equipped = combat?.equipment[slot] ?? null;
      const owned = combat ? GU_IDS.filter(id => {
        const gu = GU_CATALOG[id];
        return gu.slot === slot && isEquippable(gu) && combat.inventoryCount(id) > 0;
      }) : [];
      const signature = `${owned.join(',')}|${equipped ?? ''}|${locked}`;
      if (this.optionSignatures.get(slot) !== signature) {
        this.optionSignatures.set(slot, signature);
        select.replaceChildren();
        const empty = document.createElement('option');
        empty.value = ''; empty.textContent = 'Vazio';
        select.appendChild(empty);
        for (const id of owned) {
          const option = document.createElement('option');
          option.value = id; option.textContent = GU_CATALOG[id].label;
          select.appendChild(option);
          this.generatedOptions.push(option);
        }
      }
      select.disabled = locked;
      select.value = equipped ?? '';
      applyGuIcon(this.icons.get(slot)!, equipped);
      this.effects.get(slot)!.textContent = combat
        ? (equipped ? guEffectText(GU_CATALOG[equipped]) : 'Slot vazio · nenhum efeito ativo.')
        : 'Nenhum Gu disponível.';
    }

    const key = `${GU_IDS.map(id => combat?.inventoryCount(id) ?? 0).join(':')}|`
      + `${GU_SLOTS.map(slot => combat?.equipment[slot] ?? '').join(':')}|`
      + `${combat ? [...combat.assimilated].join(':') : ''}|${locked}`;
    if (force || key !== this.lastInventoryKey) {
      this.lastInventoryKey = key;
      this.renderCollection(locked);
      this.renderRecipes();
    }
  }

  private renderCollection(locked: boolean): void {
    const combat = this.combat;
    this.collection.replaceChildren();
    this.generatedOptions.length = 0;
    if (!combat) {
      this.collection.appendChild(create('p', 'sheet-note', 'Inventário indisponível.'));
      return;
    }
    const now = this.getNow();
    for (const id of GU_IDS) {
      const gu = GU_CATALOG[id];
      const count = combat.inventoryCount(id);
      const equipped = combat.equipment[gu.slot] === id && isEquippable(gu);
      const assimilated = combat.assimilated.has(id);
      const card = create('article', 'gu-card');
      card.setAttribute('data-gu', id);
      const head = create('div', 'gu-card-head');
      const icon = create('span', 'gu-icon');
      applyGuIcon(icon, id);
      icon.setAttribute('aria-hidden', 'true');
      const title = create('div', 'gu-card-title');
      title.appendChild(create('strong', '', `${gu.label} · Rank ${gu.rank}`));
      const categories = gu.categories.map(category => CATEGORY_LABELS[category]).join(' · ');
      title.appendChild(create('small', '', `${categories} · ${slotRequirements(gu)}`));
      head.appendChild(icon); head.appendChild(title);
      card.appendChild(head);
      card.appendChild(create('p', 'gu-card-effect', guEffectText(gu)));
      const statusParts = [
        `Quantidade: ${count}`,
        `Custo: ${gu.usage.essenceCost} essência`,
        gu.usage.cooldownMs > 0 ? `Recarga: ${seconds(gu.usage.cooldownMs)}` : 'Sem recarga',
        `Fidelidade: ${FIDELITY_LABELS[gu.fidelity]}`,
        `Preço ref.: ${gu.price} pedras`,
        equipped ? 'Equipado' : '',
        assimilated ? 'Assimilado' : '',
        count <= 0 && !assimilated ? 'Não possuído' : '',
      ].filter(Boolean);
      card.appendChild(create('small', 'gu-card-status', statusParts.join(' · ')));
      const actions = create('div', 'gu-card-actions');
      if (isEquippable(gu)) {
        const equip = document.createElement('button');
        equip.type = 'button'; equip.className = 'gu-card-action';
        equip.disabled = locked;
        equip.textContent = equipped ? 'Remover' : count > 0 ? 'Equipar' : 'Indisponível';
        equip.setAttribute('aria-label', equipped ? `Remover ${gu.label}` : `Equipar ${gu.label}`);
        equip.addEventListener('click', () => this.changeEquipment(gu.slot, equipped ? null : id));
        actions.appendChild(equip);
      }
      if (isAssimilable(gu)) {
        const assimilate = document.createElement('button');
        assimilate.type = 'button'; assimilate.className = 'gu-card-action';
        assimilate.disabled = locked || count <= 0 || assimilated;
        assimilate.textContent = assimilated ? 'Assimilado' : count > 0 ? 'Assimilar' : 'Indisponível';
        assimilate.setAttribute('aria-label', `Assimilar ${gu.label}`);
        assimilate.addEventListener('click', () => this.onAssimilate(id));
        actions.appendChild(assimilate);
      }
      if (gu.categories.includes('consumable')) {
        const use = document.createElement('button');
        use.type = 'button'; use.className = 'gu-card-action';
        use.disabled = !combat.hero.alive || count <= 0;
        use.textContent = count > 0 ? 'Usar' : 'Indisponível';
        use.setAttribute('aria-label', `Usar ${gu.label}`);
        use.addEventListener('click', () => this.onUseItem(id));
        actions.appendChild(use);
      }
      card.appendChild(actions);
      const cooldown = combat.cooldownRemaining(id, now);
      if (cooldown > 0) card.appendChild(create('small', 'gu-card-cooldown', `Em recarga: ${seconds(cooldown)}`));
      this.collection.appendChild(card);
    }
    for (const pending of PENDING_GU_SLOTS) {
      this.collection.appendChild(create('p', 'sheet-note gu-pending',
        `Pendente no slot de ${slotLabels[pending.slot]}: ${pending.missing} Gu. ${pending.reason}`));
    }
  }

  private recipeContext(): RecipeContext {
    const combat = this.combat!;
    return {
      rank: combat.cultivationRank,
      essence: combat.essence,
      stock: id => combat.inventoryCount(id),
      alive: combat.hero.alive,
      inCombat: combat.inCombat(this.getNow()),
    };
  }

  /**
   * Reconstrói os cards apenas quando algo estrutural muda. A essência regenera
   * a cada quadro, então a disponibilidade é recalculada em `refreshRecipeButtons`
   * sem tocar na árvore — é isso que preserva o foco de teclado.
   */
  private renderRecipes(force = false): void {
    const combat = this.combat;
    if (!combat) {
      if (force || this.lastRecipeKey !== 'sem-motor') {
        this.lastRecipeKey = 'sem-motor';
        this.recipeEntries.length = 0;
        this.recipeList.replaceChildren();
        this.recipeList.appendChild(create('p', 'sheet-note', 'Refino indisponível.'));
      }
      return;
    }
    const context = this.recipeContext();
    const key = recipeRenderKey(combat.recipes, context);
    if (force || key !== this.lastRecipeKey) {
      this.lastRecipeKey = key;
      this.recipeEntries.length = 0;
      this.recipeList.replaceChildren();
      for (const recipe of combat.recipes) {
        const card = create('article', 'recipe-card');
        card.appendChild(create('strong', '', recipe.name));
        const ingredients = recipe.ingredients.map(ingredient =>
          `${combat.inventoryCount(ingredient.id)}/${ingredient.quantity}× ${GU_CATALOG[ingredient.id].label}`).join(' · ');
        card.appendChild(create('small', '', `Ingredientes: ${ingredients} · Essência: ${recipe.essenceCost}`
          + ` · Rank mínimo: ${recipe.requiresRank} · Resultado: ${GU_CATALOG[recipe.result].label}`));
        card.appendChild(create('small', 'recipe-source', `${FIDELITY_LABELS[recipe.fidelity]} · ${recipe.source.reference}`));
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'gu-card-action';
        button.textContent = 'Refinar';
        button.setAttribute('aria-label', `Refinar ${recipe.name}`);
        button.addEventListener('click', () => this.onRefine(recipe.id));
        card.appendChild(button);
        this.recipeList.appendChild(card);
        this.recipeEntries.push({ recipe, button });
      }
    }
    this.refreshRecipeButtons(context);
  }

  /** Só o estado dos botões muda por quadro (essência, combate, morte). */
  private refreshRecipeButtons(context: RecipeContext): void {
    for (const { recipe, button } of this.recipeEntries) {
      const availability = recipeAvailability(recipe, context);
      const shouldDisable = !availability.usable;
      if (button.disabled !== shouldDisable) button.disabled = shouldDisable;
      const title = recipeBlockReason(recipe, availability);
      if (button.title !== title) button.title = title;
    }
  }

  private renderStats(): void {
    const combat = this.combat;
    if (!combat) return;
    const now = this.getNow();
    if (now === this.lastPaintAt) return;
    this.lastPaintAt = now;
    const stats = combat.stats(now);
    this.statHealth.textContent = `${Math.ceil(combat.hero.health)} / ${stats.total.maxHealth}`;
    this.statAttack.textContent = `${stats.base.attack} · x${combat.meleeDamageMultiplier(now).toFixed(2)} corpo a corpo`;
    this.statDefense.textContent = `${stats.total.defense}`;
    this.statEssence.textContent = `${Math.floor(combat.essence)} / ${stats.total.maxEssence} · +${stats.total.essenceRegen.toFixed(1)}/s`;
    this.statBase.textContent = `Vida ${stats.base.maxHealth} · Ataque ${stats.base.attack}`
      + ` · Defesa ${stats.base.defense} · Essência ${stats.base.maxEssence}`
      + ` · Regeneração ${stats.base.essenceRegen.toFixed(1)}/s`;
    this.statEquipped.textContent = `+${stats.equipped.defense} defesa · `
      + `${stats.equipped.maxHealth >= 0 ? '+' : ''}${stats.equipped.maxHealth} vida · `
      + `${stats.equipped.essenceRegen >= 0 ? '+' : ''}${stats.equipped.essenceRegen.toFixed(1)} essência/s · `
      + `x${stats.equipped.movementMultiplier.toFixed(2)} velocidade`;
    const temporary = combat.activeEffects(now).map(effect =>
      `${effect.label} (${seconds(effect.remainingMs)})`);
    if (stats.temporary.barrier > 0) temporary.push(`Barreira ${stats.temporary.barrier}`);
    if (combat.empowerRemaining(now) > 0) temporary.push('Próxima ativação amplificada');
    this.statTemporary.textContent = temporary.length ? temporary.join(' · ') : 'Nenhum efeito temporário ativo.';
    this.statPermanent.textContent = `+${Math.round(stats.permanent.physicalDamageBonus * 100)}% dano físico · `
      + `+${Math.round(stats.permanent.meleeDamageBonus * 100)}% corpo a corpo · `
      + `${combat.assimilated.size} Gu assimilado(s)`;
  }

  private renderSea(): void {
    if (!this.combat) return;
    const { essence } = this.combat;
    const maximum = this.combat.cultivationMaxEssence;
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
    this.renderEquipment(true);
    this.renderStats();
    this.renderRecipes();
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
    for (const option of this.generatedOptions) option.remove();
    this.collection.replaceChildren();
    this.recipeList.replaceChildren();
    document.removeEventListener('keydown', this.onKeyDown);
  }
}
