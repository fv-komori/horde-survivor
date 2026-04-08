/** 武器タイプ別・レベル別パラメータ定義（business-logic-model セクション4） */

export interface WeaponLevelConfig {
  damage: number;
  fireInterval: number;  // 秒
  bulletCount: number;
  bulletSpeed: number;   // px/秒
  piercing: boolean;
  spreadAngle?: number;  // 度（拡散射撃用）
}

export interface WeaponTypeConfig {
  levels: WeaponLevelConfig[];
  bulletOffset: number;  // 複数弾の水平オフセット(px)
}

/** 前方射撃（FORWARD）- 初期装備 */
const FORWARD_CONFIG: WeaponTypeConfig = {
  bulletOffset: 20,
  levels: [
    { damage: 10, fireInterval: 0.50, bulletCount: 1, bulletSpeed: 600, piercing: false },
    { damage: 13, fireInterval: 0.45, bulletCount: 1, bulletSpeed: 600, piercing: false },
    { damage: 17, fireInterval: 0.40, bulletCount: 2, bulletSpeed: 600, piercing: false },
    { damage: 22, fireInterval: 0.35, bulletCount: 2, bulletSpeed: 650, piercing: false },
    { damage: 30, fireInterval: 0.30, bulletCount: 3, bulletSpeed: 700, piercing: false },
  ],
};

/** 拡散射撃（SPREAD）- 広範囲型 */
const SPREAD_CONFIG: WeaponTypeConfig = {
  bulletOffset: 0,
  levels: [
    { damage: 7,  fireInterval: 0.70, bulletCount: 3, bulletSpeed: 500, piercing: false, spreadAngle: 60 },
    { damage: 9,  fireInterval: 0.65, bulletCount: 3, bulletSpeed: 500, piercing: false, spreadAngle: 70 },
    { damage: 12, fireInterval: 0.60, bulletCount: 5, bulletSpeed: 500, piercing: false, spreadAngle: 80 },
    { damage: 15, fireInterval: 0.55, bulletCount: 5, bulletSpeed: 550, piercing: false, spreadAngle: 90 },
    { damage: 20, fireInterval: 0.50, bulletCount: 7, bulletSpeed: 600, piercing: false, spreadAngle: 120 },
  ],
};

/** 貫通弾（PIERCING）- 高ダメージ型 */
const PIERCING_CONFIG: WeaponTypeConfig = {
  bulletOffset: 20,
  levels: [
    { damage: 25, fireInterval: 1.20, bulletCount: 1, bulletSpeed: 400, piercing: true },
    { damage: 33, fireInterval: 1.10, bulletCount: 1, bulletSpeed: 400, piercing: true },
    { damage: 42, fireInterval: 1.00, bulletCount: 1, bulletSpeed: 450, piercing: true },
    { damage: 55, fireInterval: 0.90, bulletCount: 2, bulletSpeed: 450, piercing: true },
    { damage: 70, fireInterval: 0.80, bulletCount: 2, bulletSpeed: 500, piercing: true },
  ],
};

export const WEAPON_CONFIG: Record<string, WeaponTypeConfig> = {
  FORWARD: FORWARD_CONFIG,
  SPREAD: SPREAD_CONFIG,
  PIERCING: PIERCING_CONFIG,
} as const;
