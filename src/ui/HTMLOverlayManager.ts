import { PerspectiveCamera, Vector3 } from 'three';
import { HitCountComponent } from '../components/HitCountComponent';
import { MeshComponent } from '../components/MeshComponent';
import { PositionComponent } from '../components/PositionComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { CoordinateMapper } from '../utils/CoordinateMapper';
import type { World } from '../ecs/World';
import type { HUDState, ScoreData, BuffState } from '../types';
import { BuffType } from '../types';
import { WorldToScreenLabel } from './WorldToScreenLabel';
import { ActiveBuffIcon, type ActiveBuffView } from './ActiveBuffIcon';
import { WeaponHudPanel } from './WeaponHudPanel';
import { ToastQueue } from './ToastQueue';

/** DOMプール要素 */
interface PooledElement {
  element: HTMLDivElement;
  inUse: boolean;
}

const THROTTLE_INTERVAL = 1 / 30;
const BUFF_DISPLAY_ORDER: BuffType[] = [
  BuffType.ATTACK_UP,
  BuffType.FIRE_RATE_UP,
  BuffType.SPEED_UP,
  BuffType.BARRAGE,
];

/**
 * Iter6 Phase 5: HTMLオーバーレイ Facade。
 *
 * サブクラス (WorldToScreenLabel / ActiveBuffIcon / WeaponHudPanel / ToastQueue) を内包し、
 * 30Hz ドレイン型スロットリングでワールド→スクリーン系を更新する。
 * 既存 HUD (HP / Timer / Kills / Wave / Allies) と画面系 (title / gameover / fallback / mobile)
 * は本体で保持。XSS 対策として textContent のみ使用する (NFR-05 / F-NG-1)。
 */
export class HTMLOverlayManager {
  private container: HTMLElement;

  // HUD要素
  private hudContainer: HTMLDivElement | null = null;
  private hpBarFill: HTMLDivElement | null = null;
  private hpText: HTMLSpanElement | null = null;
  private timerText: HTMLSpanElement | null = null;
  private killText: HTMLSpanElement | null = null;
  private waveText: HTMLSpanElement | null = null;
  private allyText: HTMLSpanElement | null = null;

  // サブクラス (Iter6 Phase 5)
  private _worldToScreenLabel: WorldToScreenLabel | null = null;
  private _activeBuffIcon: ActiveBuffIcon | null = null;
  private _weaponHudPanel: WeaponHudPanel | null = null;
  private _toastQueue: ToastQueue | null = null;

  // 30Hz ドレイン用アキュムレータ
  private throttleAcc: number = 0;

  // タイトル/ゲームオーバー
  private titleContainer: HTMLDivElement | null = null;
  private gameOverContainer: HTMLDivElement | null = null;
  private fallbackContainer: HTMLDivElement | null = null;

  // HP表示（敵頭上）
  private hpLabels = new Map<number, HTMLDivElement>();

  // ダメージ数値DOMプール（BR-UI03）
  private damagePool: PooledElement[] = [];
  private readonly MAX_DAMAGE_POOL = 20;

  // モバイル操作ボタン
  private mobileControls: HTMLDivElement | null = null;

  // コールバック
  private onStartClick: (() => void) | null = null;
  private onRetryClick: (() => void) | null = null;
  private onSettingsClick: (() => void) | null = null;
  private onLeftDown: (() => void) | null = null;
  private onRightDown: (() => void) | null = null;
  private onMoveUp: (() => void) | null = null;

  /** 再利用用ベクトル */
  private readonly _tempVec = new Vector3();

  constructor(container: HTMLElement) {
    this.container = container;
    this.initDamagePool();
  }

  // ================================================================
  // HUD (Facade: 基本HUD + サブクラス初期化)
  // ================================================================

