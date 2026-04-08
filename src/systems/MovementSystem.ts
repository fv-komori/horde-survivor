import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { PositionComponent } from '../components/PositionComponent';
import { VelocityComponent } from '../components/VelocityComponent';

/** S-02: 汎用移動システム（敵・弾丸用）（優先度2） */
export class MovementSystem implements System {
  readonly priority = 2;

  update(world: World, dt: number): void {
    const ids = world.query(PositionComponent, VelocityComponent);
    for (const id of ids) {
      const pos = world.getComponent(id, PositionComponent)!;
      const vel = world.getComponent(id, VelocityComponent)!;
      pos.x += vel.vx * dt;
      pos.y += vel.vy * dt;
    }
  }
}
