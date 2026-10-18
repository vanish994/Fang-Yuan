import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '../config/gameConfig';
import type { MoveVector } from '../entities/Player';

/** Raio da base do joystick (px no espaço do jogo). */
const BASE_RADIUS = 90;
/** Raio do knob, a bolinha que o polegar arrasta. */
const KNOB_RADIUS = 40;
/** Fração do raio ignorada no centro, para o personagem não tremer com o polegar parado. */
const DEAD_ZONE = 0.15;

/**
 * Joystick analógico virtual "flutuante": o toque no lado esquerdo da tela cria a base
 * no ponto do toque. Arrastar move o knob e o vetor de saída (x, y em [-1, 1]).
 *
 * Só é criado em dispositivos com toque (ver GameScene). Usa o id do ponteiro,
 * então outro dedo na tela (por exemplo, um futuro botão de ação) não interfere.
 */
export class VirtualJoystick {
  private readonly scene: Phaser.Scene;
  private readonly baseGfx: Phaser.GameObjects.Graphics;
  private readonly knobGfx: Phaser.GameObjects.Graphics;
  private readonly center = new Phaser.Math.Vector2();
  private pointerId: number | null = null;
  private output: MoveVector = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.baseGfx = scene.add.graphics().setScrollFactor(0).setDepth(200);
    this.knobGfx = scene.add.graphics().setScrollFactor(0).setDepth(201);

    scene.input.on('pointerdown', this.handlePointerDown, this);
    scene.input.on('pointermove', this.handlePointerMove, this);
    scene.input.on('pointerup', this.handlePointerUp, this);
    scene.input.on('pointerupoutside', this.handlePointerUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);

    this.hide();
  }

  /** Vetor atual do joystick. (0, 0) quando não há toque ativo. */
  get vector(): MoveVector {
    return this.output;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerup', this.handlePointerUp, this);
    this.scene.input.off('pointerupoutside', this.handlePointerUp, this);
    this.baseGfx.destroy();
    this.knobGfx.destroy();
    this.pointerId = null;
    this.output = { x: 0, y: 0 };
  }

  private handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    // Um joystick por vez, e só no lado esquerdo (o direito fica livre para ações).
    if (this.pointerId !== null || pointer.x > GAME_WIDTH / 2) return;

    this.pointerId = pointer.id;
    this.center.set(pointer.x, pointer.y);
    this.updateFromPointer(pointer);
    this.baseGfx.setVisible(true);
    this.knobGfx.setVisible(true);
  };

  private handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id !== this.pointerId) return;
    this.updateFromPointer(pointer);
  };

  private handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id !== this.pointerId) return;
    this.pointerId = null;
    this.output = { x: 0, y: 0 };
    this.hide();
  };

  private updateFromPointer(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.center.x;
    const dy = pointer.y - this.center.y;
    const distance = Math.hypot(dx, dy);

    // Direção unitária (ou zero, se o polegar está exatamente no centro).
    const ux = distance > 0 ? dx / distance : 0;
    const uy = distance > 0 ? dy / distance : 0;

    // Magnitude normalizada em [0, 1], com dead zone e reescala para não "pular" ao sair dela.
    const ratio = Math.min(distance / BASE_RADIUS, 1);
    const magnitude = ratio < DEAD_ZONE ? 0 : (ratio - DEAD_ZONE) / (1 - DEAD_ZONE);
    this.output = { x: ux * magnitude, y: uy * magnitude };

    // Knob é limitado ao raio da base.
    const knobDistance = Math.min(distance, BASE_RADIUS);
    this.drawKnob(this.center.x + ux * knobDistance, this.center.y + uy * knobDistance);
    this.drawBase();
  }

  private drawBase(): void {
    this.baseGfx.clear();
    this.baseGfx.fillStyle(0x000000, 0.3);
    this.baseGfx.fillCircle(this.center.x, this.center.y, BASE_RADIUS);
    this.baseGfx.lineStyle(3, 0xffffff, 0.35);
    this.baseGfx.strokeCircle(this.center.x, this.center.y, BASE_RADIUS);
  }

  private drawKnob(x: number, y: number): void {
    this.knobGfx.clear();
    this.knobGfx.fillStyle(COLORS.accent, 0.6);
    this.knobGfx.fillCircle(x, y, KNOB_RADIUS);
  }

  private hide(): void {
    this.baseGfx.setVisible(false);
    this.knobGfx.setVisible(false);
  }
}
