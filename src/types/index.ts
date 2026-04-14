/** 共通型定義（Iteration 2: ヒットカウント制・アイテムドロップ・バフ・仲間化） */

// --- 基本型 ---

export type EntityId = number;

// --- 列挙型 ---

export enum GameState {
  TITLE = 'TITLE',
  PLAYING = 'PLAYING',
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
  BUFF_ACTIVATE = 'BUFF_ACTIVATE',
  ALLY_CONVERT = 'ALLY_CONVERT',
}

export enum BuffType {
  ATTACK_UP = 'ATTACK_UP',
  FIRE_RATE_UP = 'FIRE_RATE_UP',
  SPEED_UP = 'SPEED_UP',
  BARRAGE = 'BARRAGE',
}

export enum ItemType {
  ATTACK_UP = 'ATTACK_UP',
  FIRE_RATE_UP = 'FIRE_RATE_UP',
  SPEED_UP = 'SPEED_UP',
  BARRAGE = 'BARRAGE',
  WEAPON_SPREAD = 'WEAPON_SPREAD',
  WEAPON_PIERCING = 'WEAPON_PIERCING',
}

export enum ControlType {
  BUTTONS = 'buttons',
  SWIPE = 'swipe',
  BOTH = 'both',
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

/** VO-03: 武器定義（固定パラメータ、レベルなし） */
export interface WeaponParams {
  weaponType: WeaponType;
  fireInterval: number;
  bulletCount: number;
  bulletSpeed: number;
  spreadAngle: number;
  isPiercing: boolean;
}

/** VO-04: バフ状態 */
export interface BuffState {
  remainingTime: number;
}

/** VO-05: スコアデータ */
export interface ScoreData {
  survivalTime: number;
  killCount: number;
  allyCount: number;
}

/** スポーン設定 */
export interface SpawnConfig {
  interval: number;
  enemyTypes: string[];
  simultaneousCount: number;
  hitCountMultiplier: number;
}

/** HUD表示用状態 */
export interface HUDState {
  hp: number;
  maxHp: number;
  elapsedTime: number;
  killCount: number;
  wave: number;
  activeBuffs: Map<BuffType, BuffState>;
  allyCount: number;
  maxAllies: number;
  weaponType: WeaponType;
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
  | 'item_drop'
  | 'ally'
  | 'effect_muzzle'
  | 'effect_destroy'
  | 'effect_buff'
  | 'effect_ally_convert';

/** 衝突判定タイプ */
export enum ColliderType {
  BULLET = 'BULLET',
  ENEMY = 'ENEMY',
  PLAYER = 'PLAYER',
  ITEM = 'ITEM',
}

/** バフタイプからアイテムタイプへのマッピングヘルパー */
export function itemTypeToBuff(itemType: ItemType): BuffType | null {
  switch (itemType) {
    case ItemType.ATTACK_UP: return BuffType.ATTACK_UP;
    case ItemType.FIRE_RATE_UP: return BuffType.FIRE_RATE_UP;
    case ItemType.SPEED_UP: return BuffType.SPEED_UP;
    case ItemType.BARRAGE: return BuffType.BARRAGE;
    default: return null;
  }
}

/** アイテムタイプから武器タイプへのマッピングヘルパー */
export function itemTypeToWeapon(itemType: ItemType): WeaponType | null {
  switch (itemType) {
    case ItemType.WEAPON_SPREAD: return WeaponType.SPREAD;
    case ItemType.WEAPON_PIERCING: return WeaponType.PIERCING;
    default: return null;
  }
}

/** バフタイプの色マッピング */
export const BUFF_COLORS: Record<BuffType, string> = {
  [BuffType.ATTACK_UP]: '#FF4444',
  [BuffType.FIRE_RATE_UP]: '#FFFF44',
  [BuffType.SPEED_UP]: '#4444FF',
  [BuffType.BARRAGE]: '#CC44CC',
};

/** アイテムタイプの色マッピング */
export const ITEM_COLORS: Record<ItemType, string> = {
  [ItemType.ATTACK_UP]: '#FF4444',
  [ItemType.FIRE_RATE_UP]: '#FFFF44',
  [ItemType.SPEED_UP]: '#4444FF',
  [ItemType.BARRAGE]: '#CC44CC',
  [ItemType.WEAPON_SPREAD]: '#88FF88',
  [ItemType.WEAPON_PIERCING]: '#FF8844',
};
