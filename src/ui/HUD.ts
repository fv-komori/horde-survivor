import type { HUDState } from '../types';

/**
 * HUD描画（business-logic-model 15.1-15.5）
 */
export class HUD {

  render(ctx: CanvasRenderingContext2D, state: HUDState): void {
    this.renderHPBar(ctx, state.hp, state.maxHp);
    this.renderLevelText(ctx, state.level);
    this.renderXPBar(ctx, state.xpCurrent, state.xpRequired);
    this.renderTimer(ctx, state.elapsedTime);
    this.renderKillCount(ctx, state.killCount);
  }

  /** HPバー（15.1） */
  private renderHPBar(ctx: CanvasRenderingContext2D, hp: number, maxHp: number): void {
    const x = 16, y = 16, w = 200, h = 16;
    const ratio = Math.max(0, hp / maxHp);

    // 背景
    ctx.fillStyle = '#400000';
    ctx.fillRect(x, y, w, h);

    // バー色（HP50%以上:緑、25-50%:黄、25%未満:赤）
    if (ratio > 0.5) ctx.fillStyle = '#00FF00';
    else if (ratio > 0.25) ctx.fillStyle = '#FFFF00';
    else ctx.fillStyle = '#FF0000';

    ctx.fillRect(x, y, w * ratio, h);

    // 枠線
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // テキスト
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(hp)}/${maxHp}`, x + w + 8, y + h / 2);
  }

  /** レベル表示（15.3） */
  private renderLevelText(ctx: CanvasRenderingContext2D, level: number): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Lv.${level}`, 16, 40);
  }

  /** XPバー（15.2） */
  private renderXPBar(ctx: CanvasRenderingContext2D, current: number, required: number): void {
    const x = 160, y = 8, w = 400, h = 8;
    const ratio = required > 0 ? Math.min(1, current / required) : 0;

    ctx.fillStyle = '#000040';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(x, y, w * ratio, h);
    ctx.strokeStyle = '#444488';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  /** タイマー表示（15.4） */
  private renderTimer(ctx: CanvasRenderingContext2D, elapsedTime: number): void {
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = Math.floor(elapsedTime % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(timeStr, 720 - 16, 16);
  }

  /** 撃破数表示（15.5） */
  private renderKillCount(ctx: CanvasRenderingContext2D, killCount: number): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`${killCount} kills`, 720 - 16, 36);
  }
}
