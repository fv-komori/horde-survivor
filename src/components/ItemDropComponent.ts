import { Component } from '../ecs/Component';
import { ItemType } from '../types';

/** C-12: ドロップアイテムデータコンポーネント */
export class ItemDropComponent extends Component {
  static readonly componentName = 'ItemDropComponent';

  /** 消滅前点滅フラグ */
  public isBlinking: boolean = false;

  constructor(
    public itemType: ItemType,
    public remainingTime: number,
  ) {
    super();
  }
}
