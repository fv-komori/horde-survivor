import { Component } from '../ecs/Component';
import { EnemyType } from '../types';

/** C-07: 敵固有データコンポーネント（Iteration 2: ドロップ確率・仲間化率） */
export class EnemyComponent extends Component {
  static readonly componentName = 'EnemyComponent';

  constructor(
    public enemyType: EnemyType,
    public breachDamage: number,
    public itemDropRate: number,
    public weaponDropRate: number,
    public conversionRate: number,
  ) {
    super();
  }
}
