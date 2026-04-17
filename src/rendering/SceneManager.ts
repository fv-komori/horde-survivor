import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshToonMaterial,
  Object3D,
  Scene,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import { GAME_CONFIG } from '../config/gameConfig';
import type { InstancedMeshPool } from './InstancedMeshPool';

/** 背景タイルセット */
interface BackgroundTile {
  road: Group;
  guardrailL: Group;
  guardrailR: Group;
}

/** Three.jsシーン管理（BL-02, BL-03, Iter4: Hemi/Fog/Sky/Outline切替） */
export class SceneManager {
  readonly scene: Scene;
  private readonly backgroundTiles: BackgroundTile[] = [];
  private desertGround: Mesh | null = null;
  private directionalLight: DirectionalLight | null = null;
  private hemisphereLight: HemisphereLight | null = null;
  private skyMesh: Mesh | null = null;

  /** Iter4: Hemi OFF時のDirectional補正用、元intensity保持 */
  private baseDirectionalIntensity: number = 1.0;
  private hemiEnabled: boolean = true;

  /** InstancedMeshプール参照（dispose一元化用） */
  private readonly pools: InstancedMeshPool[] = [];

  /** 背景用 Material / Geometry キャッシュ（Iter5: ProceduralMeshFactory から移設 Option B） */
  private readonly envMaterials = new Map<string, MeshToonMaterial>();
  private readonly envGeometries = new Map<string, BoxGeometry>();

  constructor() {
    this.scene = new Scene();
  }

  /** シーン初期化（ライト・背景・InstancedMesh追加） */
  init(pools: InstancedMeshPool[]): void {
    this.setupLighting();
    this.setupFog();
    this.setupBackground();
    this.registerPools(pools);
  }

  // --- ライティング ---

