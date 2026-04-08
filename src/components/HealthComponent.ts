import { Component } from '../ecs/Component';

/** C-04: HP管理コンポーネント */
export class HealthComponent extends Component {
  static readonly componentName = 'HealthComponent';

  constructor(
    public hp: number,
    public maxHp: number,
  ) {
    super();
  }
}
