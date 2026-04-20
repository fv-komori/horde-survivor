import { Component } from '../ecs/Component';
import { GateType } from '../types';

export interface ActiveBuffEntry {
  remaining: number;
  amount: number;
}

/**
 * C6-03b: プレイヤーのアクティブバフ（複数同時対応）
 *
 * 対象 GateType は ATTACK_UP / SPEED_UP のみ（HEAL/ALLY_ADD は即時効果、継続バフなし）。
 * 同種は常に上書き（BuffSystem.applyOrExtend が `max(existing?.remaining, durationSec)`）。
 */
export class ActiveBuffsComponent extends Component {
  static readonly componentName = 'ActiveBuffsComponent';

  public buffs: Map<GateType, ActiveBuffEntry>;

  constructor(buffs?: Map<GateType, ActiveBuffEntry>) {
    super();
    this.buffs = buffs ?? new Map();
  }
}
