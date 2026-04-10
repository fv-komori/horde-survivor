import { Component } from '../ecs/Component';
import { WeaponType } from '../types';

/** C-09: 武器データコンポーネント（Iteration 2: レベルなし、固定パラメータ） */
export class WeaponComponent extends Component {
  static readonly componentName = 'WeaponComponent';

  public lastFiredAt: number = 0;

  constructor(
    public weaponType: WeaponType,
    public fireInterval: number,
  ) {
    super();
  }
}
