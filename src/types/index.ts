/** 共通型定義（Iter6 Phase 2b: WeaponGenre / BarrelItemType / GateType への置換） */

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

/** 武器ジャンル（Iter6: 旧 WeaponType を置換） */
export enum WeaponGenre {
  RIFLE = 'RIFLE',
  SHOTGUN = 'SHOTGUN',
  MACHINEGUN = 'MACHINEGUN',
}

/** 武器樽アイテム種別（Iter6: 新規、BarrelItem を撃破してプレイヤーの武器を切替） */
export enum BarrelItemType {
  WEAPON_RIFLE = 'WEAPON_RIFLE',
  WEAPON_SHOTGUN = 'WEAPON_SHOTGUN',
  WEAPON_MACHINEGUN = 'WEAPON_MACHINEGUN',
}

/** BarrelItemType → WeaponGenre 変換 */
export function barrelItemTypeToGenre(type: BarrelItemType): WeaponGenre {
  switch (type) {
    case BarrelItemType.WEAPON_RIFLE: return WeaponGenre.RIFLE;
    case BarrelItemType.WEAPON_SHOTGUN: return WeaponGenre.SHOTGUN;
    case BarrelItemType.WEAPON_MACHINEGUN: return WeaponGenre.MACHINEGUN;
  }
}

/** ゲート効果種別（Iter6: 新規、プレイヤー通過で発動） */
export enum GateType {
  ALLY_ADD = 'ALLY_ADD',
  ATTACK_UP = 'ATTACK_UP',
  SPEED_UP = 'SPEED_UP',
  HEAL = 'HEAL',
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

export enum ControlType {
  BUTTONS = 'buttons',
  SWIPE = 'swipe',
  BOTH = 'both',
}

// --- 値オブジェクト ---

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

/** VO-03: 武器定義 */
export interface WeaponParams {
  weaponGenre: WeaponGenre;
  fireInterval: number;
  bulletCount: number;
  bulletSpeed: number;
  spreadAngle: number;
  isPiercing: boolean;
}

export interface BuffState {
  remainingTime: number;
}

export interface ScoreData {
  survivalTime: number;
  killCount: number;
  allyCount: number;
}

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
  weaponGenre: WeaponGenre;
}

export type ComponentClass<T = unknown> = new (...args: unknown[]) => T;

/** スプライトタイプ */
export type SpriteType =
  | 'player'
  | 'enemy_normal'
  | 'enemy_fast'
  | 'enemy_tank'
  | 'enemy_boss'
  | 'bullet'
  | 'ally'
  | 'effect_muzzle'
  | 'effect_destroy'
  | 'effect_buff'
  | 'effect_ally_convert';

/** 衝突判定タイプ（Iter6: ITEM を削除、BARREL/GATE は Phase 3 で追加） */
export enum ColliderType {
  BULLET = 'BULLET',
  ENEMY = 'ENEMY',
  PLAYER = 'PLAYER',
}

/** バフタイプの色マッピング */
export const BUFF_COLORS: Record<BuffType, string> = {
  [BuffType.ATTACK_UP]: '#FF4444',
  [BuffType.FIRE_RATE_UP]: '#FFFF44',
  [BuffType.SPEED_UP]: '#4444FF',
  [BuffType.BARRAGE]: '#CC44CC',
};
