import type { System } from '../ecs/System';
import type { World } from '../ecs/World';

/**
 * S-08: アイテム回収システム（優先度8）
 * アイテムは射撃で破壊する方式に変更されたため、このシステムは無効化
 * CollisionSystemがアイテム破壊時のバフ/武器効果適用を担当
 */
export class ItemCollectionSystem implements System {
  readonly priority = 8;

  update(_world: World, _dt: number): void {
    // no-op: アイテムは射撃破壊方式に変更（CollisionSystemで処理）
  }
}
