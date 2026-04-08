import { Component } from '../ecs/Component';
import { ColliderType } from '../types';

/** C-05: 衝突判定コンポーネント */
export class ColliderComponent extends Component {
  static readonly componentName = 'ColliderComponent';

  constructor(
    public radius: number,
    public type: ColliderType,
  ) {
    super();
  }
}
