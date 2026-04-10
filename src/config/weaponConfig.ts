/** 武器タイプ別パラメータ定義（Iteration 2: レベルなし固定パラメータ） */

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

export interface WeaponTypeConfig {
  fireInterval: number;    // 秒
  bulletCount: number;
  bulletSpeed: number;     // px/秒
  spreadAngle: number;     // 度（0=直線）
  isPiercing: boolean;
  bulletOffset: number;    // 複数弾の水平オフセット(px)
}

export const WEAPON_CONFIG: Record<string, WeaponTypeConfig> = deepFreeze({
  FORWARD: {
    fireInterval: 0.15,
    bulletCount: 1,
    bulletSpeed: 600,
    spreadAngle: 0,
    isPiercing: false,
    bulletOffset: 20,
  },
  SPREAD: {
    fireInterval: 0.25,
    bulletCount: 3,
    bulletSpeed: 500,
    spreadAngle: 60,
    isPiercing: false,
    bulletOffset: 0,
  },
  PIERCING: {
    fireInterval: 0.4,
    bulletCount: 1,
    bulletSpeed: 400,
    spreadAngle: 0,
    isPiercing: true,
    bulletOffset: 20,
  },
});
