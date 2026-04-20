import { Component } from '../ecs/Component';
import { WeaponGenre } from '../types';

/** C-09: 武器データコンポーネント（Iter6 Phase 2b: WeaponGenre に置換） */
export class WeaponComponent extends Component {
  static readonly componentName = 'WeaponComponent';

  public lastFiredAt: number = 0;

  constructor(
    public weaponGenre: WeaponGenre,
    public fireInterval: number,
  ) {
    super();
  }
}
