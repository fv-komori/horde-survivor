import { Component } from '../ecs/Component';
import type { EntityId } from '../ecs/Entity';

/** C-08: 弾丸固有データコンポーネント（Iteration 2: ヒットカウント減算） */
export class BulletComponent extends Component {
  static readonly componentName = 'BulletComponent';

  /** 貫通弾が既にヒットした敵のIDセット */
  public hitEntities: Set<EntityId> = new Set();

  constructor(
    public hitCountReduction: number,
    public isPiercing: boolean,
    public ownerId: EntityId,
  ) {
    super();
  }
}
