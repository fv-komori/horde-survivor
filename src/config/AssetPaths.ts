/** Iter5: glTF/glb アセットパス定数（FR-01, NFR-09 整合: 相対パス＋'self' scope 内） */

const BASE = '/models/toon-shooter/v1';

export const CHARACTER_PATHS = {
  SOLDIER: `${BASE}/characters/Character_Soldier.glb`,
  ENEMY: `${BASE}/characters/Character_Enemy.glb`,
  HAZMAT: `${BASE}/characters/Character_Hazmat.glb`,
} as const;

export const GUN_PATHS = {
  AK: `${BASE}/guns/AK.glb`,
  Pistol: `${BASE}/guns/Pistol.glb`,
  Shotgun: `${BASE}/guns/Shotgun.glb`,
} as const;

export const ENV_PATHS = {
  Barrier_Single: `${BASE}/environment/Barrier_Single.glb`,
  Crate: `${BASE}/environment/Crate.glb`,
  SackTrench: `${BASE}/environment/SackTrench.glb`,
  Fence: `${BASE}/environment/Fence.glb`,
  Fence_Long: `${BASE}/environment/Fence_Long.glb`,
  Tree_1: `${BASE}/environment/Tree_1.glb`,
} as const;

export type CharacterKey = keyof typeof CHARACTER_PATHS;
export type GunKey = keyof typeof GUN_PATHS;
export type EnvKey = keyof typeof ENV_PATHS;
