import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { PlayerComponent } from '../components/PlayerComponent';
import { BuffComponent } from '../components/BuffComponent';

/**
 * S-09: バフシステム（優先度9）
 * business-logic-model セクション7.3
 * バフタイマーの管理（効果適用は各システムが参照）
 */
export class BuffSystem implements System {
  readonly priority = 9;

  update(world: World, dt: number): void {
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
}
