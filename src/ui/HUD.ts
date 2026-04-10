import type { HUDState } from '../types';
import { BuffType, BUFF_COLORS, WeaponType } from '../types';
import { GAME_CONFIG } from '../config/gameConfig';

/** 武器アイコンラベル */
const WEAPON_LABELS: Record<WeaponType, string> = {
  [WeaponType.FORWARD]: 'RIFLE',
  [WeaponType.SPREAD]: 'SHOTGUN',
  [WeaponType.PIERCING]: 'SNIPER',
};

/** バフ表示ラベル */
const BUFF_LABELS: Record<BuffType, string> = {
  [BuffType.ATTACK_UP]: 'ATK',
  [BuffType.FIRE_RATE_UP]: 'SPD',
  [BuffType.SPEED_UP]: 'MOV',
  [BuffType.BARRAGE]: 'BRG',
};

/**
 * HUD描画（Iteration 2: バフ表示・仲間数・武器インジケータ）
 */
export class HUD {

  render(ctx: CanvasRenderingContext2D, state: HUDState): void {
    this.renderHPBar(ctx, state.hp, state.maxHp);
    this.renderActiveBuffs(ctx, state.activeBuffs);
    this.renderTimer(ctx, state.elapsedTime);
    this.renderKillCount(ctx, state.killCount);
    this.renderWave(ctx, state.wave);
    this.renderAllyCount(ctx, state.allyCount, state.maxAllies);
    this.renderWeaponIndicator(ctx, state.weaponType);
  }

  /** HPバー */
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

  /** アクティブバフアイコン + 残り時間バー */
  private renderActiveBuffs(ctx: CanvasRenderingContext2D, activeBuffs: Map<BuffType, { remainingTime: number }>): void {
    const startX = 16;
    const startY = 40;
    const iconW = 48;
    const iconH = 20;
    const barH = 4;
    const gap = 4;
    const duration = GAME_CONFIG.buff.duration;

    let index = 0;
    for (const [buffType, state] of activeBuffs) {
      const x = startX + index * (iconW + gap);
      const y = startY;
      const color = BUFF_COLORS[buffType] ?? '#FFFFFF';
      const label = BUFF_LABELS[buffType] ?? '?';

      // アイコン背景
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y, iconW, iconH);

      // アイコンラベル
      ctx.fillStyle = color;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + iconW / 2, y + iconH / 2);

      // 残り時間バー
      const ratio = Math.max(0, state.remainingTime / duration);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x, y + iconH + 1, iconW, barH);
      ctx.fillStyle = color;
      ctx.fillRect(x, y + iconH + 1, iconW * ratio, barH);

      index++;
    }
  }

  /** タイマー表示 */
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

  /** 撃破数表示 */
  private renderKillCount(ctx: CanvasRenderingContext2D, killCount: number): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`${killCount} kills`, 720 - 16, 36);
  }

  /** ウェーブ表示 */
  private renderWave(ctx: CanvasRenderingContext2D, wave: number): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`Wave ${wave}`, 720 - 16, 54);
  }

  /** 仲間数表示 */
  private renderAllyCount(ctx: CanvasRenderingContext2D, current: number, max: number): void {
    ctx.fillStyle = '#00CC00';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`Allies: ${current}/${max}`, 720 - 16, 74);
  }

  /** 武器インジケータ（左下） */
  private renderWeaponIndicator(ctx: CanvasRenderingContext2D, weaponType: WeaponType): void {
    const x = 16;
    const y = 1240;
    const label = WEAPON_LABELS[weaponType] ?? 'RIFLE';

    // 背景
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, 80, 24);

    // 枠
    ctx.strokeStyle = '#AAAAAA';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 80, 24);

    // テキスト
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 40, y + 12);
  }
}
