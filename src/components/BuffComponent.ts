import { Component } from '../ecs/Component';
import { BuffType } from '../types';
import type { BuffState } from '../types';

/** C-13: プレイヤーのアクティブバフ状態管理コンポーネント */
export class BuffComponent extends Component {
  static readonly componentName = 'BuffComponent';

  public activeBuffs: Map<BuffType, BuffState> = new Map();

  /** バフが有効かチェック */
  hasBuff(buffType: BuffType): boolean {
    return this.activeBuffs.has(buffType);
  }

  /** バフを適用（同種は時間リセット） */
  applyBuff(buffType: BuffType, duration: number): void {
    this.activeBuffs.set(buffType, { remainingTime: duration });
  }
}
