import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { PlayerComponent } from '../components/PlayerComponent';
import { BuffComponent } from '../components/BuffComponent';
import { BuffType } from '../types';

/**
 * S-09: バフシステム（優先度9）
 * Iter6: GateTriggerSystem からの ATTACK_UP / SPEED_UP 発動を applyOrExtend 経由で受ける
 *        （残り時間の長い方で上書き、FR-06）。GAME_OVER 中は applyOrExtend を no-op に。
 */
export class BuffSystem implements System {
  readonly priority = 9;
  enabled = true;

  update(world: World, dt: number): void {
    if (!this.enabled) return;
    const playerIds = world.query(PlayerComponent, BuffComponent);
    for (const playerId of playerIds) {
      const buff = world.getComponent(playerId, BuffComponent)!;
      for (const [buffType, state] of buff.activeBuffs) {
        state.remainingTime -= dt;
        if (state.remainingTime <= 0) {
          buff.activeBuffs.delete(buffType);
        }
      }
    }
  }

  /**
   * Iter6: 同種バフを適用または延長（残り時間の長い方で上書き）。
   * GAME_OVER 中（enabled=false）は no-op。
   */
  applyOrExtend(buff: BuffComponent, type: BuffType, durationSec: number): void {
    if (!this.enabled) return;
    const existing = buff.activeBuffs.get(type);
    const remaining = Math.max(existing?.remainingTime ?? 0, durationSec);
    buff.activeBuffs.set(type, { remainingTime: remaining });
  }
}
