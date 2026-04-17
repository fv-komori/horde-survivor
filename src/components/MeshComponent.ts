import { AnimationClip, AnimationMixer, Object3D } from 'three';
import { Component } from '../ecs/Component';
import type { SpriteType } from '../types';
import type { InstancedMeshPool } from '../rendering/InstancedMeshPool';

/** C-03b: Three.js 3Dメッシュコンポーネント（Iter5: GLTF mixer/outlineMesh 拡張） */
export class MeshComponent extends Component {
  static readonly componentName = 'MeshComponent';

  /** Three.js Object3D参照（InstancedMesh時はnull） */
  object3D: Object3D | null;

  /** InstancedMeshプール参照（個別Meshの場合はnull） */
  instancePool: InstancedMeshPool | null;

  /** プール内のスロットID */
  instanceId: number;

  /** ベースカラー（ヒットフラッシュ復帰用） */
  baseColor: string;

  /** Iter5: GLTF SkinnedMesh の AnimationMixer（キャラ entity のみ） */
  mixer: AnimationMixer | null;

  /** Iter5: 使用可能なアニメーション clip マップ（name → clip） */
  animations: Map<string, AnimationClip> | null;

  /** Iter5: 反転ハル Outline メッシュ root（FR-06、キャラ entity のみ） */
  outlineMesh: Object3D | null;

  constructor(
    public spriteType: SpriteType,
    public logicalWidth: number,
    public logicalHeight: number,
    options?: {
      object3D?: Object3D | null;
      instancePool?: InstancedMeshPool | null;
      instanceId?: number;
      baseColor?: string;
      mixer?: AnimationMixer | null;
      animations?: Map<string, AnimationClip> | null;
      outlineMesh?: Object3D | null;
    },
  ) {
    super();
    this.object3D = options?.object3D ?? null;
    this.instancePool = options?.instancePool ?? null;
    this.instanceId = options?.instanceId ?? -1;
    this.baseColor = options?.baseColor ?? '#FFFFFF';
    this.mixer = options?.mixer ?? null;
    this.animations = options?.animations ?? null;
    this.outlineMesh = options?.outlineMesh ?? null;
  }
}
