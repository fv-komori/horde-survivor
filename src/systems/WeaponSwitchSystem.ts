import { Object3D } from 'three';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { EntityId } from '../ecs/Entity';
import { PlayerComponent } from '../components/PlayerComponent';
import { PlayerWeaponComponent } from '../components/PlayerWeaponComponent';
import { BarrelItemComponent } from '../components/BarrelItemComponent';
import { MeshComponent } from '../components/MeshComponent';
import { WeaponComponent } from '../components/WeaponComponent';
import type { AssetManager } from '../managers/AssetManager';
import { EventLogger } from '../services/EventLogger';
import { BONE_ATTACH } from '../config/BoneAttachmentConfig';
import { WEAPON_PARAMS } from '../config/weaponConfig';
import { BarrelItemType, WeaponGenre, barrelItemTypeToGenre } from '../types';
import type { ToastQueue } from '../ui/ToastQueue';
import type { WeaponHudPanel } from '../ui/WeaponHudPanel';
import { I18N_TOAST } from '../config/i18nStrings';

interface PendingSwitch {
  barrelId: EntityId;
  type: BarrelItemType;
}

type TransferResult = 'transferred' | 'cloned' | 'failed';

/**
 * C6-07 / Iter6: 武器切替システム（priority 6）
 *
 * CollisionSystem から樽 HP=0 イベントを enqueueSwitch で受領し、
 * プレイヤーの PlayerWeaponComponent を更新しつつ樽の武器 Mesh をプレイヤーに移譲する。
 * transferWeaponMesh は 3 値戻り値で fallback/rollback を表現する（B-NG-2, F-NG-8）。
 */
export class WeaponSwitchSystem implements System {
  readonly priority = 6;
  enabled = true;

  private readonly pending: PendingSwitch[] = [];
  private elapsedTime: number = 0;
  private readonly assetManager: AssetManager;
  private readonly eventLogger: EventLogger;
  private toastQueue: ToastQueue | null = null;
  private weaponHudPanel: WeaponHudPanel | null = null;

  constructor(assetManager: AssetManager) {
    this.assetManager = assetManager;
    this.eventLogger = EventLogger.instance;
  }

  setElapsedTime(t: number): void {
    this.elapsedTime = t;
  }

  /** Iter6 Phase 5: HUD サブクラス直接 DI */
  setHudHandles(toastQueue: ToastQueue, weaponHudPanel: WeaponHudPanel): void {
    this.toastQueue = toastQueue;
    this.weaponHudPanel = weaponHudPanel;
  }

  enqueueSwitch(barrelId: EntityId, type: BarrelItemType): void {
    this.pending.push({ barrelId, type });
  }

  reset(): void {
    this.pending.length = 0;
    this.elapsedTime = 0;
  }

  update(world: World, _dt: number): void {
    if (!this.enabled) return;

    while (this.pending.length > 0) {
      const { barrelId, type } = this.pending.shift()!;
      const barrel = world.getComponent(barrelId, BarrelItemComponent);
      if (!barrel) continue;

      const playerIds = world.query(PlayerComponent, PlayerWeaponComponent, MeshComponent);
      if (playerIds.length === 0) continue;
      const playerId = playerIds[0];
      const weaponComp = world.getComponent(playerId, PlayerWeaponComponent)!;
      const oldGenre = weaponComp.genre;
      const newGenre = barrelItemTypeToGenre(type);

      // genre 暫定更新
      weaponComp.genre = newGenre;
      weaponComp.switchedAt = this.elapsedTime;

      const result = this.transferWeaponMesh(world, barrelId, playerId, newGenre, weaponComp);

      if (result === 'failed') {
        // rollback
        weaponComp.genre = oldGenre;
        weaponComp.switchedAt = 0;
        this.eventLogger.error('weapon_switch_rollback', { oldGenre, newGenre, barrelId });
      } else {
        // 発射間隔を新武器に同期（既存 WeaponComponent 互換のため）
        const wc = world.getComponent(playerId, WeaponComponent);
        if (wc) {
          wc.weaponGenre = newGenre;
          wc.fireInterval = WEAPON_PARAMS[newGenre].fireInterval;
        }
        // Iter6 Phase 5: HUD 更新 + toast (XSS 対策: I18N_TOAST から生成、textContent のみ)
        this.weaponHudPanel?.setGenre(newGenre);
        this.toastQueue?.push({ kind: 'WEAPON', text: I18N_TOAST.weaponAcquired(newGenre) });
        this.eventLogger.info('weapon_switch', {
          from: oldGenre, to: newGenre, result, t: this.elapsedTime,
        });
      }

      // 樽 entity 破棄（cleanupMesh は World.onDestroy 経由、CleanupSystem が dispose chain を処理）
      world.destroyEntity(barrelId);
    }
  }

