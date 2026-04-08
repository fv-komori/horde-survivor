import { Component } from '../ecs/Component';
import { WeaponType } from '../types';

/** C-09: 武器データコンポーネント（単一武器、仲間用） */
export class WeaponComponent extends Component {
  static readonly componentName = 'WeaponComponent';

  public lastFiredAt: number = 0;

  constructor(
    public weaponType: WeaponType,
    public level: number,
    public fireInterval: number,
  ) {
    super();
  }
}
