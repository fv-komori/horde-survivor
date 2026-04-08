import type { ScoreData } from '../types';

/**
 * S-SVC-02: スコア集計サービス
 * 生存時間、撃破数、到達レベル（BR-SC01）
 */
export class ScoreService {
  private survivalTime: number = 0;
  private killCount: number = 0;
  private level: number = 1;

  reset(): void {
    this.survivalTime = 0;
    this.killCount = 0;
    this.level = 1;
  }

  incrementKills(): void {
    this.killCount++;
  }

  /** PLAYING状態時のみ呼び出す（BR-SC01: LEVEL_UP中は含まない） */
  updateElapsedTime(dt: number): void {
    this.survivalTime += dt;
  }

  setLevel(level: number): void {
    this.level = level;
  }

  getScore(): ScoreData {
    return {
      survivalTime: this.survivalTime,
      killCount: this.killCount,
      level: this.level,
    };
  }

  getElapsedTime(): number {
    return this.survivalTime;
  }

  getKillCount(): number {
    return this.killCount;
  }
}
