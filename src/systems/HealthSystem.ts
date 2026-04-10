import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { HealthComponent } from '../components/HealthComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { GameStateManager } from '../game/GameStateManager';
import { GameState } from '../types';

/**
 * S-08: HPシステム（優先度7）
 * Iteration 2: 無敵時間廃止、HP0判定のみ
 */
export class HealthSystem implements System {
  readonly priority = 7;
  private gameStateManager: GameStateManager;

  constructor(gameStateManager: GameStateManager) {
    this.gameStateManager = gameStateManager;
  }

  update(world: World, _dt: number): void {
    const playerIds = world.query(PlayerComponent, HealthComponent);
    if (playerIds.length === 0) return;

    const id = playerIds[0];
    const health = world.getComponent(id, HealthComponent)!;

    // HP0判定 → ゲームオーバー（BR-P02）
    if (health.hp <= 0) {
      health.hp = 0;
      this.gameStateManager.changeState(GameState.GAME_OVER);
    }
  }
}