  /** HUD初期化 */
  initHUD(): void {
    this.hudContainer = document.createElement('div');
    this.hudContainer.className = 'hud-container';

    // HPバー
    const hpBar = document.createElement('div');
    hpBar.className = 'hud-hp-bar';
    this.hpBarFill = document.createElement('div');
    this.hpBarFill.className = 'hud-hp-fill';
    hpBar.appendChild(this.hpBarFill);
    this.hpText = document.createElement('span');
    this.hpText.className = 'hud-hp-text';
    hpBar.appendChild(this.hpText);
    this.hudContainer.appendChild(hpBar);

    // バフコンテナ (C6-09 ActiveBuffIcon に委譲)
    this._activeBuffIcon = new ActiveBuffIcon(this.hudContainer);

    // 右上情報
    const rightInfo = document.createElement('div');
    rightInfo.className = 'hud-right-info';

    this.timerText = document.createElement('span');
    this.timerText.className = 'hud-timer';
    rightInfo.appendChild(this.timerText);

    this.killText = document.createElement('span');
    this.killText.className = 'hud-kills';
    rightInfo.appendChild(this.killText);

    this.waveText = document.createElement('span');
    this.waveText.className = 'hud-wave';
    rightInfo.appendChild(this.waveText);

    this.allyText = document.createElement('span');
    this.allyText.className = 'hud-ally';
    rightInfo.appendChild(this.allyText);

    this.hudContainer.appendChild(rightInfo);

    // 武器インジケータ (C6-10 WeaponHudPanel に委譲)
    this._weaponHudPanel = new WeaponHudPanel(this.hudContainer);

    // トースト (C6-14 ToastQueue)
    this._toastQueue = new ToastQueue(this.hudContainer);

    this.container.appendChild(this.hudContainer);

    // ワールド→スクリーンラベル (C6-08, container 直下で position:absolute)
    this._worldToScreenLabel = new WorldToScreenLabel(this.container);
  }

  get worldToScreenLabel(): WorldToScreenLabel {
    if (!this._worldToScreenLabel) {
      throw new Error('HTMLOverlayManager: initHUD() must be called before accessing worldToScreenLabel');
    }
    return this._worldToScreenLabel;
  }

  get activeBuffIcon(): ActiveBuffIcon {
    if (!this._activeBuffIcon) {
      throw new Error('HTMLOverlayManager: initHUD() must be called before accessing activeBuffIcon');
    }
    return this._activeBuffIcon;
  }

  get weaponHudPanel(): WeaponHudPanel {
    if (!this._weaponHudPanel) {
      throw new Error('HTMLOverlayManager: initHUD() must be called before accessing weaponHudPanel');
    }
    return this._weaponHudPanel;
  }

  get toastQueue(): ToastQueue {
    if (!this._toastQueue) {
      throw new Error('HTMLOverlayManager: initHUD() must be called before accessing toastQueue');
    }
    return this._toastQueue;
  }

