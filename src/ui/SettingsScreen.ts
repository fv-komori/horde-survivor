/**
 * SettingsScreen — 設定タブ+遊び方タブの統合UIモーダル（Unit-02）
 * BLM §2〜§8, BR-UI01〜06, BR-HP01〜04
 */

import { GAME_CONFIG } from '../config/gameConfig';
import { ENEMY_CONFIG } from '../config/enemyConfig';
import { WEAPON_CONFIG } from '../config/weaponConfig';
import {
  SETTINGS_UI as UI,
  CONTROL_TYPE_OPTIONS,
  HELP_PAGE_TITLES,
  HELP_TOTAL_PAGES,
} from '../config/settingsConfig';
import { ControlType, BuffType, BUFF_COLORS } from '../types';
import type { SettingsManager } from '../game/SettingsManager';
import type { InputHandler } from '../input/InputHandler';

type SettingsTab = 'settings' | 'howtoplay';

export class SettingsScreen {
  visible = false;
  private activeTab: SettingsTab = 'settings';
  private helpPageIndex = 0;
  private draggingSlider: 'bgm' | 'se' | null = null;

  private settingsManager: SettingsManager;
  private inputHandler: InputHandler;
  private canvas: HTMLCanvasElement;

  // ポインターイベント管理（AbortControllerで一括解除）
  private pointerAbort: AbortController | null = null;

  constructor(
    settingsManager: SettingsManager,
    inputHandler: InputHandler,
    canvas: HTMLCanvasElement,
  ) {
    this.settingsManager = settingsManager;
    this.inputHandler = inputHandler;
    this.canvas = canvas;
  }

  // ============================
  // 表示制御（BLM §2.2〜2.3）
  // ============================

  show(): void {
    this.visible = true;
    this.activeTab = 'settings';
    this.helpPageIndex = 0;
    this.draggingSlider = null;
    this.registerPointerEvents();
  }

  hide(): void {
    this.visible = false;
    this.draggingSlider = null;
    this.unregisterPointerEvents();
  }

  // ============================
  // 入力ルーティング（BLM §2.4）
  // ============================

  handleInput(x: number, y: number): void {
    // 1. 閉じるボタン
    const cb = UI.closeButton;
    if (x >= cb.hitX && x <= cb.hitX + cb.hitW && y >= cb.hitY && y <= cb.hitY + cb.hitH) {
      this.hide();
      return;
    }

    // 2. タブバー
    const st = UI.tabs.settingsTab;
    if (x >= st.x && x <= st.x + st.w && y >= st.y && y <= st.y + st.h) {
      this.activeTab = 'settings';
      this.draggingSlider = null;
      return;
    }
    const ht = UI.tabs.helpTab;
    if (x >= ht.x && x <= ht.x + ht.w && y >= ht.y && y <= ht.y + ht.h) {
      if (this.activeTab !== 'howtoplay') {
        this.activeTab = 'howtoplay';
        this.helpPageIndex = 0;
      }
      this.draggingSlider = null;
      return;
    }

    // 3. コンテンツ委譲
    if (this.activeTab === 'settings') {
      if (this.handleSliderTap(x, y)) return;
      if (this.handleControlTypeSelect(x, y)) return;
    } else {
      if (this.handleHelpNavigation(x, y)) return;
    }
  }

  // ============================
  // ポインターイベント（BLM §3.4）
  // ============================

