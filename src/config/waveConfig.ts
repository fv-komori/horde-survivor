/** ウェーブ定義（Iteration 2: 短縮間隔・同時スポーン・ヒット数スケーリング） */

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

export interface WaveDefinition {
  startTime: number;          // 秒
  endTime: number;            // 秒（Infinityでエンドレス）
  enemyTypes: string[];
  spawnInterval: number;      // 秒
  simultaneousCount: number;  // 同時スポーン数
}

/** ウェーブ定義テーブル（FR-02-C） */
export const WAVE_DEFINITIONS: readonly WaveDefinition[] = deepFreeze([
  {
    startTime: 0,
    endTime: 45,
    enemyTypes: ['NORMAL'],
    spawnInterval: 1.0,
    simultaneousCount: 1,
  },
  {
    startTime: 45,
    endTime: 90,
    enemyTypes: ['NORMAL', 'FAST'],
    spawnInterval: 0.7,
    simultaneousCount: 2,
  },
  {
    startTime: 90,
    endTime: 180,
    enemyTypes: ['NORMAL', 'FAST', 'TANK'],
    spawnInterval: 0.5,
    simultaneousCount: 3,
  },
]);

/** ウェーブ4以降のスケーリング設定（BR-E04, BR-HC04） */
export const WAVE_SCALING = deepFreeze({
  scalingStartTime: 180,          // 3:00
  spawnIntervalDecrement: 0.05,   // 30秒ごとに-0.05秒
  minSpawnInterval: 0.15,
  hitCountScalingIncrement: 0.1,  // 30秒ごとに+10%
  scalingInterval: 30,
  maxSimultaneousCount: 5,
});

/** 敵出現確率（ウェーブ2） */
export const WAVE2_SPAWN_WEIGHTS: Record<string, number> = deepFreeze({
  NORMAL: 60,
  FAST: 40,
});

/** 敵出現確率（ウェーブ3以降） */
export const WAVE3_SPAWN_WEIGHTS: Record<string, number> = deepFreeze({
  NORMAL: 50,
  FAST: 30,
  TANK: 20,
});
