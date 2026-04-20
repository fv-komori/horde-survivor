/** ゲート効果定義（Iter6 Phase 2b: 新規、components-v6 C6-12） */

import { GateType } from '../types';

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

export type GateUnit = 'percent' | 'flat' | 'count';

export interface GateEffect {
  amount: number;
  unit: GateUnit;
  durationSec?: number;
}

export const GATE_EFFECTS: Record<GateType, GateEffect> = deepFreeze({
  [GateType.ALLY_ADD]: { amount: 5, unit: 'count' },
  [GateType.ATTACK_UP]: { amount: 30, unit: 'percent', durationSec: 10 },
  [GateType.SPEED_UP]: { amount: 20, unit: 'percent', durationSec: 10 },
  [GateType.HEAL]: { amount: 40, unit: 'flat' },
});

/** ゲート効果量の runtime 検証（ゲート発動前に呼ぶ。NG なら no-op 扱い） */
export function isValidGateAmount(amount: number, maxAmount: number = 1000): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= maxAmount;
}

/** ゲートスポーン間隔とその他パラメータ */
export const GATE_SPAWN = deepFreeze({
  initialOffset: 8,
  intervalMin: 8,
  intervalMax: 10,
  maxConcurrent: 2,
  bonusConcurrentBonus: 1,
});

/** Wave 境目時刻（秒）— 45s=樽 / 90s=ゲート / 180s=樽（components-v6 Wave 境目ボーナス仕様） */
export const WAVE_BONUS_TIMES = [45, 90, 180] as const;
