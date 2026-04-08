import { Component } from '../ecs/Component';

/** C-02: 速度ベクトルコンポーネント */
export class VelocityComponent extends Component {
  static readonly componentName = 'VelocityComponent';

  constructor(
    public vx: number = 0,
    public vy: number = 0,
  ) {
    super();
  }
}
