import { Component } from '../ecs/Component';
import { EnemyType } from '../types';

/** C-07: 敵固有データコンポーネント */
export class EnemyComponent extends Component {
  static readonly componentName = 'EnemyComponent';

  constructor(
    public enemyType: EnemyType,
    public breachDamage: number,
    public xpDrop: number,
  ) {
    super();
  }
}
