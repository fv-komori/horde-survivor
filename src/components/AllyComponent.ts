import { Component } from '../ecs/Component';
import type { EntityId } from '../ecs/Entity';

/** C-10: 仲間固有データコンポーネント（Iteration 2: 動的間隔・連射ボーナス） */
export class AllyComponent extends Component {
  static readonly componentName = 'AllyComponent';

  constructor(
    public allyIndex: number,
    public followTarget: EntityId,
    public joinTime: number,
    public fireRateBonus: number = 0,
  ) {
    super();
  }
}