  private setupLighting(): void {
    const cfg = GAME_CONFIG.three.lighting;

    const ambient = new AmbientLight(cfg.ambientColor, cfg.ambientIntensity);
    this.scene.add(ambient);

    // Iter4: HemisphereLight（空色→地面色のバウンス）
    const hemi = new HemisphereLight(cfg.hemisphereSkyColor, cfg.hemisphereGroundColor, cfg.hemisphereIntensity);
    this.hemisphereLight = hemi;
    this.scene.add(hemi);

    const dir = new DirectionalLight(cfg.directionalColor, cfg.directionalIntensity);
    this.baseDirectionalIntensity = cfg.directionalIntensity;
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

  // --- Fog ---

  private setupFog(): void {
    const cfg = GAME_CONFIG.three.fog;
    this.scene.fog = new Fog(cfg.color, cfg.near, cfg.far);
  }

  // --- 背景 ---

  private setupBackground(): void {
    const roadCfg = GAME_CONFIG.three.road;

    // Iter4: グラデーション空ドーム（SphereGeometry BackSide + ShaderMaterial）
    this.setupSkyDome();

    // 道路タイル循環配置（BL-03）
    for (let i = 0; i < roadCfg.tileCount; i++) {
      const road = this.createRoadTile();
      const guardrailL = this.createGuardrail('left');
      const guardrailR = this.createGuardrail('right');

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
    this.desertGround = this.createDesertGround();
    this.scene.add(this.desertGround);
  }

  // --- 環境メッシュ生成ヘルパー（Iter5: Option B 移設） ---

  private getEnvMaterial(color: number): MeshToonMaterial {
    const key = color.toString(16);
    let mat = this.envMaterials.get(key);
    if (!mat) {
      mat = new MeshToonMaterial({ color });
      this.envMaterials.set(key, mat);
    }
    return mat;
  }

  private getEnvBox(w: number, h: number, d: number): BoxGeometry {
    const key = `box_${w}_${h}_${d}`;
    let geo = this.envGeometries.get(key);
    if (!geo) {
      geo = new BoxGeometry(w, h, d);
      this.envGeometries.set(key, geo);
    }
    return geo;
  }

  /** 道路タイル（BL-03） */
  private createRoadTile(): Group {
    const cfg = GAME_CONFIG.three.road;
    const group = new Group();
    group.name = 'road_tile';

    const road = new Mesh(this.getEnvBox(cfg.width, 0.02, cfg.length), this.getEnvMaterial(cfg.color));
    road.position.y = 0;
    road.receiveShadow = true;
    group.add(road);

    const dashCount = Math.floor(cfg.length / 0.6);
    const lineMat = this.getEnvMaterial(cfg.lineColor);
    const dashGeo = this.getEnvBox(cfg.lineWidth, 0.025, 0.3);
    for (let i = 0; i < dashCount; i++) {
      const dash = new Mesh(dashGeo, lineMat);
      dash.position.set(0, 0.015, -cfg.length / 2 + 0.3 + i * 0.6);
      group.add(dash);
    }
    return group;
  }

  /** ガードレール（Iter4: 縦杭+横木2本） */
  private createGuardrail(side: 'left' | 'right'): Group {
    const cfg = GAME_CONFIG.three.guardrail;
    const roadCfg = GAME_CONFIG.three.road;
    const group = new Group();
    group.name = `guardrail_${side}`;

    const xPos = side === 'left' ? -roadCfg.width / 2 - 0.05 : roadCfg.width / 2 + 0.05;
    const postMat = this.getEnvMaterial(cfg.color);
    const railMat = this.getEnvMaterial(cfg.topRailColor);

    const postGeo = this.getEnvBox(0.08, cfg.height, 0.08);
    const postCount = Math.floor(roadCfg.length / cfg.postSpacing) + 1;
    for (let i = 0; i < postCount; i++) {
      const post = new Mesh(postGeo, postMat);
      post.position.set(xPos, cfg.height / 2, -i * cfg.postSpacing);
      post.castShadow = true;
      group.add(post);
    }

    const railGeo = this.getEnvBox(0.05, 0.05, roadCfg.length);
    const railTop = new Mesh(railGeo, railMat);
    railTop.position.set(xPos, cfg.height * 0.9, -roadCfg.length / 2);
    railTop.castShadow = true;
    group.add(railTop);

    const railMid = new Mesh(railGeo, railMat);
    railMid.position.set(xPos, cfg.height * 0.5, -roadCfg.length / 2);
    railMid.castShadow = true;
    group.add(railMid);

    return group;
  }

  /** 砂漠地面（FR-02） */
  private createDesertGround(): Mesh {
    const cfg = GAME_CONFIG.three.desert;
    const roadCfg = GAME_CONFIG.three.road;
    const totalDepth = roadCfg.length * roadCfg.tileCount + 20;
    const mesh = new Mesh(this.getEnvBox(cfg.width, 0.01, totalDepth), this.getEnvMaterial(cfg.color));
    mesh.position.set(GAME_CONFIG.three.camera.lookAt.x, -0.01, -totalDepth / 2 + 5);
    mesh.receiveShadow = true;
    mesh.name = 'desert_ground';
    return mesh;
  }

  /** グラデ空ドーム（Iter4: FR-07） */
  private setupSkyDome(): void {
    const cfg = GAME_CONFIG.three.sky;
    // GLSLは静的リテラルのみ（BR-CSP01, 動的結合禁止）
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `;
    const fragmentShader = `
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform float uOffset;
      uniform float uExponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, uOffset, 0.0)).y;
        float t = max(pow(max(h, 0.0), uExponent), 0.0);
        gl_FragColor = vec4(mix(uBottomColor, uTopColor, t), 1.0);
      }
    `;
    const uniforms = {
      uTopColor: { value: new Color(cfg.topColor) },
      uBottomColor: { value: new Color(cfg.bottomColor) },
      uOffset: { value: cfg.offset },
      uExponent: { value: cfg.exponent },
    };
    const mat = new ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      side: BackSide,
      depthWrite: false,
      fog: false, // Fog の影響を受けない
    });
    const geo = new SphereGeometry(cfg.radius, 24, 16);
    const sky = new Mesh(geo, mat);
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    sky.name = 'sky_dome';
    this.skyMesh = sky;
    this.scene.add(sky);
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
        // ジオメトリ・マテリアルはFactoryキャッシュ共有のためdisposeしない
      }
    });
    this.scene.remove(object3D);
  }

  // --- 品質切替 ---

  /** シャドウの有効/無効切替（BR-Q02） */
  setShadowEnabled(enabled: boolean): void {
    if (this.directionalLight) {
      this.directionalLight.castShadow = enabled;
    }
  }

  /** Iter4: HemisphereLight切替（intensity=0で無効化、シェーダ再コンパイル回避） */
  setHemisphereEnabled(enabled: boolean): void {
    if (this.hemisphereLight == null || this.directionalLight == null) return;
    if (this.hemiEnabled === enabled) return;
    const cfg = GAME_CONFIG.three.lighting;
    if (enabled) {
      this.hemisphereLight.intensity = cfg.hemisphereIntensity;
      this.directionalLight.intensity = this.baseDirectionalIntensity;
    } else {
      this.hemisphereLight.intensity = 0;
      // Hemi OFF時はDirectional×1.15で明度保持
      this.directionalLight.intensity = this.baseDirectionalIntensity * cfg.directionalBoostWhenHemiOff;
    }
    this.hemiEnabled = enabled;
  }

  /** Iter4: Fog切替（fog.far=9999で実質無効化、USE_FOG ifdefを走らせない） */
  setFogEnabled(enabled: boolean): void {
    if (this.scene.fog == null) return;
    const cfg = GAME_CONFIG.three.fog;
    if (this.scene.fog instanceof Fog) {
      this.scene.fog.far = enabled ? cfg.far : cfg.disabledFar;
    }
  }

  /** Iter4: Outline切替（userData.isOutline の visible を一括切替、生成/破棄なし） */
  setOutlineEnabled(enabled: boolean): void {
    this.scene.traverse((child) => {
      if (child instanceof Mesh && child.userData.isOutline === true) {
        child.visible = enabled;
      }
    });
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
    this.hemisphereLight = null;

    if (this.skyMesh) {
      if (this.skyMesh.material instanceof ShaderMaterial) {
        this.skyMesh.material.dispose();
      }
      this.skyMesh.geometry.dispose();
      this.skyMesh = null;
    }
  }

  /** 完全解放 */
  dispose(): void {
    for (const pool of this.pools) {
      pool.dispose();
    }
    for (const m of this.envMaterials.values()) m.dispose();
    this.envMaterials.clear();
    for (const g of this.envGeometries.values()) g.dispose();
    this.envGeometries.clear();
    this.clearScene();
  }
}
