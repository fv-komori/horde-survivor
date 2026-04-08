import { WAVE_DEFINITIONS, WAVE_SCALING, ENEMY_SPAWN_WEIGHTS } from '../config/waveConfig';
import { BOSS_SCALING } from '../config/enemyConfig';
import type { SpawnConfig } from '../types';

/**
 * M-02: ウェーブ進行管理
 * business-logic-model セクション8
 */
export class WaveManager {
  private currentWave: number = 1;
  private bossSpawnCount: number = 0;
  private bossTimer: number;

  constructor() {
    this.bossTimer = BOSS_SCALING.firstSpawnTime;
  }

  /** ウェーブ進行を更新 */
  update(elapsedTime: number): void {
    // ウェーブ判定
    if (elapsedTime < 60) {
      this.currentWave = 1;
    } else if (elapsedTime < 150) {
      this.currentWave = 2;
    } else if (elapsedTime < 270) {
      this.currentWave = 3;
    } else {
      // ウェーブ4以降: 30秒ごとにカウントアップ
      this.currentWave = 4 + Math.floor((elapsedTime - 270) / WAVE_SCALING.scalingInterval);
    }
  }

  getCurrentWave(): number {
    return this.currentWave;
  }

  /** 現在のスポーン設定を取得 */
  getSpawnConfig(elapsedTime: number): SpawnConfig {
    // ウェーブ1-3: 定義テーブルから
    for (const wave of WAVE_DEFINITIONS) {
      if (elapsedTime >= wave.startTime && elapsedTime < wave.endTime) {
        return {
          interval: wave.spawnInterval,
          enemyTypes: wave.enemyTypes,
          hpMultiplier: wave.hpMultiplier,
        };
      }
    }

    // ウェーブ4以降: スケーリング（BR-E04）
    const timeSinceScaling = elapsedTime - WAVE_SCALING.scalingStartTime;
    const scalingSteps = Math.floor(timeSinceScaling / WAVE_SCALING.scalingInterval);

    const interval = Math.max(
      WAVE_SCALING.minSpawnInterval,
      1.0 - scalingSteps * WAVE_SCALING.spawnIntervalDecrement,
    );
    const hpMultiplier = 1.0 + scalingSteps * WAVE_SCALING.hpMultiplierIncrement;

    return {
      interval,
      enemyTypes: ['NORMAL', 'FAST', 'TANK'],
      hpMultiplier,
    };
  }

  /** ウェーブ3以降の敵タイプを重み付きランダムで選択 */
  selectEnemyType(availableTypes: string[]): string {
    // ウェーブ1-2はavailableTypesから均等ランダム
    if (availableTypes.length === 1) return availableTypes[0];
    if (!availableTypes.includes('TANK')) {
      // ウェーブ2: NORMAL/FASTから均等
      return availableTypes[Math.floor(Math.random() * availableTypes.length)];
    }

    // ���ェーブ3以降: 重み付き（business-logic-model 8.2）
    const totalWeight = availableTypes.reduce(
      (sum, type) => sum + (ENEMY_SPAWN_WEIGHTS[type] ?? 0), 0
    );
    let roll = Math.random() * totalWeight;
    for (const type of availableTypes) {
      roll -= ENEMY_SPAWN_WEIGHTS[type] ?? 0;
      if (roll <= 0) return type;
    }
    return availableTypes[0];
  }

  /** ボスのスポーン判定（タイマー方式） */
  shouldSpawnBoss(dt: number, elapsedTime: number): boolean {
    if (elapsedTime < BOSS_SCALING.firstSpawnTime) return false;

    this.bossTimer -= dt;
    if (this.bossTimer <= 0) {
      this.bossTimer = BOSS_SCALING.spawnInterval;
      return true;
    }
    return false;
  }

  /** ボス生成時のスケーリングパラメータを取得（BR-E03） */
  getBossParams(): { hp: number; damage: number; xpDrop: number } {
    this.bossSpawnCount++;
    const count = this.bossSpawnCount;
    return {
      hp: Math.round(BOSS_SCALING.baseHp * (1 + (count - 1) * BOSS_SCALING.hpScalingPerSpawn)),
      damage: Math.round(BOSS_SCALING.baseDamage * (1 + (count - 1) * BOSS_SCALING.damageScalingPerSpawn)),
      xpDrop: BOSS_SCALING.xpDrop,
    };
  }

  reset(): void {
    this.currentWave = 1;
    this.bossSpawnCount = 0;
    this.bossTimer = BOSS_SCALING.firstSpawnTime;
  }
}
