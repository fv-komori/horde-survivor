import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GAME_CONFIG } from '../config/gameConfig';
import { MeshComponent } from '../components/MeshComponent';
import { PositionComponent } from '../components/PositionComponent';
import { CoordinateMapper } from '../utils/CoordinateMapper';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { SceneManager } from '../rendering/SceneManager';
import type { QualityManager } from '../rendering/QualityManager';
import type { PostFXManager } from '../rendering/PostFXManager';
import type { HTMLOverlayManager } from '../ui/HTMLOverlayManager';
import type { AssetManager } from '../managers/AssetManager';

const LOG_PREFIX = GAME_CONFIG.logPrefix;

/** Three.jsレンダリングシステム（BL-02, BR-R01〜R03） */
export class ThreeJSRenderSystem implements System {
  readonly priority = 99; // 全Systemの最後に実行（BR-R02）

  readonly renderer: WebGLRenderer;
  readonly camera: PerspectiveCamera;

  /** 累積時間（アイテム浮遊アニメーション用） */
  private elapsedTime = 0;

  /** 再利用用ベクトル */
  private readonly _worldPos = new Vector3();

  /** Iter4: PostFXManager参照（GameServiceから初期化後に注入、nullでフォールバック） */
  private postFXManager: PostFXManager | null = null;

  /** Iter5: AssetManager参照（context restored 時に restoreTextures を呼ぶ、null は非GLTFセッション） */
  private assetManager: AssetManager | null = null;

  constructor(
    private readonly container: HTMLElement,
    private sceneManager: SceneManager,
    private qualityManager: QualityManager,
    private overlayManager: HTMLOverlayManager | null,
  ) {
    // WebGLRenderer初期化（Iter4: PCFSoftShadow + ACES Tonemapping）
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = GAME_CONFIG.three.lighting.toneMappingExposure;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.updateRendererSize();
    this.container.appendChild(this.renderer.domElement);

    // カメラ初期化
    const camCfg = GAME_CONFIG.three.camera;
    const aspect = this.renderer.domElement.width / this.renderer.domElement.height;
    this.camera = new PerspectiveCamera(camCfg.fov, aspect, camCfg.near, camCfg.far);
    this.camera.position.set(camCfg.position.x, camCfg.position.y, camCfg.position.z);
    this.camera.lookAt(camCfg.lookAt.x, camCfg.lookAt.y, camCfg.lookAt.z);

    // リサイズハンドリング（NFR-07）
    window.addEventListener('resize', this.handleResize);

    // WebGLコンテキストロスト（BL-07）
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  update(world: World, dt: number): void {
    this.elapsedTime += dt;

    // 品質チェック
    this.qualityManager.measureFPS(dt);
    this.qualityManager.checkQualitySwitch();

    // エンティティ位置同期
    this.syncEntityPositions(world);

    // 背景スクロール
    this.sceneManager.updateBackgroundScroll(dt);

    // HP表示位置 + ワールドラベル + トースト / 武器フラッシュ (Iter6 Phase 5: 30Hz ドレイン)
    if (this.overlayManager) {
      this.overlayManager.updateScheduled(world, this.camera, dt);
    }

    // Iter4: PostFXManager経由でレンダ（内部でenabled/contextLost分岐）、nullの場合は直接
    if (this.postFXManager) {
      this.postFXManager.render(dt);
    } else {
      this.renderer.render(this.sceneManager.scene, this.camera);
    }
  }

  /** エンティティの2D論理座標→3Dワールド座標を同期（BL-02） */
  private syncEntityPositions(world: World): void {
    const entities = world.query(MeshComponent, PositionComponent);

    for (const entityId of entities) {
      const mesh = world.getComponent(entityId, MeshComponent);
      const pos = world.getComponent(entityId, PositionComponent);
      if (!mesh || !pos) continue;

      const height = CoordinateMapper.getEntityHeight(mesh.spriteType, this.elapsedTime);
      const worldVec = CoordinateMapper.toWorld(pos.x, pos.y);

      this._worldPos.set(
        worldVec.x,
        height,
        worldVec.z,
      );

      if (mesh.instancePool && mesh.instanceId >= 0) {
        // InstancedMesh: 行列更新
        mesh.instancePool.updateMatrix(mesh.instanceId, this._worldPos);
      } else if (mesh.object3D) {
        // 個別Mesh: 位置更新
        mesh.object3D.position.copy(this._worldPos);
      }
    }
  }

  // --- リサイズ ---

  private handleResize = (): void => {
    this.updateRendererSize();
    const aspect = this.renderer.domElement.width / this.renderer.domElement.height;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // Iter4: PostFXManagerのRenderTargetも同期
    this.postFXManager?.resize(this.container.clientWidth, this.container.clientHeight);
  };

  private updateRendererSize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.renderer.setSize(width, height);
  }

  // --- WebGLコンテキストロスト（BL-07） ---

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    console.warn(`${LOG_PREFIX} WebGL context lost`);
    // Iter4: PostFXManagerのcomposer.render呼び出しも抑止
    this.postFXManager?.handleContextLost();
  };

  private handleContextRestored = (): void => {
    console.info(`${LOG_PREFIX} WebGL context restored, rebuilding...`);
    try {
      // Iter5 / S-SVC-06b: GLTF テンプレート側のテクスチャを needsUpdate=true（clone へ波及）
      this.assetManager?.restoreTextures();
      this.sceneManager.recompileAllMaterials();
      this.sceneManager.reuploadAllTextures();
      this.sceneManager.rebuildPools();
      // Iter4: PostFX復帰 → QualityManager再適用の順で復元
      this.postFXManager?.handleContextRestored();
      this.qualityManager.setManualOverride(this.qualityManager.getCurrentTier());
    } catch (e) {
      console.error(`${LOG_PREFIX} Failed to restore WebGL context`, e);
    }
  };

  /** HTMLOverlayManager設定（init後に呼び出し） */
  setOverlayManager(overlayManager: HTMLOverlayManager): void {
    this.overlayManager = overlayManager;
  }

  /** Iter4: PostFXManager注入（GameService.init後） */
  setPostFXManager(postFX: PostFXManager | null): void {
    this.postFXManager = postFX;
  }

  /** Iter5: AssetManager注入（context restored 時に textures 再アップロードのため） */
  setAssetManager(am: AssetManager): void {
    this.assetManager = am;
  }

  /** シーンマネージャー/品質マネージャー更新（ゲームリセット時） */
  updateSceneManager(sceneManager: SceneManager, qualityManager: QualityManager): void {
    this.sceneManager = sceneManager;
    this.qualityManager = qualityManager;
  }

  /** canvas要素取得（InputHandler用） */
  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** リソース解放 */
  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.postFXManager?.dispose();
    this.renderer.dispose();
  }
}
