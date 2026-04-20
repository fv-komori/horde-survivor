import { Component } from '../ecs/Component';
import { GateType } from '../types';
import type { GateUnit } from '../config/gateConfig';

/**
 * C6-02: ゲート（通過型バフ）コンポーネント
 *
 * GateType と効果量 amount を持ち、GateTriggerSystem がプレイヤーの Y 跨ぎで発動させる。
 * consumed=true 以降の通過は無視し、次フレーム CleanupSystem が消滅させる。
 */
export class GateComponent extends Component {
  static readonly componentName = 'GateComponent';

  constructor(
    public type: GateType,
    public amount: number,
    public unit: GateUnit,
    public durationSec: number | null,
    public widthHalf: number = 1.5,
    public consumed: boolean = false,
    public labelDomId: string | null = null,
    public isBonus: boolean = false,
  ) {
    super();
  }
}