  private registerPointerEvents(): void {
    // 既存リスナーを先にクリーンアップ（S-NG-2: show()連打時の二重登録防止）
    this.unregisterPointerEvents();

    const abort = new AbortController();
    this.pointerAbort = abort;
    const signal = abort.signal;

    const onDown = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e) e.preventDefault(); // F-NG-2: スクロール抑制
      const pos = this.getPointerLogical(e);
      if (!pos) return;
      this.handlePointerDown(pos.x, pos.y);
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (this.draggingSlider === null) return;
      if ('touches' in e) e.preventDefault();
      const pos = this.getPointerLogical(e);
      if (!pos) return;
      this.handlePointerMove(pos.x);
    };
    const onUp = () => {
      this.handlePointerUp();
    };

    this.canvas.addEventListener('mousedown', onDown, { signal });
    this.canvas.addEventListener('mousemove', onMove, { signal });
    window.addEventListener('mouseup', onUp, { signal });
    this.canvas.addEventListener('touchstart', onDown as EventListener, { passive: false, signal });
    this.canvas.addEventListener('touchmove', onMove as EventListener, { passive: false, signal });
    window.addEventListener('touchend', onUp, { signal });
  }

  private unregisterPointerEvents(): void {
    this.pointerAbort?.abort();
    this.pointerAbort = null;
  }

  private getPointerLogical(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
    let clientX: number, clientY: number;
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0];
      if (!t) return null;
      clientX = t.clientX;
      clientY = t.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const rect = this.canvas.getBoundingClientRect();
    const { scale, offsetX, offsetY } = this.inputHandler.getScaling();
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  // ============================
  // スライダー操作（BLM §3.1〜3.3）
  // ============================

  private getSliderValue(pointerX: number): number {
    const s = UI.slider;
    const ratio = Math.max(0, Math.min(1, (pointerX - s.trackLeft) / s.trackWidth));
    return Math.round(ratio * 100);
  }

  private isInSliderHitArea(x: number, y: number, trackY: number): boolean {
    const s = UI.slider;
    return (
      x >= s.trackLeft - s.hitAreaPadding &&
      x <= s.trackLeft + s.trackWidth + s.hitAreaPadding &&
      y >= trackY - s.hitAreaPadding &&
      y <= trackY + s.trackHeight + s.hitAreaPadding
    );
  }

  private handleSliderTap(x: number, y: number): boolean {
    if (this.isInSliderHitArea(x, y, UI.bgmSlider.trackY)) {
      this.settingsManager.setBGMVolume(this.getSliderValue(x));
      return true;
    }
    if (this.isInSliderHitArea(x, y, UI.seSlider.trackY)) {
      this.settingsManager.setSEVolume(this.getSliderValue(x));
      return true;
    }
    return false;
  }

  private handlePointerDown(x: number, y: number): void {
    if (this.activeTab !== 'settings') return;
    const s = UI.slider;
    // BGMノブ判定
    const bgmKnobX = s.trackLeft + (this.settingsManager.getBGMVolume() / 100) * s.trackWidth;
    if (Math.abs(x - bgmKnobX) <= s.knobRadius + s.knobHitPadding &&
        Math.abs(y - (UI.bgmSlider.trackY + s.trackHeight / 2)) <= s.knobRadius + s.knobHitPadding) {
      this.draggingSlider = 'bgm';
      return;
    }
    // SEノブ判定
    const seKnobX = s.trackLeft + (this.settingsManager.getSEVolume() / 100) * s.trackWidth;
    if (Math.abs(x - seKnobX) <= s.knobRadius + s.knobHitPadding &&
        Math.abs(y - (UI.seSlider.trackY + s.trackHeight / 2)) <= s.knobRadius + s.knobHitPadding) {
      this.draggingSlider = 'se';
      return;
    }
    this.draggingSlider = null;
  }

  private handlePointerMove(pointerX: number): void {
    const value = this.getSliderValue(pointerX);
    if (this.draggingSlider === 'bgm') {
      this.settingsManager.previewBGMVolume(value);
    } else if (this.draggingSlider === 'se') {
      this.settingsManager.previewSEVolume(value);
    }
  }

  private handlePointerUp(): void {
    if (this.draggingSlider !== null) {
      this.settingsManager.save(); // ドラッグ終了時に永続化
      this.draggingSlider = null;
    }
  }

  // ============================
  // 操作タイプ選択（BLM §4）
  // ============================

  private handleControlTypeSelect(x: number, y: number): boolean {
    const ct = UI.controlType;
    for (let i = 0; i < CONTROL_TYPE_OPTIONS.length; i++) {
      const optY = ct.optionStartY + i * ct.optionSpacing;
      if (
        x >= ct.optionX && x <= ct.optionX + ct.optionHitW &&
        y >= optY && y <= optY + ct.optionHitH
      ) {
        this.settingsManager.setControlType(CONTROL_TYPE_OPTIONS[i].type);
        return true;
      }
    }
    return false;
  }

  // ============================
  // ヘルプナビゲーション（BLM §5.2, BR-HP02）
  // ============================

  private handleHelpNavigation(x: number, y: number): boolean {
    const h = UI.help;
    // 前ボタン
    if (
      x >= h.prevButtonX && x <= h.prevButtonX + h.navButtonW &&
      y >= h.navY && y <= h.navY + h.navButtonH
    ) {
      if (this.helpPageIndex > 0) this.helpPageIndex--;
      return true;
    }
    // 次ボタン
    if (
      x >= h.nextButtonX && x <= h.nextButtonX + h.navButtonW &&
      y >= h.navY && y <= h.navY + h.navButtonH
    ) {
      if (this.helpPageIndex < HELP_TOTAL_PAGES - 1) this.helpPageIndex++;
      return true;
    }
    // ドット直接タップ
    const dotsStartX = (GAME_CONFIG.screen.logicalWidth - (HELP_TOTAL_PAGES - 1) * h.dotSpacing) / 2;
    for (let i = 0; i < HELP_TOTAL_PAGES; i++) {
      const dotX = dotsStartX + i * h.dotSpacing;
      if (Math.abs(x - dotX) <= h.dotRadius + 8 && Math.abs(y - h.dotY) <= h.dotRadius + 8) {
        this.helpPageIndex = i;
        return true;
      }
    }
    return false;
  }

  // ============================
  // 描画
  // ============================

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;
    const W = GAME_CONFIG.screen.logicalWidth;
    const H = GAME_CONFIG.screen.logicalHeight;

    // 半透明オーバーレイ
    ctx.fillStyle = UI.overlay.color;
    ctx.fillRect(0, 0, W, H);

    // パネル背景
    this.drawRoundedRect(ctx, UI.panel.x, UI.panel.y, UI.panel.w, UI.panel.h, UI.panel.borderRadius, UI.panel.bgColor);

    // タブバー
    this.renderTabs(ctx);

    // 閉じるボタン
    this.renderCloseButton(ctx);

    // コンテンツ
    if (this.activeTab === 'settings') {
      this.renderSettingsTab(ctx);
    } else {
      this.renderHelpTab(ctx);
    }
  }

  // --- タブ描画 ---

  private renderTabs(ctx: CanvasRenderingContext2D): void {
    const tabs = UI.tabs;
    // 設定タブ
    ctx.fillStyle = this.activeTab === 'settings' ? tabs.activeColor : tabs.inactiveColor;
    ctx.fillRect(tabs.settingsTab.x, tabs.settingsTab.y, tabs.settingsTab.w, tabs.settingsTab.h);
    // 遊び方タブ
    ctx.fillStyle = this.activeTab === 'howtoplay' ? tabs.activeColor : tabs.inactiveColor;
    ctx.fillRect(tabs.helpTab.x, tabs.helpTab.y, tabs.helpTab.w, tabs.helpTab.h);
    // アクティブインジケータ
    const activeRect = this.activeTab === 'settings' ? tabs.settingsTab : tabs.helpTab;
    ctx.fillStyle = tabs.activeIndicatorColor;
    ctx.fillRect(activeRect.x, activeRect.y + activeRect.h - 3, activeRect.w, 3);
    // テキスト
    ctx.fillStyle = tabs.textColor;
    ctx.font = `${tabs.fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('設定', tabs.settingsTab.x + tabs.settingsTab.w / 2, tabs.settingsTab.y + tabs.settingsTab.h / 2);
    ctx.fillText('遊び方', tabs.helpTab.x + tabs.helpTab.w / 2, tabs.helpTab.y + tabs.helpTab.h / 2);
  }

  private renderCloseButton(ctx: CanvasRenderingContext2D): void {
    const cb = UI.closeButton;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', cb.drawX, cb.drawY + cb.drawSize / 2);
  }

  // ============================
  // 設定タブ描画（BLM §8.2）
  // ============================

  private renderSettingsTab(ctx: CanvasRenderingContext2D): void {
    this.renderSlider(ctx, 'BGM音量', UI.bgmSlider.labelY, UI.bgmSlider.trackY, this.settingsManager.getBGMVolume());
    this.renderSlider(ctx, 'SE音量', UI.seSlider.labelY, UI.seSlider.trackY, this.settingsManager.getSEVolume());
    this.renderControlTypeOptions(ctx);
  }

  private renderSlider(
    ctx: CanvasRenderingContext2D,
    label: string,
    labelY: number,
    trackY: number,
    value: number,
  ): void {
    const s = UI.slider;
    // ラベル
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${s.labelFontSize}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, s.trackLeft, labelY);
    // 数値
    ctx.font = `${s.valueFontSize}px monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(`${value}`, s.trackLeft + s.trackWidth + 60, trackY + s.trackHeight / 2);
    // トラック背景
    ctx.fillStyle = s.trackColor;
    ctx.fillRect(s.trackLeft, trackY, s.trackWidth, s.trackHeight);
    // トラックフィル
    const fillW = (value / 100) * s.trackWidth;
    ctx.fillStyle = s.fillColor;
    ctx.fillRect(s.trackLeft, trackY, fillW, s.trackHeight);
    // ノブ
    const knobX = s.trackLeft + fillW;
    const knobY = trackY + s.trackHeight / 2;
    ctx.beginPath();
    ctx.arc(knobX, knobY, s.knobRadius, 0, Math.PI * 2);
    ctx.fillStyle = s.knobColor;
    ctx.fill();
  }

  private renderControlTypeOptions(ctx: CanvasRenderingContext2D): void {
    const ct = UI.controlType;
    const currentType = this.settingsManager.getControlType();
    // ラベル
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${ct.fontSize}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('操作タイプ', ct.optionX, ct.labelY);
    // 各選択肢
    for (let i = 0; i < CONTROL_TYPE_OPTIONS.length; i++) {
      const opt = CONTROL_TYPE_OPTIONS[i];
      const y = ct.optionStartY + i * ct.optionSpacing + ct.optionHitH / 2;
      const isSelected = opt.type === currentType;
      // ラジオボタン円
      ctx.beginPath();
      ctx.arc(ct.optionX + ct.radioRadius, y, ct.radioRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#AAAAAA';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(ct.optionX + ct.radioRadius, y, ct.radioRadius - 3, 0, Math.PI * 2);
        ctx.fillStyle = UI.tabs.activeIndicatorColor;
        ctx.fill();
      }
      // ラベルテキスト
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `${ct.fontSize}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(opt.label, ct.optionX + ct.radioRadius * 2 + 16, y);
    }
  }

  // ============================
  // 遊び方タブ描画（BLM §5.3, §8.3, BR-HP01〜04）
  // ============================

  private renderHelpTab(ctx: CanvasRenderingContext2D): void {
    const h = UI.help;
    const W = GAME_CONFIG.screen.logicalWidth;

    // ページタイトル
    ctx.fillStyle = '#88aaff';
    ctx.font = `bold ${h.titleFontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(HELP_PAGE_TITLES[this.helpPageIndex], W / 2, h.contentY);

    // ページコンテンツ
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${h.bodyFontSize}px monospace`;
    ctx.textAlign = 'left';
    const contentStartY = h.contentY + 50;
    this.renderHelpPage(ctx, this.helpPageIndex, contentStartY);

    // ページインジケータ
    this.renderPageIndicator(ctx);
  }

  private renderHelpPage(ctx: CanvasRenderingContext2D, pageIndex: number, startY: number): void {
    const lh = UI.help.lineHeight;
    const x = UI.panel.x + 30;
    let y = startY;

    switch (pageIndex) {
      case 0: // 操作方法
        y = this.drawHelpLine(ctx, x, y, lh, '🎮 PC操作');
        y = this.drawHelpLine(ctx, x + 20, y, lh, '← → キー または A/D キーで左右移動');
        y += lh / 2;
        y = this.drawHelpLine(ctx, x, y, lh, '📱 モバイル操作');
        y = this.drawHelpLine(ctx, x + 20, y, lh, 'ボタンタップ / スワイプで移動');
        y += lh / 2;
        y = this.drawHelpLine(ctx, x, y, lh, '🔫 射撃');
        y = this.drawHelpLine(ctx, x + 20, y, lh, '自動射撃（オート）');
        y = this.drawHelpLine(ctx, x + 20, y, lh, '操作は移動に集中するだけ！');
        break;

      case 1: // ゲームルール
        y = this.drawHelpLine(ctx, x, y, lh, '🛡️ 防衛ライン');
        y = this.drawHelpLine(ctx, x + 20, y, lh, '画面下部のライン。敵が通過するとHP減少');
        y += lh / 2;
        y = this.drawHelpLine(ctx, x, y, lh, `❤️ HP: 初期${GAME_CONFIG.player.baseHp}`);
        y = this.drawHelpLine(ctx, x + 20, y, lh, '0になるとゲームオーバー');
        y += lh / 2;
        y = this.drawHelpLine(ctx, x, y, lh, '⏱️ 目標');
        y = this.drawHelpLine(ctx, x + 20, y, lh, '可能な限り長く生き残る！');
        y += lh / 2;
        y = this.drawHelpLine(ctx, x, y, lh, '🏆 スコア');
        y = this.drawHelpLine(ctx, x + 20, y, lh, '生存時間 + 撃破数 + 仲間数');
        break;

      case 2: { // 敵タイプ（BR-HP04: config参照）
        const enemies = [
          { name: '通常敵', color: '#44CC44', key: 'NORMAL' },
          { name: '高速敵', color: '#CCCC44', key: 'FAST' },
          { name: 'タンク敵', color: '#CC4444', key: 'TANK' },
          { name: 'ボス敵', color: '#CC44CC', key: 'BOSS' },
        ];
        for (const e of enemies) {
          const cfg = ENEMY_CONFIG[e.key];
          // スプライトアイコン（簡易カラー矩形）
          ctx.fillStyle = e.color;
          ctx.fillRect(x, y, UI.help.iconSize, UI.help.iconSize);
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'left';
          ctx.fillText(
            `${e.name}  ヒット:${cfg.hitCount}  速度:${cfg.speed}`,
            x + UI.help.iconSize + 12,
            y + UI.help.iconSize / 2,
          );
          y += UI.help.iconSize + lh / 2;
        }
        break;
      }

      case 3: { // アイテム・バフ（BR-HP04: config参照）
        const buffs = [
          { name: '攻撃力UP', type: BuffType.ATTACK_UP, desc: `1弾${GAME_CONFIG.buff.attackUpReduction}カウント減算` },
          { name: '発射速度UP', type: BuffType.FIRE_RATE_UP, desc: `連射${1 / GAME_CONFIG.buff.fireRateMultiplier}倍速` },
          { name: '移動速度UP', type: BuffType.SPEED_UP, desc: `移動${GAME_CONFIG.buff.speedMultiplier}倍速` },
          { name: '弾幕モード', type: BuffType.BARRAGE, desc: `弾数${GAME_CONFIG.buff.barrageBulletMultiplier}倍+拡散` },
        ];
        for (const b of buffs) {
          ctx.fillStyle = BUFF_COLORS[b.type];
          ctx.fillRect(x, y, UI.help.iconSize, UI.help.iconSize);
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'left';
          ctx.fillText(
            `${b.name}  ${b.desc}  ${GAME_CONFIG.buff.duration}秒`,
            x + UI.help.iconSize + 12,
            y + UI.help.iconSize / 2,
          );
          y += UI.help.iconSize + lh / 2;
        }
        break;
      }

      case 4: { // 武器
        const weapons = [
          { name: '前方射撃（初期）', key: 'FORWARD', desc: '正面直線' },
          { name: '拡散射撃', key: 'SPREAD', desc: '扇状に複数弾' },
          { name: '貫通弾', key: 'PIERCING', desc: '敵を貫通' },
        ];
        for (const w of weapons) {
          const cfg = WEAPON_CONFIG[w.key];
          y = this.drawHelpLine(ctx, x, y, lh, `🔫 ${w.name}`);
          y = this.drawHelpLine(ctx, x + 20, y, lh, `${w.desc}  間隔:${cfg.fireInterval}秒  弾数:${cfg.bulletCount}`);
          y += lh / 2;
        }
        break;
      }

      case 5: // 仲間化
        y = this.drawHelpLine(ctx, x, y, lh, '🤝 仲間化');
        y = this.drawHelpLine(ctx, x + 20, y, lh, '敵撃破時に確率で仲間に転換');
        y += lh / 2;
        y = this.drawHelpLine(ctx, x, y, lh, `👥 最大${GAME_CONFIG.ally.maxCount}体`);
        y = this.drawHelpLine(ctx, x + 20, y, lh, 'プレイヤー左右に配置');
        y += lh / 2;
        y = this.drawHelpLine(ctx, x, y, lh, '🔫 仲間はオート射撃で援護');
        y += lh / 2;
        y = this.drawHelpLine(ctx, x, y, lh, '⬆️ 時間経過で連射速度UP');
        this.drawHelpLine(ctx, x + 20, y, lh,
          `${GAME_CONFIG.ally.fireRateBonusInterval}秒ごと+${GAME_CONFIG.ally.fireRateBonusPerTick}%（最大+${GAME_CONFIG.ally.maxFireRateBonus}%）`);
        break;
    }
  }

  private drawHelpLine(ctx: CanvasRenderingContext2D, x: number, y: number, lh: number, text: string): number {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${UI.help.bodyFontSize}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
    return y + lh;
  }

  // ページインジケータ
  private renderPageIndicator(ctx: CanvasRenderingContext2D): void {
    const h = UI.help;
    const W = GAME_CONFIG.screen.logicalWidth;

    // 前後ボタン
    ctx.fillStyle = this.helpPageIndex > 0 ? '#FFFFFF' : '#555555';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('◀', h.prevButtonX + h.navButtonW / 2, h.navY + h.navButtonH / 2);

    ctx.fillStyle = this.helpPageIndex < HELP_TOTAL_PAGES - 1 ? '#FFFFFF' : '#555555';
    ctx.fillText('▶', h.nextButtonX + h.navButtonW / 2, h.navY + h.navButtonH / 2);

    // ドット
    const dotsStartX = (W - (HELP_TOTAL_PAGES - 1) * h.dotSpacing) / 2;
    for (let i = 0; i < HELP_TOTAL_PAGES; i++) {
      const dotX = dotsStartX + i * h.dotSpacing;
      ctx.beginPath();
      ctx.arc(dotX, h.dotY, h.dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = i === this.helpPageIndex ? h.dotActiveColor : h.dotInactiveColor;
      ctx.fill();
    }

    // ページ番号
    ctx.fillStyle = '#AAAAAA';
    ctx.font = `${h.pageNumFontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${this.helpPageIndex + 1} / ${HELP_TOTAL_PAGES}`, W / 2, h.navY + h.navButtonH + 16);
  }

  // ============================
  // ユーティリティ
  // ============================

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    r: number, color: string,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
}
