import { Object3D } from 'three';
import { Component } from '../ecs/Component';
import type { SpriteType } from '../types';
import type { InstancedMeshPool } from '../rendering/InstancedMeshPool';

/** C-03b: Three.js 3Dメッシュコンポーネント（SpriteComponent置換） */
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

  constructor(
    public spriteType: SpriteType,
    public logicalWidth: number,
    public logicalHeight: number,
    options?: {
      object3D?: Object3D | null;
      instancePool?: InstancedMeshPool | null;
      instanceId?: number;
      baseColor?: string;
    },
  ) {
    super();
    this.object3D = options?.object3D ?? null;
    this.instancePool = options?.instancePool ?? null;
    this.instanceId = options?.instanceId ?? -1;
    this.baseColor = options?.baseColor ?? '#FFFFFF';
  }
}
