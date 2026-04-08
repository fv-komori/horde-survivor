import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { HealthComponent } from '../components/HealthComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { GameStateManager } from '../game/GameStateManager';
import { GameState } from '../types';

/**
 * S-08: HPシステム（優先度7）
 * 無敵時間カウントダウン、HP0判定
 */
export class HealthSystem implements System {
  readonly priority = 7;
  private gameStateManager: GameStateManager;

  constructor(gameStateManager: GameStateManager) {
    this.gameStateManager = gameStateManager;
  }

  update(world: World, dt: number): void {
    const playerIds = world.query(PlayerComponent, HealthComponent);
    if (playerIds.length === 0) return;

    const id = playerIds[0];
    const player = world.getComponent(id, PlayerComponent)!;
    const health = world.getComponent(id, HealthComponent)!;

    // 無敵時間カウントダウン（BR-P03）
    if (player.isInvincible) {
      player.invincibleTimer -= dt;
      if (player.invincibleTimer <= 0) {
        player.isInvincible = false;
        player.invincibleTimer = 0;
      }
    }

    // HP0判定 → ゲームオーバー（BR-P02）
    if (health.hp <= 0) {
      health.hp = 0;
      this.gameStateManager.changeState(GameState.GAME_OVER);
    }
  }
}
