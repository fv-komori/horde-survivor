/** アイテムドロップ・バフ設定（Iteration 2: FR-03） */

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

/** パワーアップアイテムのドロップウェイト（BR-ID02） */
export const POWERUP_DROP_WEIGHTS: Record<string, number> = deepFreeze({
  ATTACK_UP: 30,
  FIRE_RATE_UP: 30,
  SPEED_UP: 20,
  BARRAGE: 20,
});

/** 武器ドロップの対象（BR-ID03: 現在装備以外からランダム選択） */
export const WEAPON_DROP_TYPES = ['WEAPON_SPREAD', 'WEAPON_PIERCING'] as const;
