import { Component } from '../ecs/Component';
import { GAME_CONFIG } from '../config/gameConfig';

/** C-11: XPアイテムデータコンポーネント */
export class XPDropComponent extends Component {
  static readonly componentName = 'XPDropComponent';

  public lifetime: number;
  public createdAt: number;

  constructor(
    public xpAmount: number,
    currentTime: number = 0,
  ) {
    super();
    this.lifetime = GAME_CONFIG.xpDrop.lifetime;
    this.createdAt = currentTime;
  }
}
