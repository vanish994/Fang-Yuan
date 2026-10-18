import Phaser from 'phaser';

export interface ActionButtonConfig {
  x: number;
  y: number;
  radius: number;
  label: string;
  color: number;
  /** Chamado quando o botão é pressionado (toque dentro do círculo). */
  onPress: () => void;
}

/** Tolerância extra (px) ao redor do círculo para facilitar o toque com o polegar. */
const HIT_PADDING = 12;

/**
 * Botão redondo de ação fixo na tela. Responde ao toque dentro do círculo e aceita um
 * cooldown visual (setor escuro que diminui conforme o tempo passa).
 *
 * Cada ponteiro é avaliado separadamente, então dois botões podem ser apertados ao mesmo tempo.
 */
export class ActionButton {
  private readonly scene: Phaser.Scene;
  private readonly config: ActionButtonConfig;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private pressed = false;
  private cooldown = 0;

  constructor(scene: Phaser.Scene, config: ActionButtonConfig) {
    this.scene = scene;
    this.config = config;

    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(200);
    this.text = scene.add
      .text(config.x, config.y, config.label, {
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
        fontSize: `${Math.round(config.radius * 0.42)}px`,
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);

    scene.input.on('pointerdown', this.handlePointerDown, this);
    scene.input.on('pointerup', this.handlePointerUp, this);
    scene.input.on('pointerupoutside', this.handlePointerUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);

    this.draw();
  }

  /** Reposiciona o botão quando o tamanho da tela muda. */
  setPosition(x: number, y: number): void {
    this.config.x = x;
    this.config.y = y;
    this.text.setPosition(x, y);
    this.draw();
  }

  /** Atualiza o cooldown visual. 0 = pronto, 1 = recém usado. */
  setCooldown(fraction: number): void {
    const clamped = Math.min(1, Math.max(0, fraction));
    if (clamped === this.cooldown) return;
    this.cooldown = clamped;
    this.draw();
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('pointerup', this.handlePointerUp, this);
    this.scene.input.off('pointerupoutside', this.handlePointerUp, this);
    this.gfx.destroy();
    this.text.destroy();
  }

  private containsPoint(x: number, y: number): boolean {
    const dx = x - this.config.x;
    const dy = y - this.config.y;
    const reach = this.config.radius + HIT_PADDING;
    return dx * dx + dy * dy <= reach * reach;
  }

  private handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!this.containsPoint(pointer.x, pointer.y)) return;
    this.pressed = true;
    this.draw();
    this.config.onPress();
  };

  private handlePointerUp = (): void => {
    if (!this.pressed) return;
    this.pressed = false;
    this.draw();
  };

  private draw(): void {
    const { x, y, radius, color } = this.config;
    this.gfx.clear();

    // Corpo do botão. Fica mais escuro enquanto pressionado.
    this.gfx.fillStyle(color, this.pressed ? 0.85 : 0.5);
    this.gfx.fillCircle(x, y, radius);
    this.gfx.lineStyle(4, 0xffffff, this.pressed ? 0.9 : 0.5);
    this.gfx.strokeCircle(x, y, radius);

    // Cooldown: setor escuro que começa no topo e cobre a fração que ainda falta.
    if (this.cooldown > 0) {
      const start = -Math.PI / 2;
      const end = start + Math.PI * 2 * this.cooldown;
      this.gfx.fillStyle(0x000000, 0.6);
      this.gfx.slice(x, y, radius, start, end, false);
      this.gfx.fillPath();
    }
  }
}
