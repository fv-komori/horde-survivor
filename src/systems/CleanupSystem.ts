import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { BulletComponent } from '../components/BulletComponent';
import { PositionComponent } from '../components/PositionComponent';
import { MeshComponent } from '../components/MeshComponent';
import { AnimationStateComponent } from '../components/AnimationStateComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { BarrelItemComponent } from '../components/BarrelItemComponent';
import { GateComponent } from '../components/GateComponent';
import { GAME_CONFIG } from '../config/gameConfig';
import { Mesh } from 'three';
import type { SceneManager } from '../rendering/SceneManager';
import type { GateTriggerSystem } from './GateTriggerSystem';
import type { WorldToScreenLabel } from '../ui/WorldToScreenLabel';

/**
 * S-11: クリーンアップシステム（priority 98）
 * Iter6: 消費済みゲート / 画面外樽 / GateTriggerSystem.onGateDisposed 通知を追加
 */
export class CleanupSystem implements System {
  readonly priority = 98;

  private sceneManager: SceneManager | null = null;
  private gateTriggerSystem: GateTriggerSystem | null = null;
  private worldToScreenLabel: WorldToScreenLabel | null = null;

  initThree(sceneManager: SceneManager): void {
    this.sceneManager = sceneManager;
  }

  setGateTriggerSystem(g: GateTriggerSystem): void {
    this.gateTriggerSystem = g;
  }

  /** Iter6 Phase 5: ワールドラベル (樽HP/ゲート効果量) の release 用 */
  setWorldToScreenLabel(label: WorldToScreenLabel): void {
    this.worldToScreenLabel = label;
  }

  update(world: World, _dt: number): void {
    const margin = GAME_CONFIG.bullet.screenMargin;
    const w = GAME_CONFIG.screen.logicalWidth;
    const h = GAME_CONFIG.screen.logicalHeight;

    // Death anim 完了の敵エンティティ破棄（プレイヤーは保持）
    const animIds = world.query(AnimationStateComponent);
    for (const id of animIds) {
      const anim = world.getComponent(id, AnimationStateComponent)!;
      if (!anim.deathComplete) continue;
      if (world.getComponent(id, PlayerComponent)) continue;
      this.cleanupMesh(world, id);
      world.destroyEntity(id);
    }

    // 画面外弾丸の消滅（BR-W05）
    const bulletIds = world.query(BulletComponent, PositionComponent);
    for (const id of bulletIds) {
      const pos = world.getComponent(id, PositionComponent)!;
      if (pos.x < -margin || pos.x > w + margin || pos.y < -margin || pos.y > h + margin) {
        this.cleanupMesh(world, id);
        world.destroyEntity(id);
      }
    }

    // Iter6: 消費済みゲート破棄
    const gateIds = world.query(GateComponent, PositionComponent);
    for (const id of gateIds) {
      const gate = world.getComponent(id, GateComponent)!;
      const pos = world.getComponent(id, PositionComponent)!;
      const offScreen =
        pos.y > h + margin || pos.x < -margin || pos.x > w + margin;
      if (gate.consumed || offScreen) {
        this.gateTriggerSystem?.onGateDisposed(id);
        this.worldToScreenLabel?.release(id);
        this.cleanupMesh(world, id);
        world.destroyEntity(id);
      }
    }

    // Iter6: 画面外/防衛ライン越え樽の破棄（HP=0 破壊は CollisionSystem → WeaponSwitchSystem 経由で destroyEntity 済）
    const barrelIds = world.query(BarrelItemComponent, PositionComponent);
    for (const id of barrelIds) {
      const pos = world.getComponent(id, PositionComponent)!;
      if (pos.y > h + margin || pos.x < -margin || pos.x > w + margin) {
        this.worldToScreenLabel?.release(id);
        this.cleanupMesh(world, id);
        world.destroyEntity(id);
      }
    }
  }

  /** エンティティ破棄時の Mesh 関連リソース解放（BR-MEM01） */
  cleanupMesh(world: World, entityId: number): void {
    const mesh = world.getComponent(entityId, MeshComponent);
    if (!mesh) return;

    if (mesh.instancePool) {
      mesh.instancePool.release(entityId);
      return;
    }

    if (mesh.mixer) mesh.mixer.stopAllAction();

    if (mesh.outlineMesh) {
      this.disposeDeep(mesh.outlineMesh);
      if (mesh.outlineMesh.parent) mesh.outlineMesh.parent.remove(mesh.outlineMesh);
    }

    if (mesh.object3D && this.sceneManager) {
      this.disposeDeep(mesh.object3D);
      this.sceneManager.disposeObject(mesh.object3D);
    }
  }

  private disposeDeep(root: import('three').Object3D): void {
    root.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh) return;
      m.geometry?.dispose();
      if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
      else if (m.material) m.material.dispose();
    });
  }
}
