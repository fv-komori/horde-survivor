import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { BulletComponent } from '../components/BulletComponent';
import { XPDropComponent } from '../components/XPDropComponent';
import { PositionComponent } from '../components/PositionComponent';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * S-11: クリーンアップシステム（優先度98）
 * business-logic-model セクション10
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

    // XPDrop: 寿命管理と上限管理
    const xpIds = world.query(XPDropComponent, PositionComponent);
    const toDestroy: { id: number; createdAt: number }[] = [];

    for (const id of xpIds) {
      const xp = world.getComponent(id, XPDropComponent)!;
      xp.lifetime -= dt;

      // 自動消滅（15秒経過）
      if (xp.lifetime <= 0) {
        world.destroyEntity(id);
      } else {
        toDestroy.push({ id, createdAt: xp.createdAt });
      }
    }

    // XPDrop上限管理（BR-S03: 100個超過時は最古を消滅）
    if (toDestroy.length > GAME_CONFIG.limits.maxXPDrops) {
      toDestroy.sort((a, b) => a.createdAt - b.createdAt);
      const excess = toDestroy.length - GAME_CONFIG.limits.maxXPDrops;
      for (let i = 0; i < excess; i++) {
        world.destroyEntity(toDestroy[i].id);
      }
    }
  }
}
