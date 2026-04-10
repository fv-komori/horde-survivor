import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { PlayerComponent } from '../components/PlayerComponent';
import { PositionComponent } from '../components/PositionComponent';
import { BuffComponent } from '../components/BuffComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { GAME_CONFIG } from '../config/gameConfig';
import { BuffType } from '../types';

/** S-03: プレイヤー移動システム（優先度2）
 *  business-logic-model セクション2
 *  Iteration 2: PassiveSkills廃止 → BuffComponentでSPEED_UP適用
 */
export class PlayerMovementSystem implements System {
  readonly priority = 2;

  update(world: World, dt: number): void {
    const playerIds = world.query(PlayerComponent, PositionComponent);
    if (playerIds.length === 0) return;

    const id = playerIds[0];
    const player = world.getComponent(id, PlayerComponent)!;
    const pos = world.getComponent(id, PositionComponent)!;
    const buffs = world.getComponent(id, BuffComponent);
    const collider = world.getComponent(id, ColliderComponent);

    // 実効速度 = baseSpeed × バフ倍率（BR-BF04: SPEED_UP時1.5倍）
    const speedMultiplier = buffs?.hasBuff(BuffType.SPEED_UP)
      ? GAME_CONFIG.buff.speedMultiplier
      : 1.0;
    const effectiveSpeed = player.baseSpeed * speedMultiplier;

    // 移動量
    const dx = player.moveDirection * effectiveSpeed * dt;
    const radius = collider?.radius ?? GAME_CONFIG.player.colliderRadius;

    // 画面境界制限（BR-P01）
    pos.x = Math.max(radius, Math.min(GAME_CONFIG.screen.logicalWidth - radius, pos.x + dx));
    // Y座標は固定
  }
}
