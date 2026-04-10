import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { BulletComponent } from '../components/BulletComponent';
import { PositionComponent } from '../components/PositionComponent';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * S-11: クリーンアップシステム（優先度98）
 * business-logic-model セクション10
 * Iteration 2: アイテムは防衛ラインで消滅（DefenseLineSystem担当）、ここでは弾丸の画面外消滅のみ
 */
export class CleanupSystem implements System {
  readonly priority = 98;

  update(world: World, _dt: number): void {
    const margin = GAME_CONFIG.bullet.screenMargin;
    const w = GAME_CONFIG.screen.logicalWidth;
    const h = GAME_CONFIG.screen.logicalHeight;

    // 弾丸: 画面外（マージン50px外）で消滅（BR-W05）
    const bulletIds = world.query(BulletComponent, PositionComponent);
    for (const id of bulletIds) {
      const pos = world.getComponent(id, PositionComponent)!;
      if (pos.x < -margin || pos.x > w + margin || pos.y < -margin || pos.y > h + margin) {
        world.destroyEntity(id);
      }
    }
  }
}
