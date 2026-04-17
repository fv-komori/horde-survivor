import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { BulletComponent } from '../components/BulletComponent';
import { PositionComponent } from '../components/PositionComponent';
import { MeshComponent } from '../components/MeshComponent';
import { GAME_CONFIG } from '../config/gameConfig';
import { Mesh } from 'three';
import type { SceneManager } from '../rendering/SceneManager';

/**
 * S-11: クリーンアップシステム（優先度98）
 * Iteration 3: MeshComponent保有エンティティのdispose追加（BR-MEM01）
 * Iter5: GLTF entity clone 対応（mixer停止、outlineMesh dispose、material/geometry dispose chain）
 */
export class CleanupSystem implements System {
  readonly priority = 98;

  private sceneManager: SceneManager | null = null;

  /** Three.js依存を注入 */
  initThree(sceneManager: SceneManager): void {
    this.sceneManager = sceneManager;
  }

  update(world: World, _dt: number): void {
    const margin = GAME_CONFIG.bullet.screenMargin;
    const w = GAME_CONFIG.screen.logicalWidth;
    const h = GAME_CONFIG.screen.logicalHeight;

    // 弾丸: 画面外（マージン50px外）で消滅（BR-W05）
    const bulletIds = world.query(BulletComponent, PositionComponent);
    for (const id of bulletIds) {
      const pos = world.getComponent(id, PositionComponent)!;
      if (pos.x < -margin || pos.x > w + margin || pos.y < -margin || pos.y > h + margin) {
        this.cleanupMesh(world, id);
        world.destroyEntity(id);
      }
    }
  }

  /** エンティティ破棄時のMeshComponent関連リソース解放（BR-MEM01, Iter5: GLTF dispose chain） */
  cleanupMesh(world: World, entityId: number): void {
    const mesh = world.getComponent(entityId, MeshComponent);
    if (!mesh) return;

    if (mesh.instancePool) {
      // InstancedMesh: スロット解放のみ
      mesh.instancePool.release(entityId);
      return;
    }

    // Iter5: AnimationMixer 停止（mixer は scene tree 外なので明示 stop）
    if (mesh.mixer) mesh.mixer.stopAllAction();

    // Iter5: outlineMesh のマテリアル/ジオメトリ dispose（entity ごとに独立生成したため）
    if (mesh.outlineMesh) {
      this.disposeDeep(mesh.outlineMesh);
      if (mesh.outlineMesh.parent) mesh.outlineMesh.parent.remove(mesh.outlineMesh);
    }

    if (mesh.object3D && this.sceneManager) {
      // 個別 Mesh / GLTF clone root: material/geometry を dispose してからシーンから除去
      this.disposeDeep(mesh.object3D);
      this.sceneManager.disposeObject(mesh.object3D);
    }
  }

  /** root 配下の全 Mesh.geometry / material を dispose（Iter5: entity clone 独立リソース用） */
  private disposeDeep(root: import('three').Object3D): void {
    root.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh) return;
      // geometry は clone 済みのため dispose 可
      m.geometry?.dispose();
      if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
      else if (m.material) m.material.dispose();
    });
  }
}
