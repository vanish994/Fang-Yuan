import { GU_CATALOG } from '../combat/guCatalog';
import { MAX_GU_STACK } from '../combat/guState';
import { buybackPrice, buyGu, sellMaterial, sellTotal, VENDOR_STOCK } from '../combat/vendor';
import { breakthroughMaterialLabel } from '../entities/cultivationBalance';
import type { CharacterCultivation } from '../entities/characterCultivation';
import type { CombatEngine } from '../combat/combatEngine';
import type { GuSlot } from '../combat/types';

const slotLabels: Record<GuSlot, string> = {
  attack: 'ataque', passive: 'passivo', movement: 'movimento', support: 'apoio',
};

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento da banca não encontrado: ${id}`);
  return element as T;
}

function create(tag: string, className = '', text = ''): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

/**
 * Banca do Jiang Ya: compra material de ruptura e vende poucas Gu Rank 1.
 * Toda a regra de preço/validação vem de `combat/vendor`; aqui só há DOM.
 */
export class VendorPanel {
  private readonly panel = requiredElement<HTMLElement>('vendor-panel');
  private readonly closeButton = requiredElement<HTMLButtonElement>('vendor-close');
  private readonly stones = requiredElement<HTMLElement>('vendor-stones');
  private readonly stock = requiredElement<HTMLElement>('vendor-stock');
  private readonly materials = requiredElement<HTMLElement>('vendor-materials');
  private readonly feedback = requiredElement<HTMLElement>('vendor-feedback');

  private readonly onClose = () => this.close();
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !this.panel.hidden) this.close();
  };

  constructor(
    private readonly cultivation: CharacterCultivation,
    private readonly combat: CombatEngine,
  ) {
    this.closeButton.addEventListener('click', this.onClose);
    document.addEventListener('keydown', this.onKeyDown);
  }

  get isOpen(): boolean { return !this.panel.hidden; }

  open(): void {
    this.feedback.textContent = '';
    this.feedback.className = 'vendor-feedback';
    this.render();
    this.panel.hidden = false;
    this.closeButton.focus();
  }

  close(): void { this.panel.hidden = true; }

  destroy(): void {
    this.closeButton.removeEventListener('click', this.onClose);
    document.removeEventListener('keydown', this.onKeyDown);
  }

  /** Nenhuma exceção de gravação pode escapar do toque: a banca sempre responde. */
  private trade(action: () => { ok: boolean; message: string }): void {
    try {
      const result = action();
      this.note(result.message, result.ok);
    } catch {
      this.note('Não foi possível concluir a troca; nada foi alterado.', false);
    }
    this.render();
  }

  private note(message: string, ok: boolean): void {
    this.feedback.textContent = message;
    this.feedback.className = `vendor-feedback ${ok ? 'is-ok' : 'is-error'}`;
  }

  /** Recria as listas a partir do estado atual; chamado ao abrir e após cada troca. */
  private render(): void {
    const state = this.cultivation.state;
    this.stones.textContent = `${state.spiritStones} pedras`;
    this.renderStock(state.spiritStones);
    this.renderMaterials(state.materials);
  }

  private renderStock(spiritStones: number): void {
    this.stock.replaceChildren();
    for (const offer of VENDOR_STOCK) {
      const gu = GU_CATALOG[offer.guId];
      const owned = this.combat.inventoryCount(offer.guId);
      const row = create('li', 'vendor-row');
      const name = create('span', 'vendor-name', `${gu.short} · ${gu.label}`);
      name.appendChild(create('small', 'vendor-meta',
        `${slotLabels[gu.slot]} · Rank ${gu.rank}`));
      const info = create('span', 'vendor-owned', `possui ${owned}`);
      const buy = create('button', 'vendor-action', `Comprar · ${offer.price}`) as HTMLButtonElement;
      buy.setAttribute('type', 'button');
      buy.disabled = owned >= MAX_GU_STACK || spiritStones < offer.price;
      buy.addEventListener('click', () => {
        this.trade(() => buyGu(this.cultivation, this.combat, offer.guId));
      });
      row.appendChild(name);
      row.appendChild(info);
      row.appendChild(buy);
      this.stock.appendChild(row);
    }
  }

  private renderMaterials(materials: Readonly<Record<string, number>>): void {
    this.materials.replaceChildren();
    const owned = Object.entries(materials).filter(([, quantity]) => quantity > 0);
    if (owned.length === 0) {
      this.materials.appendChild(create('li', 'vendor-empty',
        'Nenhum material de ruptura na bolsa. Ele cai das criaturas.'));
      return;
    }
    for (const [materialId, quantity] of owned.sort(([a], [b]) => a.localeCompare(b))) {
      const price = buybackPrice(materialId);
      const row = create('li', 'vendor-row');
      row.appendChild(create('span', 'vendor-name', breakthroughMaterialLabel(materialId)));
      if (!price) {
        row.appendChild(create('span', 'vendor-owned', 'não compro'));
        this.materials.appendChild(row);
        continue;
      }
      row.appendChild(create('span', 'vendor-owned',
        `${quantity} na bolsa · ${price.unitPrice} pedras cada`));
      row.appendChild(this.sellButton(materialId, 1, `Vender 1 · ${price.unitPrice}`));
      const total = sellTotal(materialId, quantity);
      if (quantity > 1 && total !== null) {
        row.appendChild(this.sellButton(materialId, quantity, `Vender tudo · ${total}`));
      }
      this.materials.appendChild(row);
    }
  }

  private sellButton(materialId: string, quantity: number, text: string): HTMLButtonElement {
    const button = create('button', 'vendor-action', text) as HTMLButtonElement;
    button.setAttribute('type', 'button');
    button.addEventListener('click', () => {
      this.trade(() => sellMaterial(this.cultivation, materialId, quantity));
    });
    return button;
  }
}
