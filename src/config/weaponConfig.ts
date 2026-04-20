/** 武器ジャンル別パラメータ定義（Iter6 Phase 2b: WeaponGenre ベースに再設計） */

import { WeaponGenre } from '../types';

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

export interface WeaponGenreConfig {
  fireInterval: number;
  bulletCount: number;
  bulletSpeed: number;
  spreadAngle: number;
  isPiercing: boolean;
  bulletOffset: number;
}

/** 武器ジャンル別パラメータ（Iter6: RIFLE / SHOTGUN / MACHINEGUN の 3 種） */
export const WEAPON_PARAMS: Record<WeaponGenre, WeaponGenreConfig> = deepFreeze({
  [WeaponGenre.RIFLE]: {
    fireInterval: 0.15,
    bulletCount: 1,
    bulletSpeed: 600,
    spreadAngle: 0,
    isPiercing: false,
    bulletOffset: 20,
  },
  [WeaponGenre.SHOTGUN]: {
    fireInterval: 0.35,
    bulletCount: 5,
    bulletSpeed: 500,
    spreadAngle: 60,
    isPiercing: false,
    bulletOffset: 0,
  },
  [WeaponGenre.MACHINEGUN]: {
    fireInterval: 0.07,
    bulletCount: 1,
    bulletSpeed: 650,
    spreadAngle: 8,
    isPiercing: false,
    bulletOffset: 20,
  },
});
