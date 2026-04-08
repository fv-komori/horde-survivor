/** ウェーブ定義（business-logic-model セクション8） */

/** オブジェクトを再帰的に凍結する */
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
  startTime: number;     // 秒
  endTime: number;       // 秒（Infinityでエンドレス）
  enemyTypes: string[];
  spawnInterval: number; // 秒
  hpMultiplier: number;
}

/** ウェーブ定義テーブル（FR-02） */
export const WAVE_DEFINITIONS: readonly WaveDefinition[] = deepFreeze([
  {
    startTime: 0,
    endTime: 60,
    enemyTypes: ['NORMAL'],
    spawnInterval: 2.0,
    hpMultiplier: 1.0,
  },
  {
    startTime: 60,
    endTime: 150,
    enemyTypes: ['NORMAL', 'FAST'],
    spawnInterval: 1.5,
    hpMultiplier: 1.0,
  },
  {
    startTime: 150,
    endTime: 270,
    enemyTypes: ['NORMAL', 'FAST', 'TANK'],
    spawnInterval: 1.0,
    hpMultiplier: 1.0,
  },
]);

/** ウェーブ4以降のスケーリング設定（BR-E04） */
export const WAVE_SCALING = deepFreeze({
  /** ウェーブ4開始時間 */
  scalingStartTime: 270, // 4:30
  /** スポーン間隔の減少（30秒ごと） */
  spawnIntervalDecrement: 0.05,
  /** スポーン間隔の最小値 */
  minSpawnInterval: 0.3,
  /** 敵HPの増加率（30秒ごと） */
  hpMultiplierIncrement: 0.05,
  /** スケーリング間隔（秒） */
  scalingInterval: 30,
});

/** ウェーブ3以降の敵出現確率（business-logic-model 8.2） */
export const ENEMY_SPAWN_WEIGHTS: Record<string, number> = deepFreeze({
  NORMAL: 50,
  FAST: 30,
  TANK: 20,
});

/** XP必要量テーブル（business-logic-model 7.2） - Lv1→2 の累積XP, Lv2→3, ... */
export const XP_TABLE: number[] = [
  30,    // Lv1→2
  70,    // Lv2→3
  125,   // Lv3→4
  200,   // Lv4→5
  300,   // Lv5→6
  430,   // Lv6→7
  600,   // Lv7→8
  820,   // Lv8→9
  1100,  // Lv9→10
  1450,  // Lv10→11
  1900,  // Lv11→12
  2450,  // Lv12→13
  3150,  // Lv13→14
  4000,  // Lv14→15
];

/** Lv15以降の差分固定値 */
export const XP_TABLE_OVERFLOW_INCREMENT = 1000;
