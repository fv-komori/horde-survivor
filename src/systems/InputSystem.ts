import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { PlayerComponent } from '../components/PlayerComponent';
import type { InputHandler } from '../input/InputHandler';

/** S-01: 入力システム（優先度1） */
export class InputSystem implements System {
  readonly priority = 1;
  private inputHandler: InputHandler;

  constructor(inputHandler: InputHandler) {
    this.inputHandler = inputHandler;
  }

  update(world: World, _dt: number): void {
    const playerIds = world.query(PlayerComponent);
    if (playerIds.length === 0) return;

    const player = world.getComponent(playerIds[0], PlayerComponent);
    if (!player) return;

    player.moveDirection = this.inputHandler.getMoveDirection();
  }
}
