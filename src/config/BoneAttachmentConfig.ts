import { Euler, Vector3 } from 'three';
import type { CharacterKey } from './AssetPaths';

/**
 * Iter5 Day 1 調査結果（bone=LowerArm.R 確定、3キャラ共通）:
 *   - Toon Shooter Game Kit のキャラは Hand bone を持たない
 *   - 武器 attach 先は右前腕（Blender 表記 `LowerArm.R`）を採用
 *   - three.js GLTFLoader は bone 名の `.` を削除してサニタイズするため、
 *     ランタイムでは `LowerArmR` として参照する（Day 2 動作確認時に判明）
 *   - 3キャラ共通のため BoneAttachmentConfig は実質 1 パターン
 *   - offset / rotation は実アセットと目視で合わせる（Construction中に調整可）
 */
export interface BoneAttachment {
  handBone: string;
  offset: Vector3;
  rotation: Euler;
}

/** 3キャラ共通 attach（Day 1-1 調査確定値、three.js サニタイズ後の bone 名 `LowerArmR`） */
const COMMON: BoneAttachment = {
  handBone: 'LowerArmR',
  offset: new Vector3(0.05, 0.05, 0.0),
  rotation: new Euler(0, 0, 0),
};

export const BONE_ATTACH: Record<CharacterKey, BoneAttachment> = {
  SOLDIER: COMMON,
  ENEMY: COMMON,
  HAZMAT: COMMON,
};

/** アニメ長の実測値（Day 1-2 調査、3キャラで完全一致、秒単位） */
export const ANIM_DURATIONS = {
  Death: 0.767,
  Duck: 0.333,
  HitReact: 0.433,
  Idle: 1.367,
  Idle_Shoot: 0.367,
  Jump: 0.6,
  Jump_Idle: 0.333,
  Jump_Land: 0.367,
  No: 0.667,
  Punch: 0.333,
  Run: 0.667,
  Run_Gun: 0.733,
  Run_Shoot: 0.733,
  Walk: 1.0,
  Walk_Shoot: 1.0,
  Wave: 1.167,
  Yes: 0.667,
} as const;

export const HITREACT_DURATION = ANIM_DURATIONS.HitReact; // 0.433 秒（設計 component-methods-v5 整合）
