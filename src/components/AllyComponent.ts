import { Component } from '../ecs/Component';
import type { EntityId } from '../ecs/Entity';

/** C-10: 仲間固有データコンポーネント */
export class AllyComponent extends Component {
  static readonly componentName = 'AllyComponent';

  constructor(
    public offsetX: number,
    public followTarget: EntityId,
  ) {
    super();
  }
}
