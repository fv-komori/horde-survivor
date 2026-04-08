import { Component } from '../ecs/Component';
import { WeaponType } from '../types';
import { WEAPON_CONFIG } from '../config/weaponConfig';

/** 武器スロット（インベントリ内の1武器分） */
export interface WeaponSlot {
  weaponType: WeaponType;
  level: number;
  lastFiredAt: number;
}

/** C-13: 武器インベントリコンポーネント（プレイヤー用、最大3種） */
export class WeaponInventoryComponent extends Component {
  static readonly componentName = 'WeaponInventoryComponent';

  public weaponSlots: WeaponSlot[] = [];

  constructor() {
    super();
  }

  /** 武器を追加 */
  addWeapon(weaponType: WeaponType, level: number = 1): boolean {
    if (this.weaponSlots.length >= 3) return false;
    this.weaponSlots.push({ weaponType, level, lastFiredAt: 0 });
    return true;
  }

  /** 武器を検索 */
  findWeapon(weaponType: WeaponType): WeaponSlot | undefined {
    return this.weaponSlots.find(w => w.weaponType === weaponType);
  }

  /** 武器の発射間隔を取得 */
  getFireInterval(slot: WeaponSlot): number {
    const config = WEAPON_CONFIG[slot.weaponType];
    if (!config) return 1.0;
    const levelConfig = config.levels[slot.level - 1];
    return levelConfig ? levelConfig.fireInterval : 1.0;
  }
}
