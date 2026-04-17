# コンポーネントメソッド詳細 - Iteration 5

（TypeScript型シグネチャを中心に、振る舞いの補足を記載。components-v5.md の外観表と合わせて参照）

---

## C-01: AssetManager

```ts
type CharacterType = 'Soldier' | 'Enemy' | 'Hazmat';
type GunType = 'AK' | 'Pistol' | 'Shotgun';
type EnvType = 'Barrier_Single' | 'Crate' | 'SackTrench' | 'Fence' | 'Fence_Long' | 'Tree_1';

interface GltfTemplate {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

class AssetManager {
  private loader: GLTFLoader;
  private characters: Map<CharacterType, GltfTemplate> = new Map();
  private guns: Map<GunType, GltfTemplate> = new Map();
  private environments: Map<EnvType, GltfTemplate> = new Map();
  private loaded: boolean = false;

  constructor() {
    this.loader = new GLTFLoader();
  }

  /** 全GLTFを並列ロード。Promise.all + Promise.race でタイムアウト重畳 */
  async load(onProgress?: (loaded: number, total: number) => void): Promise<void>;

  /** ロード完了判定（EntityFactory DI assertに使用） */
  isLoaded(): boolean;

  /** テンプレート取得（clone元として参照される、不変） */
  getCharacter(type: CharacterType): GltfTemplate;
  getGun(type: GunType): GltfTemplate;
  getEnvironment(type: EnvType): GltfTemplate;
}
```

### load() 内部実装ガイドライン（FIX-B: fetch + parse 統一方式）

```ts
private async loadOne(url: string, timeoutMs = 30000): Promise<GltfTemplate> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('ASSET_HTTP_ERROR', { cause: { url, status: res.status } });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 3 * 1024 * 1024) {
      throw new Error('ASSET_PAYLOAD_EXCEEDED', { cause: { url, byteLength: buf.byteLength, limit: 3_000_000 } });
    }
    return await new Promise<GltfTemplate>((resolve, reject) => {
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      this.loader.parse(
        buf, baseUrl,
        (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations }),
        (err) => reject(Object.assign(new Error('GLTF_PARSE_ERROR'), { cause: { url, inner: err } })),
      );
    });
  } finally {
    clearTimeout(timer);
  }
}
```

- 全12ファイルを `Promise.all([...])` で並列、個別のAbortControllerを配列保持
- 全体タイムアウト: `Promise.race([all, sleep(60000).then(() => { ctrls.forEach(c => c.abort()); throw new Error('ASSET_LOAD_TIMEOUT_60S'); })])`
- onProgress は各 loadOne resolve 時に呼出（loaded++）
- **retry対象外**: HTTP 404 / payload超過 / parseエラーは再試行しても復旧しないため即 `FATAL_ASSET_LOAD_FAILURE` として UI 表示
- 1件でも失敗すれば全体 reject、他の in-flight fetch を abort（部分起動禁止）

---

## C-02: AnimationSystem

