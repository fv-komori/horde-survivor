import { WAVE_DEFINITIONS, WAVE_SCALING, WAVE2_SPAWN_WEIGHTS, WAVE3_SPAWN_WEIGHTS } from '../config/waveConfig';
import { BOSS_CONFIG } from '../config/enemyConfig';
import type { SpawnConfig } from '../types';

/**
 * M-02: ウェーブ進行管理
 * business-logic-model セクション8
 * Iteration 2: ヒットカウントスケーリング・同時スポーン・90秒ボス間隔
 */
export class WaveManager {
  private currentWave: number = 1;
  private bossSpawnCount: number = 0;
  private bossTimer: number;

  /** ヒットカウント倍率: 30秒ごとに+0.1 */
  private hitCountMultiplier: number = 1.0;
  private hitCountScalingTimer: number = 0;

  /** Iter6: Wave 境目ボーナス発火済み時刻（秒）集合（B-NG-3 多重発火防止） */
  private readonly bonusFiredAt: Set<number> = new Set();

  constructor() {
    this.bossTimer = BOSS_CONFIG.firstSpawnTime;
  }

  /** Iter6: 指定時刻のボーナスが既に発火済みか */
  hasBonusFired(t: number): boolean {
    return this.bonusFiredAt.has(t);
  }

  /** Iter6: ボーナス発火時刻を記録 */
  markBonusFired(t: number): void {
    this.bonusFiredAt.add(t);
  }

  /** ウェーブ進行を更新 */
  update(elapsedTime: number): void {
    // ウェーブ判定（Iteration 2: ウェーブ定義テーブルに基づく）
    if (elapsedTime < 45) {
      this.currentWave = 1;
    } else if (elapsedTime < 90) {
      this.currentWave = 2;
    } else if (elapsedTime < 180) {
      this.currentWave = 3;
    } else {
      // ウェーブ4以降: 30秒ごとにカウントアップ
      this.currentWave = 4 + Math.floor((elapsedTime - WAVE_SCALING.scalingStartTime) / WAVE_SCALING.scalingInterval);
    }

    // ヒットカウント倍率更新: 30秒ごとに+0.1
    const scalingSteps = Math.floor(elapsedTime / 30);
    this.hitCountMultiplier = 1.0 + scalingSteps * WAVE_SCALING.hitCountScalingIncrement;
  }

  getCurrentWave(): number {
    return this.currentWave;
  }

  getHitCountMultiplier(): number {
    return this.hitCountMultiplier;
  }

  /** 現在のスポーン設定を取得 */
  getSpawnConfig(elapsedTime: number): SpawnConfig {
    // ウェーブ1-3: 定義テーブルから
    for (const wave of WAVE_DEFINITIONS) {
      if (elapsedTime >= wave.startTime && elapsedTime < wave.endTime) {
        return {
          interval: wave.spawnInterval,
          enemyTypes: wave.enemyTypes,
          simultaneousCount: wave.simultaneousCount,
          hitCountMultiplier: this.hitCountMultiplier,
        };
      }
    }

    // ウェーブ4以降: スケーリング（BR-E04）
    const timeSinceScaling = elapsedTime - WAVE_SCALING.scalingStartTime;
    const scalingSteps = Math.floor(timeSinceScaling / WAVE_SCALING.scalingInterval);

    const interval = Math.max(
      WAVE_SCALING.minSpawnInterval,
      0.5 - scalingSteps * WAVE_SCALING.spawnIntervalDecrement,
    );

    const simultaneousCount = Math.min(
      WAVE_SCALING.maxSimultaneousCount,
      3 + Math.floor(scalingSteps / 2),
    );

    return {
      interval,
      enemyTypes: ['NORMAL', 'FAST', 'TANK'],
      simultaneousCount,
      hitCountMultiplier: this.hitCountMultiplier,
    };
  }

  /** 敵タイプを重み付きランダムで選択 */
  selectEnemyType(availableTypes: string[]): string {
    // ウェーブ1: 単一タイプ
    if (availableTypes.length === 1) return availableTypes[0];

    // ウェーブ2: NORMAL/FAST重み
    if (!availableTypes.includes('TANK')) {
      const weights = WAVE2_SPAWN_WEIGHTS;
      const totalWeight = availableTypes.reduce(
        (sum, type) => sum + (weights[type] ?? 0), 0
      );
      let roll = Math.random() * totalWeight;
      for (const type of availableTypes) {
        roll -= weights[type] ?? 0;
        if (roll <= 0) return type;
      }
      return availableTypes[0];
    }

    // ウェーブ3以降: 重み付き（business-logic-model 8.2）
    const weights = WAVE3_SPAWN_WEIGHTS;
    const totalWeight = availableTypes.reduce(
      (sum, type) => sum + (weights[type] ?? 0), 0
    );
    let roll = Math.random() * totalWeight;
    for (const type of availableTypes) {
      roll -= weights[type] ?? 0;
      if (roll <= 0) return type;
    }
    return availableTypes[0];
  }

  /** ボスのスポーン判定（90秒間隔） */
  shouldSpawnBoss(dt: number, elapsedTime: number): boolean {
    if (elapsedTime < BOSS_CONFIG.firstSpawnTime) return false;

    this.bossTimer -= dt;
    if (this.bossTimer <= 0) {
      this.bossTimer = BOSS_CONFIG.spawnInterval;
      return true;
    }
    return false;
  }

  /** ボス生成回数を取得（スケーリング用） */
  getBossSpawnCount(): number {
    this.bossSpawnCount++;
    return this.bossSpawnCount;
  }

  reset(): void {
    this.currentWave = 1;
    this.bossSpawnCount = 0;
    this.bossTimer = BOSS_CONFIG.firstSpawnTime;
    this.hitCountMultiplier = 1.0;
    this.hitCountScalingTimer = 0;
    this.bonusFiredAt.clear();
  }
}
