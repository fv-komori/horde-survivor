import { Component } from '../ecs/Component';

/** C-01: 2D座標コンポーネント */
export class PositionComponent extends Component {
  static readonly componentName = 'PositionComponent';

  constructor(
    public x: number = 0,
    public y: number = 0,
  ) {
    super();
  }
}
