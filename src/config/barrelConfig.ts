/** 武器樽アイテム定義（Iter6 Phase 2b: 新規、components-v6 C6-11） */

import { BarrelItemType } from '../types';

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

export interface BarrelHpConfig {
  baseHp: number;
  /** Iter6 では 1 固定。将来 Wave 連動余地を残す型 */
  waveScale?: number;
}

export const BARREL_HP: Record<BarrelItemType, BarrelHpConfig> = deepFreeze({
  [BarrelItemType.WEAPON_RIFLE]: { baseHp: 30, waveScale: 1 },
  [BarrelItemType.WEAPON_SHOTGUN]: { baseHp: 40, waveScale: 1 },
  [BarrelItemType.WEAPON_MACHINEGUN]: { baseHp: 50, waveScale: 1 },
});

/** 樽スポーン間隔（秒、均等 [min, max] 乱択）とその他パラメータ */
export const BARREL_SPAWN = deepFreeze({
  initialOffset: 12,
  intervalMin: 12,
  intervalMax: 15,
  maxConcurrent: 3,
  /** Wave 境目ボーナス時、同時上限 +1 許容 */
  bonusConcurrentBonus: 1,
});
