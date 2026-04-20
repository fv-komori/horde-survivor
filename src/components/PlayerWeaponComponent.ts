import type { Object3D } from 'three';
import { Component } from '../ecs/Component';
import { WeaponGenre } from '../types';

/**
 * C6-03: プレイヤーの現武器ジャンル保持コンポーネント
 *
 * `currentWeaponMesh` は装備中 Object3D への参照（B-NG-18）。
 * - transferred ルート: barrel 由来の Mesh を attach、樽 dispose 時に影響なし
 * - cloned ルート:      AssetManager.cloneWeaponTemplate で新規 clone、次回切替時に dispose 要
 * WeaponSwitchSystem が切替成功のたびに前 mesh を dispose し、新 mesh の参照に更新する。
 */
export class PlayerWeaponComponent extends Component {
  static readonly componentName = 'PlayerWeaponComponent';

  constructor(
    public genre: WeaponGenre,
    public switchedAt: number = 0,
    public currentWeaponMesh: Object3D | null = null,
  ) {
    super();
  }
}
