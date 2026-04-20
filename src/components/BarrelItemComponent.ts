import { Component } from '../ecs/Component';
import { BarrelItemType } from '../types';

/**
 * C6-01: 武器樽アイテムコンポーネント
 *
 * 樽の残 HP・ラベル DOM 割当・ボーナス/転送フラグを保持する値オブジェクト。
 * CollisionSystem が HP 減算し、HP=0 で WeaponSwitchSystem.enqueueSwitch を呼ぶ。
 * CleanupSystem は weaponTransferred で武器 child の dispose 可否を分岐する。
 */
export class BarrelItemComponent extends Component {
  static readonly componentName = 'BarrelItemComponent';

  constructor(
    public type: BarrelItemType,
    public hp: number,
    public maxHp: number,
    public labelDomId: string | null = null,
    public isBonus: boolean = false,
    public weaponTransferred: boolean = false,
  ) {
    super();
  }
}