  /** HUD更新（BR-UI04: 毎フレーム） */
  updateHUD(state: HUDState): void {
    if (!this.hudContainer) return;

    // HPバー
    const ratio = Math.max(0, state.hp / state.maxHp);
    if (this.hpBarFill) {
      this.hpBarFill.style.width = `${ratio * 100}%`;
      if (ratio > 0.5) this.hpBarFill.style.backgroundColor = '#00FF00';
      else if (ratio > 0.25) this.hpBarFill.style.backgroundColor = '#FFFF00';
      else this.hpBarFill.style.backgroundColor = '#FF0000';
    }
    if (this.hpText) {
      this.hpText.textContent = `${Math.ceil(state.hp)}/${state.maxHp}`;
    }

    // タイマー
    if (this.timerText) {
      const minutes = Math.floor(state.elapsedTime / 60);
      const seconds = Math.floor(state.elapsedTime % 60);
      this.timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // 撃破数
    if (this.killText) {
      this.killText.textContent = `${state.killCount} kills`;
    }

    // ウェーブ
    if (this.waveText) {
      this.waveText.textContent = `Wave ${state.wave}`;
    }

    // 仲間数
    if (this.allyText) {
      this.allyText.textContent = `Allies: ${state.allyCount}/${state.maxAllies}`;
    }

    // 武器 (WeaponHudPanel 委譲、同じ genre なら flash 再発火しない)
    this._weaponHudPanel?.setGenre(state.weaponGenre);

    // バフ (ActiveBuffIcon 委譲)
    this._activeBuffIcon?.setBuffs(this.projectBuffs(state.activeBuffs));
  }

  private projectBuffs(active: Map<BuffType, BuffState>): ActiveBuffView[] {
    const views: ActiveBuffView[] = [];
    for (const type of BUFF_DISPLAY_ORDER) {
      const s = active.get(type);
      if (s) views.push({ type, remaining: s.remainingTime });
    }
    return views;
  }

  /**
   * Iter6 Phase 5: 30Hz ドレイン型スケジューリング。
   * ThreeJSRenderSystem から毎フレーム呼ばれる。
   * - 30Hz: worldToScreenLabel.update, 敵 HP ラベル updatePositions
   * - 毎フレーム: toastQueue.tick, weaponHudPanel.updateFlash
   */
  updateScheduled(world: World, camera: PerspectiveCamera, dt: number): void {
    this._toastQueue?.tick(dt);
    this._weaponHudPanel?.updateFlash(dt);

    this.throttleAcc += dt;
    if (this.throttleAcc >= THROTTLE_INTERVAL) {
      // 1フレームに複数回ドレインしない (大 dt spike で連続呼出しを避ける)
      this.throttleAcc = Math.min(this.throttleAcc - THROTTLE_INTERVAL, THROTTLE_INTERVAL);
      this._worldToScreenLabel?.update(null, camera);
      this.updatePositions(world, camera);
    }
  }

  showHUD(): void {
    if (this.hudContainer) this.hudContainer.style.display = '';
  }

  hideHUD(): void {
    if (this.hudContainer) this.hudContainer.style.display = 'none';
  }

  // ================================================================
  // 敵HP表示（BR-UI02）— 個数上限なし、barrels/gates は WorldToScreenLabel が担当
  // ================================================================

  /** 敵ヒットカウント表示位置を3D→スクリーン座標に投影 (30Hz ドレインで呼ばれる) */
  updatePositions(world: World, camera: PerspectiveCamera): void {
    const entities = world.query(HitCountComponent, PositionComponent, EnemyComponent);
    const canvasWidth = this.container.clientWidth;
    const canvasHeight = this.container.clientHeight;

    const activeIds = new Set<number>();

    for (const entityId of entities) {
      const pos = world.getComponent(entityId, PositionComponent);
      const hitCount = world.getComponent(entityId, HitCountComponent);
      const meshComp = world.getComponent(entityId, MeshComponent);
      if (!pos || !hitCount) continue;

      activeIds.add(entityId);

      // 3Dワールド座標（CoordinateMapper経由でX反転込み）
      const spriteType = meshComp?.spriteType ?? 'enemy_normal';
      const height = CoordinateMapper.getEntityHeight(spriteType) + 0.5;
      const worldVec = CoordinateMapper.toWorld(pos.x, pos.y);
      this._tempVec.set(worldVec.x, height, worldVec.z);

      // スクリーン座標に投影
      const screenPos = this._tempVec.clone().project(camera);
      const pixelX = (screenPos.x * 0.5 + 0.5) * canvasWidth;
      const pixelY = (-screenPos.y * 0.5 + 0.5) * canvasHeight;

      // DOM要素を取得or作成
      let label = this.hpLabels.get(entityId);
      if (!label) {
        label = document.createElement('div');
        label.className = 'hp-label';
        this.container.appendChild(label);
        this.hpLabels.set(entityId, label);
      }

      label.textContent = `${hitCount.currentHits}`;
      label.style.transform = `translate(${pixelX}px, ${pixelY}px)`;

      // 画面外なら非表示
      if (screenPos.z > 1 || pixelX < -50 || pixelX > canvasWidth + 50 || pixelY < -50 || pixelY > canvasHeight + 50) {
        label.style.display = 'none';
      } else {
        label.style.display = '';
      }
    }

    // 不要なラベルを除去
    for (const [entityId, label] of this.hpLabels) {
      if (!activeIds.has(entityId)) {
        label.remove();
        this.hpLabels.delete(entityId);
      }
    }
  }

  /** HP表示全クリア */
  clearHPLabels(): void {
    for (const label of this.hpLabels.values()) {
      label.remove();
    }
    this.hpLabels.clear();
    this._worldToScreenLabel?.resetAll();
    this._toastQueue?.reset();
    this._activeBuffIcon?.reset();
  }

  // ================================================================
  // ダメージ数値フロートアップ（BR-UI03）
  // ================================================================

  private initDamagePool(): void {
    for (let i = 0; i < this.MAX_DAMAGE_POOL; i++) {
      const el = document.createElement('div');
      el.className = 'damage-float';
      el.style.display = 'none';
      this.damagePool.push({ element: el, inUse: false });
    }
  }

  /** ダメージ数値表示 */
  showDamageNumber(screenX: number, screenY: number, damage: number): void {
    const pooled = this.damagePool.find(p => !p.inUse);
    if (!pooled) return;

    pooled.inUse = true;
    pooled.element.textContent = damage.toString();
    pooled.element.style.left = `${screenX}px`;
    pooled.element.style.top = `${screenY}px`;
    pooled.element.style.display = '';

    // コンテナに追加（まだ追加されていなければ）
    if (!pooled.element.parentElement) {
      this.container.appendChild(pooled.element);
    }

    // CSSアニメーションをリトリガー
    pooled.element.classList.remove('damage-float-anim');
    void pooled.element.offsetWidth; // reflow強制
    pooled.element.classList.add('damage-float-anim');

    const onEnd = (): void => {
      pooled.element.removeEventListener('animationend', onEnd);
      pooled.element.style.display = 'none';
      pooled.inUse = false;
    };
    pooled.element.addEventListener('animationend', onEnd);
  }

  // ================================================================
  // タイトル画面
  // ================================================================

  showTitle(onStart: () => void, onSettings: () => void): void {
    this.onStartClick = onStart;
    this.onSettingsClick = onSettings;

    if (!this.titleContainer) {
      this.titleContainer = document.createElement('div');
      this.titleContainer.className = 'title-screen';

      const title = document.createElement('h1');
      title.className = 'title-text';
      title.textContent = 'FV DEFENSE';
      this.titleContainer.appendChild(title);

      const subtitle = document.createElement('p');
      subtitle.className = 'title-subtitle';
      subtitle.textContent = '- Shoot them all! -';
      this.titleContainer.appendChild(subtitle);

      const startBtn = document.createElement('button');
      startBtn.className = 'title-btn title-btn-start';
      startBtn.textContent = 'START';
      startBtn.addEventListener('click', () => this.onStartClick?.());
      this.titleContainer.appendChild(startBtn);

      const settingsBtn = document.createElement('button');
      settingsBtn.className = 'title-btn title-btn-settings';
      settingsBtn.textContent = 'SETTINGS';
      settingsBtn.addEventListener('click', () => this.onSettingsClick?.());
      this.titleContainer.appendChild(settingsBtn);

      const controls = document.createElement('p');
      controls.className = 'title-controls';
      controls.textContent = 'PC: \u2190 \u2192 or A/D | Mobile: Tap or Swipe';
      this.titleContainer.appendChild(controls);

      this.container.appendChild(this.titleContainer);
    }

    this.titleContainer.style.display = 'flex';
  }

  hideTitle(): void {
    if (this.titleContainer) this.titleContainer.style.display = 'none';
  }

  /** Iter5: タイトル画面の mini-renderer 埋め込み用コンテナ取得（GameStartScreen が使用） */
  getTitleContainer(): HTMLElement | null {
    return this.titleContainer;
  }

  // ================================================================
  // ゲームオーバー画面
  // ================================================================

  showGameOver(score: ScoreData, onRetry: () => void): void {
    this.onRetryClick = onRetry;

    if (!this.gameOverContainer) {
      this.gameOverContainer = document.createElement('div');
      this.gameOverContainer.className = 'gameover-screen';

      const heading = document.createElement('h1');
      heading.className = 'gameover-title';
      heading.textContent = 'GAME OVER';
      this.gameOverContainer.appendChild(heading);

      const stats = document.createElement('div');
      stats.className = 'gameover-stats';
      this.gameOverContainer.appendChild(stats);

      const retryBtn = document.createElement('button');
      retryBtn.className = 'gameover-btn';
      retryBtn.textContent = 'RETRY';
      retryBtn.addEventListener('click', () => this.onRetryClick?.());
      this.gameOverContainer.appendChild(retryBtn);

      this.container.appendChild(this.gameOverContainer);
    }

    // スコア更新
    const stats = this.gameOverContainer.querySelector('.gameover-stats');
    if (stats) {
      // 子要素をクリア
      while (stats.firstChild) stats.removeChild(stats.firstChild);

      const minutes = Math.floor(score.survivalTime / 60);
      const seconds = Math.floor(score.survivalTime % 60);
      const lines = [
        `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`,
        `Kills: ${score.killCount}`,
        `Allies: ${score.allyCount}`,
      ];
      for (const line of lines) {
        const p = document.createElement('p');
        p.textContent = line;
        stats.appendChild(p);
      }
    }

    this.gameOverContainer.style.display = 'flex';
  }

  hideGameOver(): void {
    if (this.gameOverContainer) this.gameOverContainer.style.display = 'none';
  }

  // ================================================================
  // WebGLフォールバックメッセージ（BL-12）
  // ================================================================

  showFallbackMessage(message: string): void {
    if (!this.fallbackContainer) {
      this.fallbackContainer = document.createElement('div');
      this.fallbackContainer.className = 'fallback-message';
      this.container.appendChild(this.fallbackContainer);
    }
    this.fallbackContainer.textContent = message;
    this.fallbackContainer.style.display = 'flex';
  }

  /** 一時メッセージ（コンテキストロスト等） */
  showMessage(message: string): void {
    this.showFallbackMessage(message);
  }

  hideMessage(): void {
    if (this.fallbackContainer) this.fallbackContainer.style.display = 'none';
  }

  // ================================================================
  // モバイル操作ボタン（BR-IN02）
  // ================================================================

  initMobileControls(onLeftDown: () => void, onRightDown: () => void, onMoveUp: () => void): void {
    this.onLeftDown = onLeftDown;
    this.onRightDown = onRightDown;
    this.onMoveUp = onMoveUp;

    if (this.mobileControls) return;

    this.mobileControls = document.createElement('div');
    this.mobileControls.className = 'mobile-controls';

    const leftBtn = document.createElement('button');
    leftBtn.className = 'mobile-btn mobile-btn-left';
    leftBtn.textContent = '\u25C0';
    leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.onLeftDown?.(); }, { passive: false });
    leftBtn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); this.onMoveUp?.(); }, { passive: false });

    const rightBtn = document.createElement('button');
    rightBtn.className = 'mobile-btn mobile-btn-right';
    rightBtn.textContent = '\u25B6';
    rightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.onRightDown?.(); }, { passive: false });
    rightBtn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); this.onMoveUp?.(); }, { passive: false });

    this.mobileControls.appendChild(leftBtn);
    this.mobileControls.appendChild(rightBtn);
    this.container.appendChild(this.mobileControls);
  }

  showMobileControls(): void {
    if (this.mobileControls) this.mobileControls.style.display = '';
  }

  hideMobileControls(): void {
    if (this.mobileControls) this.mobileControls.style.display = 'none';
  }

  // ================================================================
  // クリーンアップ
  // ================================================================

  /** 全UI要素を非表示に（ゲームリセット時） */
  hideAll(): void {
    this.hideHUD();
    this.hideTitle();
    this.hideGameOver();
    this.hideMessage();
    this.hideMobileControls();
    this.clearHPLabels();
  }

  dispose(): void {
    this.hideAll();
    this._worldToScreenLabel?.dispose();
    this._activeBuffIcon?.dispose();
    this._weaponHudPanel?.dispose();
    this._toastQueue?.dispose();
    this._worldToScreenLabel = null;
    this._activeBuffIcon = null;
    this._weaponHudPanel = null;
    this._toastQueue = null;
    if (this.hudContainer) { this.hudContainer.remove(); this.hudContainer = null; }
    if (this.titleContainer) { this.titleContainer.remove(); this.titleContainer = null; }
    if (this.gameOverContainer) { this.gameOverContainer.remove(); this.gameOverContainer = null; }
    if (this.fallbackContainer) { this.fallbackContainer.remove(); this.fallbackContainer = null; }
    if (this.mobileControls) { this.mobileControls.remove(); this.mobileControls = null; }
    for (const pooled of this.damagePool) {
      pooled.element.remove();
    }
    this.damagePool.length = 0;
  }
}