```ts
// FIX-K: 暫定閾値（Construction Day 1 で調整）
const VELOCITY_THRESHOLD_SQ = 0.01;  // 0.1 unit/sec の二乗、これ未満を静止とみなす
// ヒステリシス案（検討）: Run遷移 velSq>0.01、Idle復帰 velSq<0.005
const HITREACT_DURATION = 0.4;       // FIX-F: HitReact持続時間、Construction Day 1 で実測調整

class AnimationSystem implements System {
  readonly priority = 50;  // FIX-J: 確定値。Combat/Health/Movement/AI/Spawn/Weapon の後、Cleanup/Render の前

  update(world: World, dt: number): void {
    for (const entity of world.query(MeshComponent, AnimationStateComponent)) {
      const mesh = entity.get(MeshComponent);
      const anim = entity.get(AnimationStateComponent);

      if (!mesh.mixer || !mesh.animations) continue;

      // 1. hitReactTimer 減算（FIX-F: timer自動復帰方式、finished listener不使用）
      if (anim.hitReactTimer > 0) {
        anim.hitReactTimer = Math.max(0, anim.hitReactTimer - dt);
      }

      // 2. 目標 clip 決定
      const target = this.decideClip(entity, anim);

      // 3. clip 切替（初回は currentClip='Idle_Shoot' と一致、transitionTo通らず setupAnimationsでplay済、FIX-G）
      if (anim.currentClip !== target) {
        this.transitionTo(entity, mesh, anim, target);
      }

      // 4. mixer 駆動
      mesh.mixer.update(dt);
    }
  }

  /** state machine */
  private decideClip(entity: Entity, anim: AnimationStateComponent): string {
    if (anim.deathFlag) return 'Death';
    if (anim.hitReactTimer > 0) return 'HitReact';
    const vel = entity.get(VelocityComponent);
    const velSq = vel ? (vel.x * vel.x + vel.z * vel.z) : 0;
    return velSq > VELOCITY_THRESHOLD_SQ ? 'Run_Shoot' : 'Idle_Shoot';
  }

  private transitionTo(entity, mesh, anim, target): void {
    const nextAction = mesh.animations!.get(target);
    if (!nextAction) return;
    const prevAction = anim.currentClip ? mesh.animations!.get(anim.currentClip) : null;

    // FIX-E: 既存 finished listener を必ず解除（二重登録・リーク防止）
    if (anim.finishedListener) {
      mesh.mixer!.removeEventListener('finished', anim.finishedListener);
      anim.finishedListener = null;
    }

    if (target === 'Death') {
      if (prevAction) prevAction.stop();
      nextAction.reset();
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.play();

      const handler = (event: { action: THREE.AnimationAction }) => {
        // FIX-E/F-NG-12: clip名判定で誤発火防止
        if (event.action.getClip().name === 'Death') {
          entity.add(new DeathCompleteFlag());  // FIX-H: linger: 0.3 デフォルト
          mesh.mixer!.removeEventListener('finished', handler);
          anim.finishedListener = null;
        }
      };
      mesh.mixer!.addEventListener('finished', handler);
      anim.finishedListener = handler;
    } else if (target === 'HitReact') {
      // FIX-F: HitReact は hitReactTimer で自動復帰、finished listener は使わない
      if (prevAction) prevAction.stop();
      nextAction.reset();
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = false;  // 終了時 weight=0 に戻し次遷移の crossFade 問題を防ぐ
      nextAction.play();
    } else {
      // Run_Shoot / Idle_Shoot: crossFade 0.1秒
      if (prevAction) {
        prevAction.crossFadeTo(nextAction.reset().play(), 0.1, false);
      } else {
        nextAction.reset().play();
      }
    }

    anim.currentClip = target;
  }
  // FIX-S: updateStandalone は削除。GameStartScreen は直接 mixer.update を呼ぶ
}
```

---

## C-03: AnimationStateComponent

```ts
class AnimationStateComponent {
  hitReactTimer: number = 0;
  deathFlag: boolean = false;
  currentClip: string = '';
  finishedListener: ((event: any) => void) | null = null;  // removeEventListener用参照保持
}
```

---

## C-04: LoaderScreen

```ts
class LoaderScreen {
  readonly root: HTMLDivElement;
  private progressBar: HTMLDivElement;
  private progressText: HTMLSpanElement;
  private state: 'loading' | 'error' = 'loading';
  private retryCount: number = 0;

  constructor();
  show(): void;
  hide(): void;
  updateProgress(loaded: number, total: number): void;
  showError(errorId: string): void;  // FIX-R: 固定IDのみ受付、UI_MESSAGES で汎用文言にマッピング
  onRetry(callback: () => void): void;

  // 初回 DOM 構築は textContent / appendChild / createElement のみ（XSS対策）
  // DOM置換は replaceChildren / replaceWith のみ、innerHTML 禁止
}

// FIX-R: UI層 エラーメッセージ固定IDマップ
const UI_MESSAGES: Record<string, string> = {
  ASSET_HTTP_ERROR: 'アセットの読み込みに失敗しました。再試行してください。',
  ASSET_PAYLOAD_EXCEEDED: 'アセットサイズが上限を超過しています。',
  ASSET_LOAD_TIMEOUT_60S: 'アセットの読み込みがタイムアウトしました。',
  GLTF_PARSE_ERROR: 'アセットファイルが破損しています。',
  FATAL_ASSET_LOAD_FAILURE: '起動に失敗しました。ブラウザをリロードしてください。',
  FACTORY_BONE_NOT_FOUND: 'キャラクターの初期化に失敗しました。',
};
```

### DOM構造（概略）
```html
<div id="loader-screen">
  <div class="loader-content">
    <span class="loader-text">Loading...</span>
    <div class="progress-bar-container">
      <div class="progress-bar" style="width: X%"></div>
    </div>
    <span class="progress-text">0 / 12</span>
    <!-- エラー時のみ -->
    <div class="error-panel" hidden>
      <span class="error-text"></span>
      <button class="retry-btn">再試行</button>
    </div>
  </div>
</div>
```

