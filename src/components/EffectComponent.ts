import { Component } from '../ecs/Component';
import { EffectType } from '../types';

/** C-14: エフェクトデータコンポーネント */
export class EffectComponent extends Component {
  static readonly componentName = 'EffectComponent';

  public elapsed: number = 0;
  public currentFrame: number = 0;

  constructor(
    public effectType: EffectType,
    public duration: number,
    public totalFrames: number,
    public frameInterval: number,
  ) {
    super();
  }
}
