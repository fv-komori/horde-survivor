import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { EnemyComponent } from '../components/EnemyComponent';
import { ItemDropComponent } from '../components/ItemDropComponent';
import { PositionComponent } from '../components/PositionComponent';
import { HealthComponent } from '../components/HealthComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * S-07: 防衛ラインシステム（優先度6）
 * business-logic-model セクション6
 * Iteration 2: 敵は防衛ラインでダメージ、アイテムは消滅のみ（ダメージなし）
 */
export class DefenseLineSystem implements System {
  readonly priority = 6;

  update(world: World, _dt: number): void {
    const enemyIds = world.query(EnemyComponent, PositionComponent);
    const playerIds = world.query(PlayerComponent, HealthComponent);
    const defenseLineY = GAME_CONFIG.defenseLine.y;

    // 敵が防衛ラインを超えた場合: ダメージ適用
    if (playerIds.length > 0) {
      const playerId = playerIds[0];
      const playerHealth = world.getComponent(playerId, HealthComponent)!;

      for (const enemyId of enemyIds) {
        const ePos = world.getComponent(enemyId, PositionComponent)!;

        if (ePos.y >= defenseLineY) {
          const enemy = world.getComponent(enemyId, EnemyComponent)!;
          playerHealth.hp = Math.max(0, playerHealth.hp - enemy.breachDamage);
          world.destroyEntity(enemyId);
        }
      }
    }

    // アイテムが防衛ラインを超えた場合: ダメージなしで消滅
    const itemIds = world.query(ItemDropComponent, PositionComponent);
    for (const itemId of itemIds) {
      const iPos = world.getComponent(itemId, PositionComponent)!;
      if (iPos.y >= defenseLineY) {
        world.destroyEntity(itemId);
      }
    }
  }
}