---

## C-05: EntityFactory

```ts
class EntityFactory {
  constructor(
    private world: World,
    private assetManager: AssetManager,
    private sceneManager: SceneManager,
  ) {
    if (!assetManager.isLoaded()) {
      throw new Error('EntityFactory requires loaded AssetManager');
    }
  }

  createPlayer(spawnPos: Vector3): EntityId;
  createAlly(spawnPos: Vector3): EntityId;
  createEnemy(variant: 'NORMAL' | 'FAST' | 'TANK', spawnPos: Vector3): EntityId;
  createBoss(spawnPos: Vector3): EntityId;

  // 内部
  private buildCharacterEntity(
    character: CharacterType,
    gunType: GunType,
    tint: number,
    scale: number,
    spawnPos: Vector3,
    extraComponents: Component[],  // Player特有、Enemy特有等
  ): EntityId;

  private cloneGltfScene(template: GltfTemplate): THREE.Object3D {
    const root = SkeletonUtils.clone(template.scene);
    this.cloneMaterialsRecursive(root);
    return root;
  }

  /** F-NG-16対応: 全 SkinnedMesh の material を個別clone */
  private cloneMaterialsRecursive(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = obj as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(m => m.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
      }
    });
  }

  private applyTint(root: THREE.Object3D, color: number): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of materials) {
          if ('color' in m) (m as any).color.set(color);
        }
      }
    });
  }

  /** FR-06: 反転ハル、geometry clone + skeleton 共有 bind 方式（FIX-C / FIX-D対応） */
  private createOutlineMesh(bodyRoot: THREE.Object3D): THREE.Object3D {
    // FIX-D: SkeletonUtils.clone は使わない（独自 skeleton が生成され本体と同期しないため）
    const outlineRoot = new THREE.Group();
    outlineRoot.name = 'outline-root';

    bodyRoot.traverse((obj) => {
      const body = obj as THREE.SkinnedMesh;
      if (!body.isSkinnedMesh) return;

      const clonedGeo = body.geometry.clone();
      // FIX-C: skinning flag は指定しない（r181+ で廃止）、vertex shader 内で #include <skinning_pars_vertex> 系を使う
      const mat = new THREE.ShaderMaterial({
        vertexShader: OUTLINE_VERTEX_SHADER,
        fragmentShader: OUTLINE_FRAGMENT_SHADER,
        side: THREE.BackSide,
        uniforms: {
          outlineThickness: { value: 0.02 },
          outlineColor: { value: new THREE.Color(0x000000) },
        },
      });
      const outlineMesh = new THREE.SkinnedMesh(clonedGeo, mat);
      outlineMesh.bind(body.skeleton, body.bindMatrix);  // 本体と同じ skeleton/bindMatrix
      outlineMesh.scale.copy(body.scale);
      outlineMesh.position.copy(body.position);
      outlineMesh.quaternion.copy(body.quaternion);

      // 本体の親に add（兄弟配置、本体 root 内の bone 階層を参照）
      body.parent!.add(outlineMesh);
    });

    return outlineRoot;
  }

  private attachGun(root: THREE.Object3D, gunType: GunType, charType: CharacterType): void {
    const gunTemplate = this.assetManager.getGun(gunType);
    const gunMesh = gunTemplate.scene.clone(true);

    // FIX-I: gun material も entity ごとに独立 clone（tint/破損表現の波及防止）
    gunMesh.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      if (Array.isArray(m.material)) m.material = m.material.map(x => x.clone());
      else if (m.material) m.material = m.material.clone();
    });

    const config = BONE_ATTACH[charType];
    const handBone = root.getObjectByName(config.handBone);
    if (!handBone) {
      // FIX-R: エラーメッセージ3層分界、固定ID + cause
      throw Object.assign(new Error('FACTORY_BONE_NOT_FOUND'), {
        cause: { charType, bone: config.handBone },
      });
    }
    gunMesh.position.copy(config.offset);
    gunMesh.rotation.copy(config.rotation);
    handBone.add(gunMesh);
  }

  private setupAnimations(
    mixer: THREE.AnimationMixer,
    clips: THREE.AnimationClip[],
  ): Map<string, THREE.AnimationAction> {
    const actions = new Map<string, THREE.AnimationAction>();
    const needed = ['Idle_Shoot', 'Run_Shoot', 'HitReact', 'Death', 'Idle'];
    for (const clip of clips) {
      if (needed.includes(clip.name)) {
        actions.set(clip.name, mixer.clipAction(clip));
      }
    }
    // FIX-G: 初期 clip を即再生（AnimationStateComponent.currentClip='Idle_Shoot' と整合）
    actions.get('Idle_Shoot')?.play();
    return actions;
  }
}
```

