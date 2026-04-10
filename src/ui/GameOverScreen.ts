import { GAME_CONFIG } from '../config/gameConfig';
import type { ScoreData } from '../types';

/**
 * ゲームオーバー画面（Iteration 2: allyCount表示）
 */
export class GameOverScreen {
  private retryButtonRect = { x: 260, y: 800, w: 200, h: 48 };

  render(ctx: CanvasRenderingContext2D, score: ScoreData): void {
    const w = GAME_CONFIG.screen.logicalWidth;
    const h = GAME_CONFIG.screen.logicalHeight;

    // オーバーレイ
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    // GAME OVER
    ctx.fillStyle = '#FF0000';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', w / 2, 450);

    // スコア表示
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '18px monospace';

    const minutes = Math.floor(score.survivalTime / 60);
    const seconds = Math.floor(score.survivalTime % 60);
    ctx.fillText(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}`, w / 2, 550);
    ctx.fillText(`Kills: ${score.killCount}`, w / 2, 590);
    ctx.fillText(`Allies: ${score.allyCount}`, w / 2, 630);

    // リトライボタン
    const btn = this.retryButtonRect;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('RETRY', w / 2, btn.y + btn.h / 2);
  }

  /** リトライボタン判定 */
  isRetryButtonClicked(logicalX: number, logicalY: number): boolean {
    const btn = this.retryButtonRect;
    return (
      logicalX >= btn.x && logicalX <= btn.x + btn.w &&
      logicalY >= btn.y && logicalY <= btn.y + btn.h
    );
  }
}
