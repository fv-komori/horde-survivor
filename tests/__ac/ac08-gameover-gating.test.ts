/**
 * Iter6 AC-08: GAME_OVER 中にゲート/樽発動と BuffSystem が停止することを保証。
 * 個別 System レベルで enabled=false 時の挙動を確認する。
 */

import { BuffSystem } from '../../src/systems/BuffSystem';
import { BuffComponent } from '../../src/components/BuffComponent';
import { BuffType } from '../../src/types';

describe('AC-08: GAME_OVER 中は副作用を停止', () => {
  test('BuffSystem.applyOrExtend は enabled=false で no-op', () => {
    const system = new BuffSystem();
    const buff = new BuffComponent();

    system.enabled = false;
    system.applyOrExtend(buff, BuffType.ATTACK_UP, 10);
    expect(buff.activeBuffs.size).toBe(0);

    system.enabled = true;
    system.applyOrExtend(buff, BuffType.ATTACK_UP, 10);
    expect(buff.activeBuffs.size).toBe(1);
    expect(buff.activeBuffs.get(BuffType.ATTACK_UP)?.remainingTime).toBe(10);
  });

  test('applyOrExtend: 残り時間が長い方で上書き（同種重複）', () => {
    const system = new BuffSystem();
    const buff = new BuffComponent();

    system.applyOrExtend(buff, BuffType.ATTACK_UP, 5);
    expect(buff.activeBuffs.get(BuffType.ATTACK_UP)?.remainingTime).toBe(5);

    // 短い方で上書き: 既存 5 を維持
    system.applyOrExtend(buff, BuffType.ATTACK_UP, 3);
    expect(buff.activeBuffs.get(BuffType.ATTACK_UP)?.remainingTime).toBe(5);

    // 長い方で上書き: 10 に更新
    system.applyOrExtend(buff, BuffType.ATTACK_UP, 10);
    expect(buff.activeBuffs.get(BuffType.ATTACK_UP)?.remainingTime).toBe(10);
  });
});
