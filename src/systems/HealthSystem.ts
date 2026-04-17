import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { HealthComponent } from '../components/HealthComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { AnimationStateComponent } from '../components/AnimationStateComponent';
import { GameStateManager } from '../game/GameStateManager';
import { GameState } from '../types';
import type { AnimationSystem } from './AnimationSystem';

/**
 * S-08: HPシステム（優先度7）
 * Iteration 2: 無敵時間廃止、HP0判定のみ
 * Iter5: プレイヤー HP=0 時に Death anim をワンショット再生してから GAME_OVER 遷移
 */
export class HealthSystem implements System {
  readonly priority = 7;
  private gameStateManager: GameStateManager;
  private animationSystem: AnimationSystem | null;

  constructor(gameStateManager: GameStateManager, animationSystem: AnimationSystem | null = null) {
    this.gameStateManager = gameStateManager;
    this.animationSystem = animationSystem;
  }

  update(world: World, _dt: number): void {
    const playerIds = world.query(PlayerComponent, HealthComponent);
    if (playerIds.length === 0) return;

    const id = playerIds[0];
    const health = world.getComponent(id, HealthComponent)!;

    // HP0判定 → ゲームオーバー（BR-P02）
    if (health.hp <= 0) {
      health.hp = 0;
      // Iter5: Death anim を一度だけ発火（既に Death 中なら再発火しない）
      const anim = world.getComponent(id, AnimationStateComponent);
      if (this.animationSystem && anim && anim.current !== 'Death') {
        this.animationSystem.playDeath(world, id);
      }
      this.gameStateManager.changeState(GameState.GAME_OVER);
    }
  }
}