---

## C-06: MeshComponent（拡張）

```ts
class MeshComponent {
  mesh: THREE.Object3D;  // 既存

  // 🆕 optional 追加
  mixer?: THREE.AnimationMixer;
  animations?: Map<string, THREE.AnimationAction>;
  outlineMesh?: THREE.Object3D;
}
```

---

## C-07: CleanupSystem（dispose部分）

```ts
class CleanupSystem implements System {
  readonly priority = 55;  // FIX-J: 確定値。AnimationSystem(50)直後、ThreeJSRenderSystem(60)の前

  update(world: World, dt: number): void {
    // 1. DeathCompleteFlag linger 消化（FIX-H / F-NEW-01対応、linger>0 は最終ポーズ保持）
    for (const entity of world.query(DeathCompleteFlag)) {
      const flag = entity.get(DeathCompleteFlag);
      flag.linger -= dt;
      if (flag.linger <= 0) {
        this.processDeath(world, entity);  // XPドロップ→dispose→削除
      }
      // linger>0 の間は mesh/mixer を残し clampWhenFinished の最終ポーズで静止
    }
    // 2. 既存の削除処理（画面外弾丸等）
    // ...
  }

  private processDeath(world: World, entity: Entity): void {
    // FIX-E: forceDispose経路でも finished listener を必ず解除（メモリリーク防止）
    const anim = entity.get(AnimationStateComponent);
    const mesh = entity.get(MeshComponent);
    if (anim?.finishedListener && mesh?.mixer) {
      mesh.mixer.removeEventListener('finished', anim.finishedListener);
      anim.finishedListener = null;
    }

    // (a) XPドロップ
    const pos = entity.get(PositionComponent);
    if (pos) dropXP(world, pos);

    // (b) dispose chain
    if (mesh) {
      if (mesh.mixer) {
        mesh.mixer.stopAllAction();
        mesh.animations?.forEach((action) => {
          mesh.mixer!.uncacheAction(action.getClip());
        });
        mesh.mixer.uncacheRoot(mesh.mesh);
      }
      this.disposeDeep(mesh.mesh);
      if (mesh.outlineMesh) {
        this.disposeDeep(mesh.outlineMesh);
      }
    }

    // (c) entity削除
    world.removeEntity(entity);
  }

  /** FIX-P / O-NG-3対応: teardown 時に Death 途中 entity も即dispose */
  forceDisposeAll(world: World): void {
    for (const entity of world.allEntities()) {
      const anim = entity.get(AnimationStateComponent);
      const mesh = entity.get(MeshComponent);
      if (anim?.finishedListener && mesh?.mixer) {
        mesh.mixer.removeEventListener('finished', anim.finishedListener);
        anim.finishedListener = null;
      }
      if (mesh) {
        if (mesh.mixer) {
          mesh.mixer.stopAllAction();
          mesh.animations?.forEach(a => mesh.mixer!.uncacheAction(a.getClip()));
          mesh.mixer.uncacheRoot(mesh.mesh);
        }
        this.disposeDeep(mesh.mesh);
        if (mesh.outlineMesh) this.disposeDeep(mesh.outlineMesh);
      }
      world.removeEntity(entity);
    }
  }

  private disposeDeep(root: THREE.Object3D): void {
    root.parent?.remove(root);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of materials) m.dispose();
      }
    });
  }
}
```

---

## C-08: CombatSystem（追記箇所）

```ts
// ダメージ判定成功時
const anim = target.get(AnimationStateComponent);
if (anim && !anim.deathFlag) {
  anim.hitReactTimer = 0.4;
}
```

---

## C-09: HealthSystem（変更箇所）

```ts
// 旧（Iter4）
if (health.hp <= 0) {
  world.removeEntity(entity);  // 即削除
}

// 新（Iter5）
if (health.hp <= 0) {
  const anim = entity.get(AnimationStateComponent);
  if (anim) {
    anim.deathFlag = true;  // Death アニメ再生 → CleanupSystem が完了検知で削除
  } else {
    world.removeEntity(entity);  // 弾丸等、アニメなしエンティティは従来通り
  }
}
```

