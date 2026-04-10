/** 敵タイプ別パラメータ定義（Iteration 2: ヒットカウント制） */

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

export interface EnemyTypeConfig {
  hitCount: number;          // ベースヒットカウント
  speed: number;             // px/秒
  breachDamage: number;
  itemDropRate: number;      // パワーアップドロップ確率 (0.0-1.0)
  weaponDropRate: number;    // 武器ドロップ確率 (0.0-1.0)
  conversionRate: number;    // 仲間化確率 (0.0-1.0)
  colliderRadius: number;
}

export const ENEMY_CONFIG: Record<string, EnemyTypeConfig> = deepFreeze({
  NORMAL: {
    hitCount: 5,
    speed: 100,
    breachDamage: 10,
    itemDropRate: 0.30,
    weaponDropRate: 0.05,
    conversionRate: 0.10,
    colliderRadius: 60,
  },
  FAST: {
    hitCount: 2,
    speed: 200,
    breachDamage: 8,
    itemDropRate: 0.35,
    weaponDropRate: 0.05,
    conversionRate: 0.08,
    colliderRadius: 60,
  },
  TANK: {
    hitCount: 15,
    speed: 50,
    breachDamage: 15,
    itemDropRate: 0.50,
    weaponDropRate: 0.05,
    conversionRate: 0.05,
    colliderRadius: 80,
  },
  BOSS: {
    hitCount: 100,
    speed: 30,
    breachDamage: 30,
    itemDropRate: 1.0,
    weaponDropRate: 0.05,
    conversionRate: 0.0,
    colliderRadius: 110,
  },
});

/** ボス設定（BR-E03） */
export const BOSS_CONFIG = deepFreeze({
  baseHitCount: 100,
  spawnInterval: 90,       // 秒（1分30秒間隔）
  firstSpawnTime: 90,      // 秒（1分30秒後）
  bossDropCount: { min: 2, max: 3 }, // ボス撃破時のドロップ数
});
