
import { ControlType } from '../types';

/**
 * 入力ハンドラー
 * キーボード（A/D、矢印キー）、タッチ入力（左右ボタン、水平スワイプ）
 * BR-V01: 入力バリデーション
 * Unit-02: 操作タイプ切替（BR-IN01〜04）
 */
export class InputHandler {
  private moveDirection: number = 0;
  private leftPressed: boolean = false;
  private rightPressed: boolean = false;
  private isMobile: boolean = false;
  private canvas: HTMLCanvasElement;
  private firstInteractionFired: boolean = false;
  private firstInteractionCallback: (() => void) | null = null;

  // タッチ状態
  private touchStartX: number = 0;
  private touchActive: boolean = false;
  private swipeDirection: number = 0;
  private buttonTouchIds: Map<string, number> = new Map(); // 'left'|'right' → touchId

  // 操作タイプ（Unit-02: BR-IN01〜04）
  private controlType: ControlType = ControlType.BOTH;
  private buttonsEnabled: boolean = true;
  private swipeEnabled: boolean = true;

  // スケーリング情報（物理→論理座標変換用）
  private scale: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;

  // イベントリスナー解除用AbortController
  private abortController: AbortController = new AbortController();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.isMobile = 'ontouchstart' in window;
    this.setupKeyboardListeners();
    if (this.isMobile) {
      this.setupTouchListeners();
    }
  }

  /** スケーリング情報を更新（RenderSystemから呼ばれる） */
  updateScaling(scale: number, offsetX: number, offsetY: number): void {
    this.scale = scale;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  /** 現在の移動方向を取得（-1, 0, +1） */
  getMoveDirection(): number {
    return this.validateInput(this.moveDirection);
  }

  isMobileDevice(): boolean {
    return this.isMobile;
  }

  private setupKeyboardListeners(): void {
    const signal = this.abortController.signal;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      this.fireFirstInteraction();
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.leftPressed = true;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.rightPressed = true;
          break;
      }
      this.updateDirection();
    }, { signal });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.leftPressed = false;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.rightPressed = false;
          break;
      }
      this.updateDirection();
    }, { signal });
  }

  private setupTouchListeners(): void {
    const signal = this.abortController.signal;

    this.canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      this.fireFirstInteraction();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const logical = this.toLogicalCoords(touch.clientX, touch.clientY);

        // 左右ボタン判定（BR-IN01〜03: 操作タイプに応じてフィルタ）
        if (this.buttonsEnabled && this.isLeftButton(logical.x, logical.y)) {
          this.buttonTouchIds.set('left', touch.identifier);
          this.leftPressed = true;
        } else if (this.buttonsEnabled && this.isRightButton(logical.x, logical.y)) {
          this.buttonTouchIds.set('right', touch.identifier);
          this.rightPressed = true;
        } else if (this.swipeEnabled && logical.y > 640) {
          // 画面下半分でスワイプ開始
          this.touchStartX = touch.clientX;
          this.touchActive = true;
        }
      }
      this.updateDirection();
    }, { passive: false, signal });

    this.canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      if (!this.touchActive) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        // ボタンタッチはスワイプ対象外
        if (this.buttonTouchIds.get('left') === touch.identifier) continue;
        if (this.buttonTouchIds.get('right') === touch.identifier) continue;

        const deltaX = touch.clientX - this.touchStartX;
        // スワイプ閾値: 10px
        if (Math.abs(deltaX) > 10) {
          this.swipeDirection = deltaX > 0 ? 1 : -1;
        } else {
          this.swipeDirection = 0;
        }
      }
      this.updateDirection();
    }, { passive: false, signal });

    this.canvas.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (this.buttonTouchIds.get('left') === touch.identifier) {
          this.buttonTouchIds.delete('left');
          this.leftPressed = false;
        }
        if (this.buttonTouchIds.get('right') === touch.identifier) {
          this.buttonTouchIds.delete('right');
          this.rightPressed = false;
        }
      }
      // 全タッチ終了時にスワイプリセット
      if (e.touches.length === 0) {
        this.touchActive = false;
        this.swipeDirection = 0;
      }
      this.updateDirection();
    }, { passive: false, signal });
  }

  private updateDirection(): void {
    if (this.leftPressed && !this.rightPressed) {
      this.moveDirection = -1;
    } else if (this.rightPressed && !this.leftPressed) {
      this.moveDirection = 1;
    } else if (this.swipeDirection !== 0) {
      this.moveDirection = this.swipeDirection;
    } else {
      this.moveDirection = 0;
    }
  }

  /** 入力バリデーション（BR-V01） */
  private validateInput(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return -1;
    if (value > 0) return 1;
    return 0;
  }

  /** 物理座標 → 論理座標変換（business-logic-model 14.3） */
  private toLogicalCoords(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const physX = clientX - rect.left;
    const physY = clientY - rect.top;
    return {
      x: (physX - this.offsetX) / this.scale,
      y: (physY - this.offsetY) / this.scale,
    };
  }

  /** 左移動ボタン判定（business-logic-model 15.8） */
  private isLeftButton(logicalX: number, logicalY: number): boolean {
    // 位置: (32, 1180), タッチ領域: 96×96px
    return logicalX >= -16 && logicalX <= 128 && logicalY >= 1132 && logicalY <= 1276;
  }

  /** 右移動ボタン判定 */
  private isRightButton(logicalX: number, logicalY: number): boolean {
    // 位置: (608, 1180), タッチ領域: 96×96px
    return logicalX >= 560 && logicalX <= 704 && logicalY >= 1132 && logicalY <= 1276;
  }

  /** 操作タイプ設定（Unit-02: BR-IN01〜04） */
  setControlType(type: ControlType): void {
    this.controlType = type;
    if (type === ControlType.BUTTONS) {
      this.buttonsEnabled = true;
      this.swipeEnabled = false;
    } else if (type === ControlType.SWIPE) {
      this.buttonsEnabled = false;
      this.swipeEnabled = true;
    } else {
      this.buttonsEnabled = true;
      this.swipeEnabled = true;
    }
  }

  /** ボタン表示が有効か（描画側参照用） */
  isButtonsEnabled(): boolean {
    return this.buttonsEnabled;
  }

  /** スケーリング情報を取得（SettingsScreen座標変換用） */
  getScaling(): { scale: number; offsetX: number; offsetY: number } {
    return { scale: this.scale, offsetX: this.offsetX, offsetY: this.offsetY };
  }

  /** 論理座標でのタップ位置を取得（UI操作用） */
  getLastTapPosition(): { x: number; y: number } | null {
    return this._lastTapPos;
  }

  /** タップ位置を取得し即座にクリア（多重検出防止、BLM §7.2.1） */
  consumeLastTapPosition(): { x: number; y: number } | null {
    const pos = this._lastTapPos;
    this._lastTapPos = null;
    return pos;
  }

  private _lastTapPos: { x: number; y: number } | null = null;

  /** 初回インタラクションコールバック登録（BR-AU01） */
  onFirstInteraction(callback: () => void): void {
    this.firstInteractionCallback = callback;
  }

  private fireFirstInteraction(): void {
    if (this.firstInteractionFired || !this.firstInteractionCallback) return;
    this.firstInteractionFired = true;
    this.firstInteractionCallback();
  }

  /** UIタップリスナーを有効化（LEVEL_UP, GAME_OVER画面用） */
  enableUITapListener(): void {
    const handler = (e: TouchEvent | MouseEvent) => {
      this.fireFirstInteraction();
      let clientX: number, clientY: number;
      if ('touches' in e) {
        if (e.changedTouches.length === 0) return;
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      this._lastTapPos = this.toLogicalCoords(clientX, clientY);
    };

    this.canvas.addEventListener('click', handler as EventListener);
    this.canvas.addEventListener('touchend', handler as EventListener, { passive: false });
    this._uiHandler = handler as EventListener;
  }

  /** UIタップリスナーを無効化 */
  disableUITapListener(): void {
    if (this._uiHandler) {
      this.canvas.removeEventListener('click', this._uiHandler);
      this.canvas.removeEventListener('touchend', this._uiHandler);
      this._uiHandler = null;
    }
    this._lastTapPos = null;
  }

  private _uiHandler: EventListener | null = null;

  /** 全イベントリスナーを解除してリソースを解放 */
  destroy(): void {
    this.abortController.abort();
    this.disableUITapListener();
    this.reset();
  }

  /** リセット */
  reset(): void {
    this.moveDirection = 0;
    this.leftPressed = false;
    this.rightPressed = false;
    this.swipeDirection = 0;
    this.touchActive = false;
    this._lastTapPos = null;
  }
}
