import { GAME_CONFIG } from '../config/gameConfig';
import type { UpgradeChoice } from '../types';
import { UpgradeCategory } from '../types';

/**
 * レベルアップ選択画面（business-logic-model 15.6）
 */
export class LevelUpScreen {
  private cardRects: { x: number; y: number; w: number; h: number }[] = [];

  render(ctx: CanvasRenderingContext2D, choices: UpgradeChoice[]): void {
    const w = GAME_CONFIG.screen.logicalWidth;
    const h = GAME_CONFIG.screen.logicalHeight;

    // オーバーレイ
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);

    // タイトル
    ctx.fillStyle = '#FFFF00';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LEVEL UP!', w / 2, 320);

    // カード描画（3枚横並び）
    const cardW = 180;
    const cardH = 240;
    const gap = 20;
    const totalW = choices.length * cardW + (choices.length - 1) * gap;
    const startX = (w - totalW) / 2;
    const cardY = 400;

    this.cardRects = [];

    for (let i = 0; i < choices.length; i++) {
      const cx = startX + i * (cardW + gap);
      this.cardRects.push({ x: cx, y: cardY, w: cardW, h: cardH });
      this.renderCard(ctx, choices[i], cx, cardY, cardW, cardH);
    }
  }

  private renderCard(
    ctx: CanvasRenderingContext2D,
    choice: UpgradeChoice,
    x: number, y: number, w: number, h: number,
  ): void {
    // カード背景
    ctx.fillStyle = 'rgba(0,0,80,0.9)';
    ctx.beginPath();
    this.roundRect(ctx, x, y, w, h, 8);
    ctx.fill();

    // 枠線
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    this.roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();

    const centerX = x + w / 2;

    // アイコン領域
    ctx.fillStyle = this.getCategoryColor(choice.category);
    ctx.font = '36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.getCategoryIcon(choice.category), centerX, y + 50);

    // 名称
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px monospace';
    ctx.fillText(this.getChoiceName(choice), centerX, y + 110);

    // 説明文
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '12px monospace';
    const desc = choice.description;
    // 長い場合は折り返し
    if (desc.length > 12) {
      ctx.fillText(desc.slice(0, 12), centerX, y + 150);
      if (desc.length > 12) {
        ctx.fillText(desc.slice(12), centerX, y + 168);
      }
    } else {
      ctx.fillText(desc, centerX, y + 150);
    }

    // レベル表示
    if (choice.category !== UpgradeCategory.HEAL) {
      ctx.fillStyle = '#FFFF00';
      ctx.font = '14px monospace';
      ctx.fillText(`Lv ${choice.currentLevel} → ${choice.nextLevel}`, centerX, y + 210);
    }
  }

  /** タップされたカードのインデックスを返す（-1: 該当なし） */
  getClickedCardIndex(logicalX: number, logicalY: number): number {
    for (let i = 0; i < this.cardRects.length; i++) {
      const r = this.cardRects[i];
      if (logicalX >= r.x && logicalX <= r.x + r.w && logicalY >= r.y && logicalY <= r.y + r.h) {
        return i;
      }
    }
    return -1;
  }

  private getCategoryIcon(category: UpgradeCategory): string {
    switch (category) {
      case UpgradeCategory.WEAPON: return '⚔';
      case UpgradeCategory.PASSIVE: return '★';
      case UpgradeCategory.ALLY: return '♦';
      case UpgradeCategory.HEAL: return '♥';
    }
  }

  private getCategoryColor(category: UpgradeCategory): string {
    switch (category) {
      case UpgradeCategory.WEAPON: return '#FF8800';
      case UpgradeCategory.PASSIVE: return '#00FF88';
      case UpgradeCategory.ALLY: return '#8888FF';
      case UpgradeCategory.HEAL: return '#FF4444';
    }
  }

  private getChoiceName(choice: UpgradeChoice): string {
    if (choice.category === UpgradeCategory.HEAL) return 'HP回復';
    if (choice.category === UpgradeCategory.ALLY) return '仲間追加';
    return choice.upgradeType;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }
}
