import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { AllyComponent } from '../components/AllyComponent';
import { PositionComponent } from '../components/PositionComponent';
import { MeshComponent } from '../components/MeshComponent';
import { GAME_CONFIG } from '../config/gameConfig';

/** S-04: 仲間追従システム（優先度3）
 *  business-logic-model セクション9
 *  Iteration 2: 動的間隔配置（1-4体: 110px固定, 5+体: 圧縮）
 */
export class AllyFollowSystem implements System {
  readonly priority = 3;

  update(world: World, _dt: number): void {
    const allyIds = world.query(AllyComponent, PositionComponent);
    const totalAllies = allyIds.length;
    if (totalAllies === 0) return;

    // 間隔計算（BR-AL02）
    let spacing: number;
    if (totalAllies <= 4) {
      spacing = GAME_CONFIG.ally.fixedSpacing;
    } else {
      spacing = Math.max(
        GAME_CONFIG.ally.minSpacing,
        Math.min(GAME_CONFIG.ally.fixedSpacing, GAME_CONFIG.ally.availableWidth / totalAllies),
      );
    }

    // allyIndexでソートして処理
    const sortedAllies = allyIds
      .map(id => ({ id, ally: world.getComponent(id, AllyComponent)! }))
      .sort((a, b) => a.ally.allyIndex - b.ally.allyIndex);

    for (let i = 0; i < sortedAllies.length; i++) {
      const { id: allyId, ally } = sortedAllies[i];
      const allyPos = world.getComponent(allyId, PositionComponent)!;
      const playerPos = world.getComponent(ally.followTarget, PositionComponent);

      if (!playerPos) continue;

      // 交互配置: 偶数インデックス=右、奇数インデックス=左
      const distance = (Math.floor(i / 2) + 1) * spacing;
      const side = i % 2 === 0 ? 1 : -1; // 偶数=右(+), 奇数=左(-)
      allyPos.x = playerPos.x + side * distance;
      allyPos.y = playerPos.y;

      // 画面境界制限
      const mesh = world.getComponent(allyId, MeshComponent);
      const halfWidth = mesh ? mesh.logicalWidth / 2 : GAME_CONFIG.ally.spriteHalfWidth;
      allyPos.x = Math.max(halfWidth, Math.min(GAME_CONFIG.screen.logicalWidth - halfWidth, allyPos.x));
    }
  }
}
