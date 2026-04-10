import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { EnemyComponent } from '../components/EnemyComponent';
import { PositionComponent } from '../components/PositionComponent';
import { HealthComponent } from '../components/HealthComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * S-07: 防衛ラインシステム（優先度6）
 * business-logic-model セクション6
 * Iteration 2: 無敵チェック廃止、常にダメージ適用
 */
export class DefenseLineSystem implements System {
  readonly priority = 6;

  update(world: World, _dt: number): void {
    const enemyIds = world.query(EnemyComponent, PositionComponent);
    const playerIds = world.query(PlayerComponent, HealthComponent);
    if (playerIds.length === 0) return;

    const playerId = playerIds[0];
    const playerHealth = world.getComponent(playerId, HealthComponent)!;
    const defenseLineY = GAME_CONFIG.defenseLine.y;

    for (const enemyId of enemyIds) {
      const ePos = world.getComponent(enemyId, PositionComponent)!;

      if (ePos.y >= defenseLineY) {
        const enemy = world.getComponent(enemyId, EnemyComponent)!;

        // ダメージ適用（常に適用、無敵なし）
        playerHealth.hp = Math.max(0, playerHealth.hp - enemy.breachDamage);

        // 敵消滅
        world.destroyEntity(enemyId);
      }
    }
  }
}
