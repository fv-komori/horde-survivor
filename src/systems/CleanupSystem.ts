import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { BulletComponent } from '../components/BulletComponent';
import { PositionComponent } from '../components/PositionComponent';
import { MeshComponent } from '../components/MeshComponent';
import { GAME_CONFIG } from '../config/gameConfig';
import type { SceneManager } from '../rendering/SceneManager';

/**
 * S-11: クリーンアップシステム（優先度98）
 * Iteration 3: MeshComponent保有エンティティのdispose追加（BR-MEM01）
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

  /** エンティティ破棄時のMeshComponent関連リソース解放（BR-MEM01） */
  cleanupMesh(world: World, entityId: number): void {
    const mesh = world.getComponent(entityId, MeshComponent);
    if (!mesh) return;

    if (mesh.instancePool) {
      // InstancedMesh: スロット解放のみ
      mesh.instancePool.release(entityId);
    } else if (mesh.object3D && this.sceneManager) {
      // 個別Mesh: シーンから除去
      this.sceneManager.disposeObject(mesh.object3D);
    }
  }
}
