import { PerspectiveCamera, Vector3 } from 'three';
import { HitCountComponent } from '../components/HitCountComponent';
import { MeshComponent } from '../components/MeshComponent';
import { PositionComponent } from '../components/PositionComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { GAME_CONFIG } from '../config/gameConfig';
import { CoordinateMapper } from '../utils/CoordinateMapper';
import type { World } from '../ecs/World';
import type { HUDState, ScoreData } from '../types';
import { BuffType, BUFF_COLORS } from '../types';
import { I18N_WEAPON_LABEL } from '../config/i18nStrings';

/** バフ表示ラベル */
const BUFF_LABELS: Record<BuffType, string> = {
  [BuffType.ATTACK_UP]: 'ATK',
  [BuffType.FIRE_RATE_UP]: 'SPD',
  [BuffType.SPEED_UP]: 'MOV',
  [BuffType.BARRAGE]: 'BRG',
};

/** DOMプール要素 */
interface PooledElement {
  element: HTMLDivElement;
  inUse: boolean;
}

/**
 * HTMLオーバーレイUI管理（FR-07, BL-08, BR-UI01〜04）
 * innerHTML禁止、textContent/DOM APIのみ使用（NFR-06）
 */
export class HTMLOverlayManager {
  private container: HTMLElement;

  // HUD要素
  private hudContainer: HTMLDivElement | null = null;
  private hpBarFill: HTMLDivElement | null = null;
  private hpText: HTMLSpanElement | null = null;
  private buffContainer: HTMLDivElement | null = null;
  private timerText: HTMLSpanElement | null = null;
  private killText: HTMLSpanElement | null = null;
  private waveText: HTMLSpanElement | null = null;
  private allyText: HTMLSpanElement | null = null;
  private weaponText: HTMLSpanElement | null = null;

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
  // HUD
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

    // バフコンテナ
    this.buffContainer = document.createElement('div');
    this.buffContainer.className = 'hud-buff-container';
    this.hudContainer.appendChild(this.buffContainer);

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

    // 武器インジケータ
    this.weaponText = document.createElement('span');
    this.weaponText.className = 'hud-weapon';
    this.hudContainer.appendChild(this.weaponText);

    this.container.appendChild(this.hudContainer);
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

    // 武器
    if (this.weaponText) {
      this.weaponText.textContent = I18N_WEAPON_LABEL[state.weaponGenre] ?? 'RIFLE';
    }

    // バフ
    this.updateBuffDisplay(state.activeBuffs);
  }

  private updateBuffDisplay(activeBuffs: Map<BuffType, { remainingTime: number }>): void {
    if (!this.buffContainer) return;

    // 既存の子要素を再利用/更新
    const existing = this.buffContainer.children;
    let idx = 0;

    for (const [buffType, state] of activeBuffs) {
      let item: HTMLDivElement;
      if (idx < existing.length) {
        item = existing[idx] as HTMLDivElement;
      } else {
        item = document.createElement('div');
        item.className = 'hud-buff-item';
        this.buffContainer.appendChild(item);
      }

      const color = BUFF_COLORS[buffType] ?? '#FFFFFF';
      const label = BUFF_LABELS[buffType] ?? '?';
      const ratio = Math.max(0, state.remainingTime / GAME_CONFIG.buff.duration);

      // ラベル
      if (item.children.length === 0) {
        const labelEl = document.createElement('span');
        labelEl.className = 'buff-label';
        item.appendChild(labelEl);
        const barBg = document.createElement('div');
        barBg.className = 'buff-bar-bg';
        const barFill = document.createElement('div');
        barFill.className = 'buff-bar-fill';
        barBg.appendChild(barFill);
        item.appendChild(barBg);
      }

      (item.children[0] as HTMLSpanElement).textContent = label;
      (item.children[0] as HTMLSpanElement).style.color = color;
      const fill = (item.children[1] as HTMLDivElement).children[0] as HTMLDivElement;
      fill.style.width = `${ratio * 100}%`;
      fill.style.backgroundColor = color;

      idx++;
    }

    // 余分な要素を非表示
    while (idx < existing.length) {
      (existing[idx] as HTMLElement).style.display = 'none';
      idx++;
    }
    // 使用中の要素を表示
    for (let i = 0; i < activeBuffs.size && i < existing.length; i++) {
      (existing[i] as HTMLElement).style.display = '';
    }
  }

  showHUD(): void {
    if (this.hudContainer) this.hudContainer.style.display = '';
  }

  hideHUD(): void {
    if (this.hudContainer) this.hudContainer.style.display = 'none';
  }

  // ================================================================
  // 敵HP表示（BR-UI02）
  // ================================================================

  /** 毎フレーム：敵ヒットカウント表示位置を3D→スクリーン座標に投影 */
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
      controls.textContent = 'PC: ← → or A/D | Mobile: Tap or Swipe';
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
    leftBtn.textContent = '◀';
    leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.onLeftDown?.(); }, { passive: false });
    leftBtn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); this.onMoveUp?.(); }, { passive: false });

    const rightBtn = document.createElement('button');
    rightBtn.className = 'mobile-btn mobile-btn-right';
    rightBtn.textContent = '▶';
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
