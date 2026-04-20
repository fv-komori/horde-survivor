/** 敵タイプ別パラメータ定義（Iter6 Phase 2a: itemDropRate/weaponDropRate/conversionRate 削除） */

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
  hitCount: number;
  speed: number;
  breachDamage: number;
  colliderRadius: number;
}

export const ENEMY_CONFIG: Record<string, EnemyTypeConfig> = deepFreeze({
  NORMAL: {
    hitCount: 20,
    speed: 100,
    breachDamage: 10,
    colliderRadius: 60,
  },
  FAST: {
    hitCount: 10,
    speed: 200,
    breachDamage: 8,
    colliderRadius: 60,
  },
  TANK: {
    hitCount: 60,
    speed: 50,
    breachDamage: 15,
    colliderRadius: 80,
  },
  BOSS: {
    hitCount: 500,
    speed: 30,
    breachDamage: 30,
    colliderRadius: 110,
  },
});

/** ボス設定（BR-E03） */
export const BOSS_CONFIG = deepFreeze({
  baseHitCount: 500,
  spawnInterval: 90,
  firstSpawnTime: 90,
});
