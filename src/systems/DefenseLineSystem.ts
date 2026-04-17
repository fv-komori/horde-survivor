import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { EnemyComponent } from '../components/EnemyComponent';
import { ItemDropComponent } from '../components/ItemDropComponent';
import { PositionComponent } from '../components/PositionComponent';
import { HealthComponent } from '../components/HealthComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { AnimationStateComponent } from '../components/AnimationStateComponent';
import type { AnimationSystem } from './AnimationSystem';
import type { AudioManager } from '../audio/AudioManager';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * S-07: 防衛ラインシステム（優先度6）
 * business-logic-model セクション6
 * Iteration 2: 敵は防衛ラインでダメージ、アイテムは消滅のみ（ダメージなし）
 */
export class DefenseLineSystem implements System {
  readonly priority = 6;
  private audioManager: AudioManager;
  private animationSystem: AnimationSystem | null;

  constructor(audioManager: AudioManager, animationSystem: AnimationSystem | null = null) {
    this.audioManager = audioManager;
    this.animationSystem = animationSystem;
  }

  update(world: World, _dt: number): void {
    const enemyIds = world.query(EnemyComponent, PositionComponent);
    const playerIds = world.query(PlayerComponent, HealthComponent);
    const defenseLineY = GAME_CONFIG.defenseLine.y;

    // 敵が防衛ラインを超えた場合: ダメージ適用
    if (playerIds.length > 0) {
      const playerId = playerIds[0];
      const playerHealth = world.getComponent(playerId, HealthComponent)!;

      for (const enemyId of enemyIds) {
        // Iter5: 既に Death anim 中の敵はスキップ（二重判定防止）
        const enemyAnim = world.getComponent(enemyId, AnimationStateComponent);
        if (enemyAnim?.current === 'Death') continue;
        const ePos = world.getComponent(enemyId, PositionComponent)!;

        if (ePos.y >= defenseLineY) {
          const enemy = world.getComponent(enemyId, EnemyComponent)!;
          playerHealth.hp = Math.max(0, playerHealth.hp - enemy.breachDamage);
          // 防衛ライン突破SE（BR-EV01）
          this.audioManager.playSE('defense_breach');
          // Iter5: プレイヤーが被弾 → HitReact ワンショット
          if (this.animationSystem && playerHealth.hp > 0) {
            this.animationSystem.playHitReact(world, playerId);
          }
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