  /**
   * 4 ステップ契約（F-NG-8 / B-NG-2 / B-NG-18）:
   *   1. barrel の武器 child Object3D を特定
   *   2. player の handBone に attach（world matrix 保持）、offset/rotation 適用
   *   3. 成功確認（parent !== barrel）
   *   4. null 化 + weaponTransferred=true、前装備 mesh を dispose
   * 失敗時: AssetManager.cloneWeaponTemplate で fallback attach を試みる（'cloned'）
   * それも失敗: 'failed'
   */
  private transferWeaponMesh(
    world: World,
    barrelId: EntityId,
    playerId: EntityId,
    newGenre: WeaponGenre,
    weaponComp: PlayerWeaponComponent,
  ): TransferResult {
    try {
      const playerMesh = world.getComponent(playerId, MeshComponent);
      const playerRoot = playerMesh?.object3D;
      if (!playerRoot) return 'failed';

      const handBone = this.findHandBone(playerRoot);
      if (!handBone) throw new Error('handBone not found');

      // 1. barrel の武器 child を特定
      const barrelMesh = world.getComponent(barrelId, MeshComponent);
      const barrelRoot = barrelMesh?.object3D;
      const weaponChild = barrelRoot
        ? (barrelRoot.children.find(c => c.name === 'barrel_weapon_child') ?? null)
        : null;

      if (weaponChild && barrelRoot) {
        // 2. attach（world matrix 保持）
        handBone.attach(weaponChild);
        weaponChild.position.copy(BONE_ATTACH.SOLDIER.offset);
        weaponChild.rotation.copy(BONE_ATTACH.SOLDIER.rotation);
        weaponChild.scale.set(1, 1, 1);
        weaponChild.matrixAutoUpdate = true;
        weaponChild.updateMatrix();

        // 3. 成功確認
        if (weaponChild.parent === barrelRoot) {
          throw new Error('attach did not reparent');
        }

        // 4. 前装備 dispose + 参照差し替え
        this.disposeMesh(weaponComp.currentWeaponMesh);
        weaponComp.currentWeaponMesh = weaponChild;

        const barrelComp = world.getComponent(barrelId, BarrelItemComponent);
        if (barrelComp) barrelComp.weaponTransferred = true;

        return 'transferred';
      }

      // barrel に child がなければ fallback へ
      throw new Error('barrel weapon child missing');
    } catch (e) {
      try {
        const cloned = this.assetManager.cloneWeaponTemplate(newGenre);
        const playerMesh = world.getComponent(playerId, MeshComponent);
        const playerRoot = playerMesh?.object3D;
        if (!playerRoot) return 'failed';
        const handBone = this.findHandBone(playerRoot);
        if (!handBone) return 'failed';

        handBone.add(cloned);
        cloned.position.copy(BONE_ATTACH.SOLDIER.offset);
        cloned.rotation.copy(BONE_ATTACH.SOLDIER.rotation);

        this.disposeMesh(weaponComp.currentWeaponMesh);
        weaponComp.currentWeaponMesh = cloned;

        this.eventLogger.error('weapon_transfer_fallback_clone', {
          genre: newGenre, barrelId, reason: String(e),
        });
        return 'cloned';
      } catch (e2) {
        this.eventLogger.error('weapon_transfer_failed', {
          genre: newGenre, barrelId, reason: String(e2),
        });
        return 'failed';
      }
    }
  }

  private findHandBone(root: Object3D): Object3D | null {
    let found: Object3D | null = null;
    root.traverse((obj) => {
      if (found) return;
      if (obj.name === BONE_ATTACH.SOLDIER.handBone) found = obj;
    });
    return found;
  }

  private disposeMesh(mesh: Object3D | null): void {
    if (!mesh) return;
    mesh.parent?.remove(mesh);
    mesh.traverse((obj) => {
      const m = obj as unknown as { isMesh?: boolean; geometry?: { dispose?: () => void }; material?: unknown };
      if (!m.isMesh) return;
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat && typeof (mat as { dispose?: () => void }).dispose === 'function') {
          (mat as { dispose: () => void }).dispose();
        }
      }
    });
  }
}
