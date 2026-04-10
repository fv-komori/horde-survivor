import type { ScoreData } from '../types';

/**
 * S-SVC-02: スコア集計サービス
 * 生存時間、撃破数、仲間数（BR-SC01）
 * Iteration 2: レベル廃止 → 仲間数追跡
 */
export class ScoreService {
  private survivalTime: number = 0;
  private killCount: number = 0;
  private allyCount: number = 0;

  reset(): void {
    this.survivalTime = 0;
    this.killCount = 0;
    this.allyCount = 0;
  }

  incrementKills(): void {
    this.killCount++;
  }

  /** PLAYING状態時のみ呼び出す */
  updateElapsedTime(dt: number): void {
    this.survivalTime += dt;
  }

  setAllyCount(count: number): void {
    this.allyCount = count;
  }

  getScore(): ScoreData {
    return {
      survivalTime: this.survivalTime,
      killCount: this.killCount,
      allyCount: this.allyCount,
    };
  }

  getElapsedTime(): number {
    return this.survivalTime;
  }

  getKillCount(): number {
    return this.killCount;
  }
}
