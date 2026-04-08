/** 共通型定義（domain-entities.md の6エンティティ、6値オブジェクト、5列挙型） */

// --- 基本型 ---

export type EntityId = number;

// --- 列挙型 ---

export enum GameState {
  TITLE = 'TITLE',
  PLAYING = 'PLAYING',
  LEVEL_UP = 'LEVEL_UP',
  GAME_OVER = 'GAME_OVER',
}

export enum EnemyType {
  NORMAL = 'NORMAL',
  FAST = 'FAST',
  TANK = 'TANK',
  BOSS = 'BOSS',
}

export enum WeaponType {
  FORWARD = 'FORWARD',
  SPREAD = 'SPREAD',
  PIERCING = 'PIERCING',
}

export enum EffectType {
  MUZZLE_FLASH = 'MUZZLE_FLASH',
  ENEMY_DESTROY = 'ENEMY_DESTROY',
}

export enum UpgradeCategory {
  WEAPON = 'WEAPON',
  PASSIVE = 'PASSIVE',
  ALLY = 'ALLY',
  HEAL = 'HEAL',
}

// --- 値オブジェクト ---

/** VO-01: 座標 */
export interface Position {
  x: number;
  y: number;
}

/** VO-02: 速度ベクトル */
export interface Velocity {
  vx: number;
  vy: number;
}

/** VO-03: 武器定義（不変値オブジェクト） */
export interface Weapon {
  weaponType: WeaponType;
  level: number; // 1-5
  fireInterval: number; // 秒
}

/** VO-03b: 武器発射状態（ミュータブル） */
export interface WeaponState {
  weaponType: WeaponType;
  lastFiredAt: number; // 秒
}

/** VO-04: パッシブスキル群 */
export interface PassiveSkills {
  speedLevel: number;
  maxHpLevel: number;
  attackLevel: number;
  xpGainLevel: number;
}

/** VO-05: スコアデータ */
export interface ScoreData {
  survivalTime: number;
  killCount: number;
  level: number;
}

/** VO-06: 強化選択肢 */
export interface UpgradeChoice {
  id: string;
  category: UpgradeCategory;
  upgradeType: string;
  currentLevel: number;
  nextLevel: number;
  description: string;
}

/** スポーン設定 */
export interface SpawnConfig {
  interval: number;
  enemyTypes: string[];
  hpMultiplier: number;
}

/** HUD表示用状態 */
export interface HUDState {
  hp: number;
  maxHp: number;
  xpCurrent: number;
  xpRequired: number;
  level: number;
  elapsedTime: number;
  killCount: number;
  wave: number;
}

/** コンポーネントタイプ識別子 */
export type ComponentClass<T = unknown> = new (...args: unknown[]) => T;

/** スプライトタイプ */
export type SpriteType =
  | 'player'
  | 'enemy_normal'
  | 'enemy_fast'
  | 'enemy_tank'
  | 'enemy_boss'
  | 'bullet'
  | 'xp_drop'
  | 'ally'
  | 'effect_muzzle'
  | 'effect_destroy';

/** 衝突判定タイプ */
export enum ColliderType {
  BULLET = 'BULLET',
  ENEMY = 'ENEMY',
  PLAYER = 'PLAYER',
}
