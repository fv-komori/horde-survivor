import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { PlayerComponent } from '../components/PlayerComponent';
import { PositionComponent } from '../components/PositionComponent';
import { PassiveSkillsComponent } from '../components/PassiveSkillsComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { GAME_CONFIG } from '../config/gameConfig';

/** S-03: プレイヤー移動システム（優先度2）
 *  business-logic-model セクション2
 */
export class PlayerMovementSystem implements System {
  readonly priority = 2;

  update(world: World, dt: number): void {
    const playerIds = world.query(PlayerComponent, PositionComponent);
    if (playerIds.length === 0) return;

    const id = playerIds[0];
    const player = world.getComponent(id, PlayerComponent)!;
    const pos = world.getComponent(id, PositionComponent)!;
    const passives = world.getComponent(id, PassiveSkillsComponent);
    const collider = world.getComponent(id, ColliderComponent);

    // 実効速度 = baseSpeed × (1 + speedLevel × 0.10)（BR-P04）
    const speedMultiplier = 1 + (passives?.speedLevel ?? 0) * GAME_CONFIG.passiveSkills.speed.perLevel;
    const effectiveSpeed = player.baseSpeed * speedMultiplier;

    // 移動量
    const dx = player.moveDirection * effectiveSpeed * dt;
    const radius = collider?.radius ?? GAME_CONFIG.player.colliderRadius;

    // 画面境界制限（BR-P01）
    pos.x = Math.max(radius, Math.min(GAME_CONFIG.screen.logicalWidth - radius, pos.x + dx));
    // Y座標は固定
  }
}
