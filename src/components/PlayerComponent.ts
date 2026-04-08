import { Component } from '../ecs/Component';

/** C-06: プレイヤー固有データコンポーネント */
export class PlayerComponent extends Component {
  static readonly componentName = 'PlayerComponent';

  public moveDirection: number = 0;      // -1 / 0 / +1
  public isInvincible: boolean = false;
  public invincibleTimer: number = 0;    // 秒
  public baseSpeed: number;

  constructor(baseSpeed: number) {
    super();
    this.baseSpeed = baseSpeed;
  }
}
