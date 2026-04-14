import { GAME_CONFIG } from '../config/gameConfig';

/**
 * タイトル画面（FR-06）
 */
export class TitleScreen {
  private startButtonRect = { x: 260, y: 700, w: 200, h: 56 };
  private settingsButtonRect = { x: 260, y: 780, w: 200, h: 56 };

  render(ctx: CanvasRenderingContext2D): void {
    const w = GAME_CONFIG.screen.logicalWidth;

    // 背景
    ctx.fillStyle = '#111122';
    ctx.fillRect(0, 0, w, GAME_CONFIG.screen.logicalHeight);

    // タイトル
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FV DEFENSE', w / 2, 400);

    // サブタイトル
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '18px monospace';
    ctx.fillText('- Shoot them all! -', w / 2, 460);

    // ゲーム開始ボタン
    const btn = this.startButtonRect;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('START', w / 2, btn.y + btn.h / 2);

    // SETTINGSボタン（Unit-02: BLM §6.1）
    const sbtn = this.settingsButtonRect;
    ctx.strokeStyle = '#AAAAAA';
    ctx.lineWidth = 1;
    ctx.strokeRect(sbtn.x, sbtn.y, sbtn.w, sbtn.h);
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '20px monospace';
    ctx.fillText('SETTINGS', w / 2, sbtn.y + sbtn.h / 2);

    // 操作説明
    ctx.fillStyle = '#888888';
    ctx.font = '14px monospace';
    ctx.fillText('PC: ← → or A/D to move', w / 2, 900);
    ctx.fillText('Mobile: Tap buttons or swipe', w / 2, 925);
    ctx.fillText('Auto-shoot enabled', w / 2, 950);
  }

  /** スタートボタン判定 */
  isStartButtonClicked(logicalX: number, logicalY: number): boolean {
    const btn = this.startButtonRect;
    return (
      logicalX >= btn.x && logicalX <= btn.x + btn.w &&
      logicalY >= btn.y && logicalY <= btn.y + btn.h
    );
  }

  /** SETTINGSボタン判定（Unit-02: BLM §6.2） */
  isSettingsButtonClicked(logicalX: number, logicalY: number): boolean {
    const btn = this.settingsButtonRect;
    return (
      logicalX >= btn.x && logicalX <= btn.x + btn.w &&
      logicalY >= btn.y && logicalY <= btn.y + btn.h
    );
  }
}