---

## C-10: SceneManager（追記部分）

```ts
setupEnvironment(assetManager: AssetManager): void {
  // 既存: 道路・地面タイル setup (維持)
  this.setupGroundTiles();
  this.setupRoadTiles();

  // GLTF環境物配置
  this.placeGltfAt(assetManager.getEnvironment('Fence'), ...);
  this.placeGltfAt(assetManager.getEnvironment('Fence_Long'), ...);
  this.placeGltfAt(assetManager.getEnvironment('Crate'), ...);
  this.placeGltfAt(assetManager.getEnvironment('SackTrench'), ...);
  this.placeGltfAt(assetManager.getEnvironment('Barrier_Single'), ...);
  this.placeGltfAt(assetManager.getEnvironment('Tree_1'), ...);
}

private placeGltfAt(template: GltfTemplate, pos: Vector3, rot?: Euler): void {
  const clone = template.scene.clone(true);  // static mesh なので SkeletonUtils 不要
  clone.position.copy(pos);
  if (rot) clone.rotation.copy(rot);
  this.scene.add(clone);
  // アウトライン付与なし（FR-06）
}
```

---

## C-11: GameStartScreen（追記部分）

```ts
class GameStartScreen {
  private previewScene?: THREE.Scene;
  private previewCamera?: THREE.PerspectiveCamera;
  private previewRenderer?: THREE.WebGLRenderer;
  private previewMixer?: THREE.AnimationMixer;
  private previewRoot?: THREE.Object3D;  // FIX-S: dispose対象として保持
  private rafId?: number;
  private lastT?: number;                // FIX-S: dt計算用

  hide(): void {
    this.stopPreviewLoop();
    this.disposePreview();
  }

  // FIX-S: 二重生成ガード追加
  show(assetManager: AssetManager): void {
    if (this.previewRenderer) this.hide();
    this.setupPreview(assetManager);
    this.startPreviewLoop();
  }

  private setupPreview(assetManager: AssetManager): void {
    this.previewScene = new THREE.Scene();
    this.previewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.previewRenderer = new THREE.WebGLRenderer({ canvas: this.previewCanvas, alpha: true });
    const template = assetManager.getCharacter('Soldier');
    this.previewRoot = SkeletonUtils.clone(template.scene);
    // FIX-S: material 独立性確保（メイン World と共有しない）
    this.cloneMaterialsRecursive(this.previewRoot);
    this.previewScene.add(this.previewRoot);
    this.previewMixer = new THREE.AnimationMixer(this.previewRoot);
    const idleClip = template.animations.find(c => c.name === 'Idle');
    if (idleClip) this.previewMixer.clipAction(idleClip).play();
  }

  private cloneMaterialsRecursive(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      if (Array.isArray(m.material)) m.material = m.material.map(x => x.clone());
      else if (m.material) m.material = m.material.clone();
    });
  }

  private startPreviewLoop(): void {
    const loop = (t: number) => {
      const dt = this.lastT != null ? (t - this.lastT) / 1000 : 0;
      this.lastT = t;
      // FIX-S: AnimationSystem.updateStandalone は使わず直接 mixer.update
      this.previewMixer?.update(dt);
      this.previewRenderer?.render(this.previewScene!, this.previewCamera!);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopPreviewLoop(): void {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = undefined;
    this.lastT = undefined;
  }

  /** FIX-S / O-NG-5対応: 具体実装 */
  private disposePreview(): void {
    // 1. mixer 停止 + uncache
    if (this.previewMixer && this.previewRoot) {
      this.previewMixer.stopAllAction();
      this.previewMixer.uncacheRoot(this.previewRoot);
    }
    // 2. scene graph dispose
    this.previewRoot?.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) mat.dispose();
      }
    });
    if (this.previewRoot) this.previewScene?.remove(this.previewRoot);
    // 3. renderer dispose + context loss
    this.previewRenderer?.dispose();
    this.previewRenderer?.forceContextLoss();

    this.previewScene = undefined;
    this.previewCamera = undefined;
    this.previewRenderer = undefined;
    this.previewMixer = undefined;
    this.previewRoot = undefined;
  }
}
```

---

## C-13: AssetPaths（定数）

components-v5.md に記載済み、再掲略。

---

## C-14: BoneAttachmentConfig（定数）

components-v5.md に記載済み、再掲略。

