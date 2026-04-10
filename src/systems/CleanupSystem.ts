import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { BulletComponent } from '../components/BulletComponent';
import { ItemDropComponent } from '../components/ItemDropComponent';
import { PositionComponent } from '../components/PositionComponent';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * S-11: クリーンアップシステム（優先度98）
 * business-logic-model セクション10
 * Iteration 2: XPDrop → ItemDrop
 */
export class CleanupSystem implements System {
  readonly priority = 98;

  update(world: World, dt: number): void {
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

    // ItemDrop: 寿命管理と上限管理
    const itemIds = world.query(ItemDropComponent, PositionComponent);
    const toDestroy: { id: number; remainingTime: number }[] = [];

    for (const id of itemIds) {
      const item = world.getComponent(id, ItemDropComponent)!;
      item.remainingTime -= dt;

      // 点滅開始判定（BR-ID05）
      if (item.remainingTime <= GAME_CONFIG.itemDrop.blinkStartTime) {
        item.isBlinking = true;
      }

      // 自動消滅（残り時間0）
      if (item.remainingTime <= 0) {
        world.destroyEntity(id);
      } else {
        toDestroy.push({ id, remainingTime: item.remainingTime });
      }
    }

    // ItemDrop上限管理（BR-S03: maxItems超過時は残り時間が少ないものから消滅）
    if (toDestroy.length > GAME_CONFIG.limits.maxItems) {
      toDestroy.sort((a, b) => a.remainingTime - b.remainingTime);
      const excess = toDestroy.length - GAME_CONFIG.limits.maxItems;
      for (let i = 0; i < excess; i++) {
        world.destroyEntity(toDestroy[i].id);
      }
    }
  }
}
