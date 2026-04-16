import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  Object3D,
  Scene,
} from 'three';
import { GAME_CONFIG } from '../config/gameConfig';
import { ProceduralMeshFactory } from '../factories/ProceduralMeshFactory';
import type { InstancedMeshPool } from './InstancedMeshPool';

/** 背景タイルセット */
interface BackgroundTile {
  road: Group;
  guardrailL: Group;
  guardrailR: Group;
}

/** Three.jsシーン管理（BL-02, BL-03） */
export class SceneManager {
  readonly scene: Scene;
  private readonly backgroundTiles: BackgroundTile[] = [];
  private desertGround: Mesh | null = null;
  private directionalLight: DirectionalLight | null = null;

  /** InstancedMeshプール参照（dispose一元化用） */
  private readonly pools: InstancedMeshPool[] = [];

  constructor(private readonly meshFactory: ProceduralMeshFactory) {
    this.scene = new Scene();
    this.scene.background = new Color(0xc9a96e); // 砂漠色の空（遠景）
  }

  /** シーン初期化（ライト・背景・InstancedMesh追加） */
  init(pools: InstancedMeshPool[]): void {
    this.setupLighting();
    this.setupBackground();
    this.registerPools(pools);
  }

  // --- ライティング ---

  private setupLighting(): void {
    const cfg = GAME_CONFIG.three.lighting;

    const ambient = new AmbientLight(cfg.ambientColor, cfg.ambientIntensity);
    this.scene.add(ambient);

    const dir = new DirectionalLight(cfg.directionalColor, cfg.directionalIntensity);
    dir.position.set(cfg.directionalPosition.x, cfg.directionalPosition.y, cfg.directionalPosition.z);
    dir.castShadow = true;
    dir.shadow.mapSize.set(cfg.shadowMapSize, cfg.shadowMapSize);
    dir.shadow.camera.near = 0.1;
    dir.shadow.camera.far = 50;
    dir.shadow.camera.left = -10;
    dir.shadow.camera.right = 10;
    dir.shadow.camera.top = 10;
    dir.shadow.camera.bottom = -15;
    this.directionalLight = dir;
    this.scene.add(dir);
  }

  // --- 背景 ---

  private setupBackground(): void {
    const roadCfg = GAME_CONFIG.three.road;

    // 道路タイル循環配置（BL-03）
    for (let i = 0; i < roadCfg.tileCount; i++) {
      const road = this.meshFactory.createRoadTile();
      const guardrailL = this.meshFactory.createGuardrail('left');
      const guardrailR = this.meshFactory.createGuardrail('right');

      const zPos = -i * roadCfg.length;
      road.position.set(GAME_CONFIG.three.camera.lookAt.x, 0, zPos);
      guardrailL.position.set(GAME_CONFIG.three.camera.lookAt.x, 0, zPos);
      guardrailR.position.set(GAME_CONFIG.three.camera.lookAt.x, 0, zPos);

      this.scene.add(road);
      this.scene.add(guardrailL);
      this.scene.add(guardrailR);

      this.backgroundTiles.push({ road, guardrailL, guardrailR });
    }

    // 砂漠地面
    this.desertGround = this.meshFactory.createDesertGround();
    this.scene.add(this.desertGround);
  }

  /** 背景スクロール更新（BL-03毎フレーム更新） */
  updateBackgroundScroll(dt: number): void {
    const cfg = GAME_CONFIG.three.road;
    const totalLength = cfg.length * cfg.tileCount;
    const resetThreshold = cfg.length;

    for (const tile of this.backgroundTiles) {
      tile.road.position.z += cfg.scrollSpeed * dt;
      tile.guardrailL.position.z += cfg.scrollSpeed * dt;
      tile.guardrailR.position.z += cfg.scrollSpeed * dt;

      if (tile.road.position.z > resetThreshold) {
        tile.road.position.z -= totalLength;
        tile.guardrailL.position.z -= totalLength;
        tile.guardrailR.position.z -= totalLength;
      }
    }
  }

  // --- InstancedMeshプール管理 ---

  private registerPools(pools: InstancedMeshPool[]): void {
    for (const pool of pools) {
      this.pools.push(pool);
      this.scene.add(pool.instancedMesh);
    }
  }

  // --- エンティティ Object3D 管理 ---

  /** 個別Object3Dをシーンに追加 */
  addEntity(object3D: Object3D): void {
    this.scene.add(object3D);
  }

  /** 個別Object3Dをシーンから除去 */
  removeEntity(object3D: Object3D): void {
    this.scene.remove(object3D);
  }

  /** Object3Dのリソースをdispose（BR-MEM01） */
  disposeObject(object3D: Object3D): void {
    object3D.traverse((child) => {
      if (child instanceof Mesh) {
        // ジオメトリはキャッシュ共有のためdisposeしない（Factory管理）
        // マテリアルもキャッシュ共有のためdisposeしない
      }
    });
    // シーンから除去
    this.scene.remove(object3D);
  }

  // --- 品質切替 ---

  /** シャドウの有効/無効切替（BR-Q02） */
  setShadowEnabled(enabled: boolean): void {
    if (this.directionalLight) {
      this.directionalLight.castShadow = enabled;
    }
  }

  // --- コンテキストロスト復帰 ---

  /** 全マテリアルの再コンパイル（BL-07） */
  recompileAllMaterials(): void {
    this.scene.traverse((child) => {
      if (child instanceof Mesh && child.material) {
        const mat = child.material;
        if (Array.isArray(mat)) {
          mat.forEach(m => { m.needsUpdate = true; });
        } else {
          mat.needsUpdate = true;
        }
      }
    });
  }

  /** 全テクスチャの再アップロード（BL-07） */
  reuploadAllTextures(): void {
    // プロシージャルのため外部テクスチャなし
    // 将来のGLTF対応時にここでテクスチャneedsUpdate=trueを設定
  }

  /** 全プールの再構築 */
  rebuildPools(): void {
    for (const pool of this.pools) {
      pool.rebuild();
    }
  }

  // --- クリーンアップ ---

  /** シーン全体をクリア（ゲームリセット時。BR-MEM03: rendererはdisposeしない） */
  clearScene(): void {
    // 背景タイル以外の子要素を除去
    const toRemove: Object3D[] = [];
    this.scene.traverse((child) => {
      if (child !== this.scene) {
        toRemove.push(child);
      }
    });
    for (const obj of toRemove) {
      this.scene.remove(obj);
    }
    this.backgroundTiles.length = 0;
    this.pools.length = 0;
    this.desertGround = null;
    this.directionalLight = null;
  }

  /** 完全解放 */
  dispose(): void {
    for (const pool of this.pools) {
      pool.dispose();
    }
    this.meshFactory.disposeAll();
    this.clearScene();
  }
}
