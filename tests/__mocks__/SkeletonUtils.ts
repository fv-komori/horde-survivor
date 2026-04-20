import { Group, Object3D } from 'three';

/** Jest: SkeletonUtils.clone の簡易スタブ（テストでは EntityFactory が GLTF 経路を通らないため用途は型/shim のみ） */
export function clone(source: Object3D): Object3D {
  const g = new Group();
  g.name = source.name;
  return g;
}

export function retarget(): void {}
export function retargetClip(): void {}
