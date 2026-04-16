import {
  Color,
  InstancedMesh,
  Matrix4,
  Vector3,
  type BufferGeometry,
  type Euler,
  type Material,
} from 'three';
import type { EntityId } from '../types';

/** InstancedMesh管理プール（BL-05, BR-M03） */
export class InstancedMeshPool {
  readonly instancedMesh: InstancedMesh;

  private freeSlots: number[] = [];
  private activeSlots = new Map<EntityId, number>();

  /** 再利用用一時オブジェクト */
  private readonly _tempMatrix = new Matrix4();
  private readonly _tempColor = new Color();
  private readonly _tempPos = new Vector3();

  constructor(
    geometry: BufferGeometry,
    material: Material,
    public readonly maxCount: number,
  ) {
    this.instancedMesh = new InstancedMesh(geometry, material, maxCount);
    this.instancedMesh.count = 0;
    this.instancedMesh.instanceMatrix.setUsage(35048); // DynamicDrawUsage

    // 全スロットを空きとして初期化
    for (let i = maxCount - 1; i >= 0; i--) {
      this.freeSlots.push(i);
    }

    // 全インスタンスを画面外に初期配置
    const hideMatrix = new Matrix4().makeTranslation(0, -1000, 0);
    for (let i = 0; i < maxCount; i++) {
      this.instancedMesh.setMatrixAt(i, hideMatrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  /** スロット確保（エンティティにインスタンスIDを割り当て） */
  acquire(entityId: EntityId): number {
    if (this.freeSlots.length === 0) {
      return -1; // プール枯渇
    }
    const slotId = this.freeSlots.pop()!;
    this.activeSlots.set(entityId, slotId);

    // 表示カウントを更新
    this.instancedMesh.count = Math.max(this.instancedMesh.count, slotId + 1);
    return slotId;
  }

  /** スロット解放 */
  release(entityId: EntityId): void {
    const slotId = this.activeSlots.get(entityId);
    if (slotId === undefined) return;

    this.activeSlots.delete(entityId);
    this.freeSlots.push(slotId);

    // 解放スロットを画面外に移動
    this._tempMatrix.makeTranslation(0, -1000, 0);
    this.instancedMesh.setMatrixAt(slotId, this._tempMatrix);
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  /** 位置・回転更新 */
  updateMatrix(instanceId: number, position: Vector3, rotation?: Euler): void {
    if (instanceId < 0 || instanceId >= this.maxCount) return;

    this._tempMatrix.identity();
    if (rotation) {
      this._tempMatrix.makeRotationFromEuler(rotation);
    }
    this._tempMatrix.setPosition(position);
    this.instancedMesh.setMatrixAt(instanceId, this._tempMatrix);
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  /** 個別カラー設定（ヒットフラッシュ等） */
  setColor(instanceId: number, color: Color): void {
    if (instanceId < 0 || instanceId >= this.maxCount) return;
    this.instancedMesh.setColorAt(instanceId, color);
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  /** エンティティIDからスロットID取得 */
  getSlotId(entityId: EntityId): number {
    return this.activeSlots.get(entityId) ?? -1;
  }

  /** アクティブ数取得 */
  get activeCount(): number {
    return this.activeSlots.size;
  }

  /** WebGLコンテキストロスト後の再構築（BL-07, BR-MEM02） */
  rebuild(): void {
    // 全アクティブスロットの行列を再設定
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  /** リソース解放 */
  dispose(): void {
    this.instancedMesh.dispose();
    this.activeSlots.clear();
    this.freeSlots.length = 0;
  }
}
