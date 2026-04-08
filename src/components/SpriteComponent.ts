import { Component } from '../ecs/Component';
import type { SpriteType } from '../types';

/** C-03: 描画情報コンポーネント */
export class SpriteComponent extends Component {
  static readonly componentName = 'SpriteComponent';

  constructor(
    public spriteType: SpriteType,
    public width: number,
    public height: number,
    public color: string = '#FFFFFF',
  ) {
    super();
  }
}