---

## 型定義の追加

```ts
// src/components/DeathCompleteFlag.ts（新規、FIX-H対応）
class DeathCompleteFlag {
  linger: number = 0.3;  // 秒、最終ポーズ保持時間（linger<=0 で dispose 実行）
}

// src/types/index.ts への追加
export type CharacterType = 'Soldier' | 'Enemy' | 'Hazmat';
export type GunType = 'AK' | 'Pistol' | 'Shotgun';
export type EnvType = 'Barrier_Single' | 'Crate' | 'SackTrench' | 'Fence' | 'Fence_Long' | 'Tree_1';
```

---

## Outline用 Shader（概略）

```glsl
// OUTLINE_VERTEX_SHADER（SkinnedMesh対応、FIX-C: r181+ 正式方式）
#include <common>
#include <skinning_pars_vertex>

uniform float outlineThickness;

void main() {
  #include <skinbase_vertex>     // mat4 boneMatX 計算
  #include <begin_vertex>        // vec3 transformed = position
  #include <skinning_vertex>     // transformed をボーン変形

  vec3 objectNormal = normalize(normal);
  #include <skinnormal_vertex>   // objectNormal をボーン回転（FIX-C: outlineに必須）
  vec3 outlineNormal = normalize(normalMatrix * objectNormal);

  vec4 pos = modelViewMatrix * vec4(transformed, 1.0);
  pos.xyz += outlineNormal * outlineThickness;
  gl_Position = projectionMatrix * pos;
}

// OUTLINE_FRAGMENT_SHADER
uniform vec3 outlineColor;
void main() {
  gl_FragColor = vec4(outlineColor, 1.0);
}
```

- Three.js の `skinning_pars_vertex` / `skinning_vertex` を include することで `SkeletonUtils.clone` した skeleton と一貫したボーン変形が適用される
- Construction Day 1 のスパイクで成立確認必須

---

## メモ: 実装時の注意事項

1. **mixer.finished event の `event.action`**: Three.js r183 では `event` は `{ action: AnimationAction, direction: 1 | -1 }` 形式。`event.action.getClip().name` で clip 名取得、Death clip の判定に必須（FIX-E）。
2. **SkeletonUtils.clone の挙動**: scene 全体を深くcloneし、Skeleton も再構築するが、**AnimationClip は共有**される（clip自体はデータなので OK）。
3. **ShaderMaterial の skinning（FIX-C）**: Three.js r181+ では `skinning: true` flag は廃止。ShaderMaterial でスケルトン変形を使う場合は以下を include し、`skinning` flag を指定しない:
   - `#include <skinning_pars_vertex>`（uniform 宣言）
   - `#include <skinbase_vertex>`（boneMatX 計算）
   - `#include <skinning_vertex>`（transformed をボーン変形）
   - `#include <skinnormal_vertex>`（法線のボーン変形、outlineに必須）
4. **outlineThickness の値**: 0.02 は目安、PoC 時に調整。スケール 1.0x キャラで 1〜2cm 相当。

---

## 追加実装（iter2修正分）

### AssetManager.restoreTextures（FIX-Q / O-NG-4対応）

```ts
/** WebGLコンテキストロスト復帰時、全テンプレート内 Texture を re-upload マーク */
restoreTextures(): void {
  const all: GltfTemplate[] = [
    ...this.characters.values(),
    ...this.guns.values(),
    ...this.environments.values(),
  ];
  for (const tmpl of all) {
    tmpl.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'] as const) {
          const tex = (m as any)[key] as THREE.Texture | undefined;
          if (tex) tex.needsUpdate = true;
        }
      }
    });
  }
  console.info('[AssetManager] restoreTextures: all template textures marked needsUpdate=true');
}
```

### CleanupSystem linger 消化（FIX-H / F-NEW-01対応、iter2で本体update()に統合済み）

linger 消化ロジックは C-07 `update()` 本体（上記 C-07 節）に一元化。本セクションの旧実装は削除し本体側に統合済み。

### CombatSystem: deathFlag ガード（B-MID-05対応）

```ts
// ダメージ判定成功時
const anim = target.get(AnimationStateComponent);
if (anim && !anim.deathFlag) {  // Death中はHitReactに遷移させない
  anim.hitReactTimer = HITREACT_DURATION;  // 0.4秒
}
```

### MetricsProbe（FIX-O）

components-v5.md C-15 に全定義あり、component-methods-v5.md では再掲省略。
