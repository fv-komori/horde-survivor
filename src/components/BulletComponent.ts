import { Component } from '../ecs/Component';
import type { EntityId } from '../ecs/Entity';

/** C-08: 弾丸固有データコンポーネント */
export class BulletComponent extends Component {
  static readonly componentName = 'BulletComponent';

  /** 貫通弾が既にヒットした敵のIDセット */
  public piercedEntities: Set<EntityId> = new Set();

  constructor(
    public damage: number,
    public isPiercing: boolean,
    public ownerId: EntityId,
  ) {
    super();
  }
}
