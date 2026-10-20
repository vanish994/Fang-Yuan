import { breakthroughMaterialId, breakthroughMaterialLabel } from '../entities/cultivationBalance';
import { GU_CATALOG } from './guCatalog';
import { MAX_GU_STACK } from './guState';
import type { GuId } from './types';

/**
 * Banca do Jiang Ya: compra os materiais de ruptura que caem das criaturas e
 * vende poucas Gu Rank 1 simples. Preços são parâmetros de balanceamento do
 * protótipo, não valores canônicos da novel.
 */

export interface VendorOffer {
  guId: GuId;
  /** Pedras espirituais cobradas; hoje é o preço de referência do catálogo. */
  price: number;
}

/** Estoque curto e barato: uma opção por slot, sem assimiláveis nem consumíveis. */
const STOCK_IDS: readonly GuId[] = [
  'star-arrow', 'bone-spear', 'beast-skin', 'rock-skin', 'clear-wind-wheel', 'little-light',
];

const offerOf = (guId: GuId): VendorOffer => ({ guId, price: GU_CATALOG[guId].price });

export const VENDOR_STOCK: readonly VendorOffer[] = STOCK_IDS.map(offerOf);

export interface BuybackPrice {
  materialId: string;
  /** Pedras por unidade vendida ao NPC. */
  unitPrice: number;
}

/** Somente materiais de ruptura; o Rank define o valor unitário. */
const BUYBACK_PRICES: Readonly<Record<number, number>> = { 1: 8, 2: 24, 3: 70, 4: 200 };

export const VENDOR_BUYBACK: readonly BuybackPrice[] = Object.entries(BUYBACK_PRICES)
  .map(([rank, unitPrice]) => ({ materialId: breakthroughMaterialId(Number(rank)), unitPrice }));

export type TradeResult = { ok: true; message: string } | { ok: false; message: string };

/** Recorte do estado de cultivo necessário para negociar; facilita testar sem DOM. */
export interface VendorWallet {
  readonly state: {
    readonly spiritStones: number;
    readonly materials: Readonly<Record<string, number>>;
  };
  spendStones(amount: number): boolean;
  receiveStones(amount: number): void;
  tradeMaterial(materialId: string, quantity: number, stoneGain: number): boolean;
}

/** Recorte do inventário de Gu necessário para negociar. */
export interface VendorGuHolder {
  inventoryCount(id: GuId): number;
  grantGu(id: GuId): { ok: boolean; reason?: string };
}

export function vendorOffer(guId: string): VendorOffer | null {
  return VENDOR_STOCK.find(offer => offer.guId === guId) ?? null;
}

export function buybackPrice(materialId: string): BuybackPrice | null {
  return VENDOR_BUYBACK.find(price => price.materialId === materialId) ?? null;
}

export function sellTotal(materialId: string, quantity: number): number | null {
  const buyback = buybackPrice(materialId);
  if (!buyback || !Number.isSafeInteger(quantity) || quantity <= 0) return null;
  const total = buyback.unitPrice * quantity;
  return Number.isSafeInteger(total) ? total : null;
}

/**
 * Compra uma Gu do estoque. O pagamento é gravado primeiro; se o inventário não
 * aceitar a Gu, o valor é devolvido na mesma sessão. Uma falha de gravação nunca
 * entrega Gu de graça nem cobra sem entregar.
 */
export function buyGu(wallet: VendorWallet, holder: VendorGuHolder, guId: string): TradeResult {
  const offer = vendorOffer(guId);
  if (!offer) return { ok: false, message: 'Esta Gu não está na banca.' };
  if (holder.inventoryCount(offer.guId) >= MAX_GU_STACK) {
    return { ok: false, message: 'Inventário cheio para esta Gu.' };
  }
  const missing = offer.price - wallet.state.spiritStones;
  if (missing > 0) return { ok: false, message: `Faltam ${missing} pedras.` };
  if (!wallet.spendStones(offer.price)) {
    return { ok: false, message: 'Não foi possível pagar; nada foi alterado.' };
  }
  const granted = holder.grantGu(offer.guId);
  if (!granted.ok) {
    // Rollback: devolve o pagamento para não cobrar uma Gu que não entrou.
    try {
      wallet.receiveStones(offer.price);
    } catch {
      return { ok: false,
        message: 'Falha ao guardar a Gu e ao devolver as pedras; recarregue a página.' };
    }
    return { ok: false, message: granted.reason ?? 'Não foi possível guardar a Gu; pedras devolvidas.' };
  }
  return { ok: true, message: `${GU_CATALOG[offer.guId].short} comprada por ${offer.price} pedras.` };
}

/**
 * Vende material de ruptura para a banca. Consumir o material e receber as
 * pedras acontece numa única gravação; qualquer falha deixa tudo como estava.
 */
export function sellMaterial(wallet: VendorWallet, materialId: string, quantity: number): TradeResult {
  const price = buybackPrice(materialId);
  if (!price) return { ok: false, message: 'Jiang Ya não compra este material.' };
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    return { ok: false, message: 'Quantidade inválida.' };
  }
  const owned = wallet.state.materials[materialId] ?? 0;
  if (owned < quantity) return { ok: false, message: `Você só tem ${owned}.` };
  const total = sellTotal(materialId, quantity);
  if (total === null) return { ok: false, message: 'Valor inválido.' };
  if (!wallet.tradeMaterial(materialId, quantity, total)) {
    return { ok: false, message: 'Não foi possível vender; nada foi alterado.' };
  }
  return {
    ok: true,
    message: `${quantity}× ${breakthroughMaterialLabel(materialId)} vendido por ${total} pedras.`,
  };
}
