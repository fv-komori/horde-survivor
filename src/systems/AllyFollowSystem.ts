import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { AllyComponent } from '../components/AllyComponent';
import { PositionComponent } from '../components/PositionComponent';
import { SpriteComponent } from '../components/SpriteComponent';
import { GAME_CONFIG } from '../config/gameConfig';

/** S-04: 仲間追従システム（優先度3）
 *  business-logic-model セクション9
 */
export class AllyFollowSystem implements System {
  readonly priority = 3;

  update(world: World, _dt: number): void {
    const allyIds = world.query(AllyComponent, PositionComponent);

    for (const allyId of allyIds) {
      const ally = world.getComponent(allyId, AllyComponent)!;
      const allyPos = world.getComponent(allyId, PositionComponent)!;
      const playerPos = world.getComponent(ally.followTarget, PositionComponent);

      if (!playerPos) continue;

      // プレイヤー位置からオフセットを適用
      allyPos.x = playerPos.x + ally.offsetX;
      allyPos.y = playerPos.y;

      // 画面境界制限
      const sprite = world.getComponent(allyId, SpriteComponent);
      const halfWidth = sprite ? sprite.width / 2 : GAME_CONFIG.ally.spriteHalfWidth;
      allyPos.x = Math.max(halfWidth, Math.min(GAME_CONFIG.screen.logicalWidth - halfWidth, allyPos.x));
    }
  }
}
