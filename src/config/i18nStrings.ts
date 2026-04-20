/** 表示文字列辞書（Iter6 Phase 2b: 新規、NFR-05 XSS 対策で動的結合禁止、数値のみ挿入） */

import { WeaponGenre, GateType } from '../types';

export const I18N_WEAPON_LABEL: Record<WeaponGenre, string> = {
  [WeaponGenre.RIFLE]: 'RIFLE',
  [WeaponGenre.SHOTGUN]: 'SHOTGUN',
  [WeaponGenre.MACHINEGUN]: 'MACHINEGUN',
};

export const I18N_GATE_LABEL: Record<GateType, string> = {
  [GateType.ALLY_ADD]: 'ALLY',
  [GateType.ATTACK_UP]: 'ATK',
  [GateType.SPEED_UP]: 'SPD',
  [GateType.HEAL]: 'HP',
};

export const I18N_TOAST = {
  weaponAcquired: (genre: WeaponGenre): string => `${I18N_WEAPON_LABEL[genre]} を取得！`,
  allyGain: (n: number): string => `+${Number(n).toString()} ALLY`,
  allyMax: 'ALLY MAX',
  healGain: (n: number): string => `+${Number(n).toString()} HP`,
  healMax: 'HP MAX',
  buffGain: (type: GateType, amount: number): string =>
    `+${Number(amount).toString()}% ${I18N_GATE_LABEL[type]}`,
  waveTransition: (wave: number): string => `WAVE ${Number(wave).toString()}`,
  bonusLabel: 'BONUS',
} as const;
