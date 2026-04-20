import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { PositionComponent } from '../components/PositionComponent';
import { VelocityComponent } from '../components/VelocityComponent';
import { AnimationStateComponent } from '../components/AnimationStateComponent';

/** Iter5: HitReact 中の前進減速率（stagger 演出、0 で完全停止 / 1 で通常速度） */
const HITREACT_VELOCITY_FACTOR = 0.3;

/** S-02: 汎用移動システム（敵・弾丸用）（優先度2） */
export class MovementSystem implements System {
  readonly priority = 2;

  update(world: World, dt: number): void {
    const ids = world.query(PositionComponent, VelocityComponent);
    for (const id of ids) {
      const pos = world.getComponent(id, PositionComponent)!;
      const vel = world.getComponent(id, VelocityComponent)!;
      const anim = world.getComponent(id, AnimationStateComponent);
      const factor = anim?.current === 'HitReact' ? HITREACT_VELOCITY_FACTOR : 1.0;
      pos.x += vel.vx * dt * factor;
      pos.y += vel.vy * dt * factor;
    }
  }
}
