import { Component } from '../ecs/Component';

/** C-11: 敵のヒットカウントデータコンポーネント */
export class HitCountComponent extends Component {
  static readonly componentName = 'HitCountComponent';

  /** 被弾フラッシュ残り時間(秒)。0以上で赤点滅表示 */
  public flashTimer: number = 0;

  constructor(
    public currentHits: number,
    public maxHits: number,
  ) {
    super();
  }
}
