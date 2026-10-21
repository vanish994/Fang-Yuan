import { PLAYER_CHARACTERS, PLAYER_CHARACTER_IDS, playerCharacter,
  type PlayerCharacterId, type PlayerCharacterProfile } from '../combat/characterCatalog';

/**
 * Escolha do personagem jogável.
 *
 * Um único botão no topo mostra quem está em campo e abre os cartões. Trocar de
 * personagem não cria outro motor nem outro inventário: o `onSelect` avisa o
 * `main.ts`, que só pede ao motor para vestir o novo perfil.
 */
export class CharacterSelect {
  readonly root: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly cards = new Map<PlayerCharacterId, HTMLButtonElement>();
  private readonly title: HTMLElement;
  private current: PlayerCharacterId;

  constructor(initial: PlayerCharacterId,
    private readonly onSelect: (id: PlayerCharacterId) => void) {
    this.current = playerCharacter(initial).id;
    const toggle = document.querySelector<HTMLButtonElement>('#character-switch');
    if (!toggle) throw new Error('Botão de troca de personagem não encontrado.');
    this.toggle = toggle;
    const root = document.querySelector<HTMLElement>('#character-select');
    if (!root) throw new Error('Painel de seleção de personagem não encontrado.');
    this.root = root;
    this.title = root.querySelector('#character-select-title')!;
    const list = root.querySelector('.character-options')!;
    for (const id of PLAYER_CHARACTER_IDS) {
      const profile = PLAYER_CHARACTERS[id];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'character-option';
      card.dataset.character = profile.id;
      card.setAttribute('aria-pressed', String(id === this.current));
      card.innerHTML = `<span class="character-portrait" data-character="${profile.id}" aria-hidden="true"></span>
        <strong>${profile.name}</strong><small>${profile.title}</small>
        <span class="character-description">${profile.description}</span>
        <span class="character-stats">${describeCombat(profile)}</span>`;
      // pointerdown evita que o toque no cartão vire caminhada no mapa (como no HUD).
      card.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
      });
      card.addEventListener('click', event => {
        event.stopPropagation();
        this.pick(profile.id);
      });
      list.append(card);
      this.cards.set(id, card);
    }
    this.toggle.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
    });
    this.toggle.addEventListener('click', event => {
      event.stopPropagation();
      this.setOpen(this.root.hidden);
    });
    root.querySelector('#character-select-close')?.addEventListener('click', event => {
      event.stopPropagation();
      this.setOpen(false);
    });
    // O mapa escuta o mesmo evento; clicar fora do painel fecha sem andar.
    document.addEventListener('pointerdown', event => {
      if (this.root.hidden) return;
      const target = event.target as Node | null;
      if (target && (this.root.contains(target) || this.toggle.contains(target))) return;
      this.setOpen(false);
    });
    this.refresh();
  }

  get selected(): PlayerCharacterId { return this.current; }

  /** Abre/fecha o painel; o botão do topo continua visível. */
  setOpen(open: boolean): void {
    this.root.hidden = !open;
    this.toggle.setAttribute('aria-expanded', String(open));
  }

  /** Aplica a escolha. Trocar para o mesmo personagem só fecha o painel. */
  pick(id: PlayerCharacterId): boolean {
    const changed = id !== this.current;
    this.current = id;
    this.refresh();
    this.setOpen(false);
    if (changed) this.onSelect(id);
    return changed;
  }

  /** Mantém botão e cartões em sincronia (inclusive quando o motor recusa a troca). */
  refresh(): void {
    const profile = playerCharacter(this.current);
    this.title.textContent = profile.name;
    this.toggle.textContent = profile.name;
    this.toggle.setAttribute('aria-label', `Personagem atual: ${profile.name}. Trocar de personagem`);
    for (const [id, card] of this.cards) {
      card.setAttribute('aria-pressed', String(id === this.current));
      card.classList.toggle('is-active', id === this.current);
    }
  }

  destroy(): void {
    this.root.hidden = true;
  }
}

/** Linha curta de números para o cartão: sem prometer nada que o motor não faça. */
export function describeCombat(profile: PlayerCharacterProfile): string {
  const health = `${Math.round(profile.combat.maxHealthMultiplier * 100)}% vida`;
  const speed = `${Math.round(profile.combat.speedMultiplier * 100)}% passo`;
  const basic = profile.kind === 'melee'
    ? `básico curto (${profile.basic.range}px)`
    : `básico à distância (${profile.basic.range}px)`;
  return `${basic} · ${health} · ${speed}`;
}
