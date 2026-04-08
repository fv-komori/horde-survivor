/** 敵タイプ別パラメータ定義（FR-02, domain-entities EnemyType） */

export interface EnemyTypeConfig {
  hp: number;
  speed: number;         // px/秒
  breachDamage: number;
  xpDrop: number;
  colliderRadius: number;
}

export const ENEMY_CONFIG: Record<string, EnemyTypeConfig> = {
  NORMAL: {
    hp: 20,
    speed: 80,
    breachDamage: 10,
    xpDrop: 10,
    colliderRadius: 12,
  },
  FAST: {
    hp: 10,
    speed: 160,
    breachDamage: 8,
    xpDrop: 15,
    colliderRadius: 12,
  },
  TANK: {
    hp: 60,
    speed: 40,
    breachDamage: 15,
    xpDrop: 25,
    colliderRadius: 20,
  },
  BOSS: {
    hp: 500,
    speed: 30,
    breachDamage: 30,
    xpDrop: 200,
    colliderRadius: 40,
  },
} as const;

/** ボススケーリング設定（BR-E03） */
export const BOSS_SCALING = {
  baseHp: 500,
  hpScalingPerSpawn: 0.5,      // 毎回+50%
  baseDamage: 30,
  damageScalingPerSpawn: 0.3,  // 毎回+30%
  xpDrop: 200,                 // 固定
  spawnInterval: 120,          // 秒（2分間隔）
  firstSpawnTime: 120,         // 秒（2分後）
} as const;
