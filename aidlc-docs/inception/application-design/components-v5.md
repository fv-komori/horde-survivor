# Application Design v5 - GLTFモデル導入

## 設計方針

- **プロシージャル全廃 → GLTF一本化**: ProceduralMeshFactoryを削除、CC0のToon Shooter Game Kitを同梱
- **ECS・System骨格は維持**: AnimationSystem と AnimationStateComponent を追加するのみ、既存Systemsは軽微改修
- **非同期起動フロー**: AssetManager プリロード完了を保証してから EntityFactory/World 生成（DI 制約）
- **dispose 責任の明確化**: AssetManager保持テンプレートは不変、entity clone は CleanupSystem 責任
- **退避策の事前定義**: SkinnedMesh反転ハルのskinning追随は Construction初日にPoC、不成立時は Outline OFFでリリース可

## アーキテクチャ全体図

```
                     main.ts
                        │
                        ▼
               ┌─────────────────┐
               │  AssetManager   │  (GLTFプリロード、v1/配下)
               │  (templates保持) │
               └────────┬────────┘
                        │ await load()
                        ▼
               ┌─────────────────┐
               │  LoaderScreen   │  (進捗+エラー UI)
               └────────┬────────┘
                        │ (成功)
                        ▼
               ┌─────────────────┐
               │ GameStartScreen │  (Idle プレビュー)
               └────────┬────────┘
                        │ Start押下
                        ▼
               ┌─────────────────┐
               │   GameService   │
               └────┬────────────┘
                    │ World/Systems 生成 (EntityFactory に AssetManager DI)
                    ▼
    ┌───────────────────────────────────────────────────┐
    │                     World                         │
    │  ┌──────────────────────────────────────────────┐ │
    │  │  ECS Systems (priority 順)                    │ │
    │  │  ...既存 Systems...                           │ │
    │  │  AnimationSystem      🆕                     │ │
    │  │  ThreeJSRenderSystem (SkinnedMesh対応)       │ │
    │  │  CleanupSystem (dispose拡張)                 │ │
    │  └──────────────────────────────────────────────┘ │
    │  ┌──────────────────────────────────────────────┐ │
    │  │  Components                                  │ │
    │  │  MeshComponent (拡張: mixer?, outlineMesh?) │ │
    │  │  AnimationStateComponent  🆕                │ │
    │  └──────────────────────────────────────────────┘ │
    └───────────────────────────────────────────────────┘
                    │
                    ▼
    ┌─────────────────────────────────────────────┐
    │  EntityFactory (GLTF版)                     │
    │  - SkeletonUtils.clone + tint + bone attach │
    │  - BoneAttachmentConfig 参照                │
    └─────────────────────────────────────────────┘
```

## コンポーネント一覧

| ID | 名前 | 種別 | 状態 | 責務 |
|---|---|---|---|---|
| C-01 | **AssetManager** | Manager | 🆕 新規 | GLTFプリロード、テンプレート保持 |
| C-02 | **AnimationSystem** | ECS System | 🆕 新規 | state machine駆動、mixer.update、dispose連携 |
| C-03 | **AnimationStateComponent** | ECS Component | 🆕 新規 | hitReactTimer / deathFlag / currentClip |
| C-04 | **LoaderScreen** | UI | 🆕 新規 | 進捗+エラー表示、textContent構築 |
| C-05 | **EntityFactory** | Factory | ⚙️ 改修 | GLTF clone + tint + bone attach、DI対応 |
| C-06 | **MeshComponent** | ECS Component | ⚙️ 拡張 | mixer? / animations? / outlineMesh? 追加 |
| C-07 | **CleanupSystem** | ECS System | ⚙️ 改修 | SkinnedMesh/mixer/action dispose |
| C-08 | **CombatSystem** | ECS System | ⚙️ 軽微改修 | ダメージ時に hitReactTimer 書込 |
| C-09 | **HealthSystem** | ECS System | ⚙️ 軽微改修 | HP<=0時に deathFlag 書込（直接削除から変更） |
| C-10 | **SceneManager** | Manager | ⚙️ 軽微改修 | 環境GLTF配置に切替 |
| C-11 | **GameStartScreen** | UI | ⚙️ 軽微改修 | Idleプレビュー mini-renderer 追加 |
| C-12 | **ProceduralMeshFactory** | Factory | ❌ 削除 | 全削除 |
| C-13 | **AssetPaths** | Constants | 🆕 新規 | モデルパス定数一元化（将来 v2/ 切替用） |
| C-14 | **BoneAttachmentConfig** | Constants | 🆕 新規 | モデル別 handBone/offset/rotation |
| C-15 | **MetricsProbe** | Service | 🆕 新規 | heap計測、視覚回帰ベースラインのdoc pointer |

---

## C-01: AssetManager（新規）

### 責務
- GLTFファイルのプリロード（起動時1回、Promise.all並列）
- ロード済みテンプレート（`scene`, `animations`）を保持
- ロード状態・進捗の公開
- テンプレートは**不変**、dispose禁止（FR-03 責任分界表）

### 保持するテンプレート
```ts
interface GltfTemplate {
  scene: THREE.Group;                    // SkeletonUtils.clone 元
  animations: THREE.AnimationClip[];     // AnimationMixer に渡す clip
}

class AssetManager {
  private characters: Map<CharacterType, GltfTemplate>;  // Soldier/Enemy/Hazmat
  private guns: Map<GunType, GltfTemplate>;              // AK/Pistol/Shotgun
  private environments: Map<EnvType, GltfTemplate>;      // Barrier_Single/Crate/SackTrench/Fence/Fence_Long/Tree_1

  async load(onProgress: (loaded: number, total: number) => void): Promise<void>;
  isLoaded(): boolean;
  getCharacter(type: CharacterType): GltfTemplate;
  getGun(type: GunType): GltfTemplate;
  getEnvironment(type: EnvType): GltfTemplate;

  /** O-NG-4対応: WebGLコンテキストロスト復帰時に全テンプレート Texture を re-upload マーク */
  restoreTextures(): void;
}
```

### 設計詳細（FIX-B: fetch + parse方式で二重ダウンロード排除）
- `GLTFLoader` インスタンスを共有（メモリ節約）
- 各ファイルは `fetch(url, { signal: abortCtrl.signal })` で取得 → `response.arrayBuffer()` でバイナリ取得
- **payload上限3MB**（各ファイル）を `buffer.byteLength` でチェック、超過時は即エラー（NFR-06、Character実測2.34MB考慮）
- サイズチェック通過後、`GLTFLoader.parse(buffer, baseUrl, onLoad, onError)` でThree.jsオブジェクトへ変換（二重ダウンロードなし）
- `Promise.all` で全12ファイル並列ロード
- **タイムアウト**: 個別30秒（個別 AbortController で `fetch` をキャンセル）、全体60秒（全AbortControllerを一括 abort）
- **エラー透過**: 1件でも失敗時は `Promise.reject`、EntityFactory生成を禁止、部分起動禁止
- パスは `AssetPaths` 定数から取得（C-13参照）
- **retry対象外コード**: HTTP 404 / payload超過 / GLTF parseエラーは再試行しない（ユーザー操作再試行でも失敗するため即エラー画面）

---

## C-02: AnimationSystem（新規ECS System）

### 責務
- 全entityのmixer駆動（`mixer.update(dt)`）
- AnimationStateComponent と velocity からアニメ選択・crossFade
- Death/HitReact の LoopOnce 完了検知、フラグ操作
- `mixer.finished` リスナーの**登録と解除**（F-NG-11対応）

### priority 位置（A-NG-1 / O-NG-9対応、Iter5 確定値）

| priority | System | 備考 |
|---|---|---|
| 10 | CombatSystem | ダメージ・hitReactTimer書込 |
| 15 | HealthSystem | HP減算・deathFlag書込 |
| 20 | MovementSystem | velocity適用 |
| 25 | AISystem | AI行動決定 |
| 30 | SpawnSystem | 敵生成 |
| 35 | WeaponSystem | 弾丸生成 |
| **50** | **AnimationSystem** 🆕 | mixer.update、state machine |
| **55** | **CleanupSystem** 改修 | DeathCompleteFlag + linger 消化 |
| **60** | **ThreeJSRenderSystem** | 描画（SkinnedMesh対応） |

- 既存Iter4値の実測は Construction Day 1 で grep 確認、差分あれば本表を更新

### state machine（FR-04準拠）

```ts
update(dt):
  for each entity with AnimationStateComponent + MeshComponent(has mixer):
    // 1. hitReactTimer 減算（B-NG-13対応）
    if (anim.hitReactTimer > 0) anim.hitReactTimer -= dt;

    // 2. 目標 clip 決定（優先順位: Death > HitReact > Run_Shoot/Idle_Shoot）
    target = 'Idle_Shoot';
    if (velocity > 閾値) target = 'Run_Shoot';
    if (anim.hitReactTimer > 0) target = 'HitReact';
    if (anim.deathFlag) target = 'Death';

    // 3. crossFade or 即切替
    if (anim.currentClip !== target):
      if (target === 'Death'):
        // Death は即切替（crossFade なし）、LoopOnce + clampWhenFinished
        action = animations.get('Death');
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        // finished リスナー登録（特定 clip 完了判定、F-NG-12対応）
        const handler = (event) => {
          if (event.action.getClip().name === 'Death') {
            entity.addComponent(new DeathCompleteFlag());
            mixer.removeEventListener('finished', handler);  // F-NG-11
          }
        };
        mixer.addEventListener('finished', handler);
        playImmediate(action);
      else:
        crossFade(currentAction → targetAction, 0.1秒);
      anim.currentClip = target;

    // 4. mixer 駆動
    mixer.update(dt);
```

### mini-renderer との関係（F-MED-05 / O-NG-5対応）

- GameStartScreen は **AnimationSystem に依存しない**。World 生成前に動作するため `this.previewMixer.update(dt)` を直接呼ぶ（updateStandalone メソッドは採用しない）
- これにより AnimationSystem への public API 追加を回避、ECS責務を侵食しない

---

## C-03: AnimationStateComponent（新規ECS Component）

### 責務
- アニメ state machine の入力フラグ保持

```ts
class AnimationStateComponent {
  hitReactTimer: number = 0;        // 残り秒、>0 の間は HitReact 再生
  deathFlag: boolean = false;       // true で Death 遷移
  currentClip: string = '';         // 現在再生中の clip 名
  finishedListener: Function | null = null;  // Death完了リスナー参照（removeEventListener用）
}
```

### 書き込み責任
- **CombatSystem**（C-08）: `anim.hitReactTimer = 0.4` をダメージ発生時に書込
- **HealthSystem**（C-09）: HP<=0 検知時に `anim.deathFlag = true` を書込（entity削除はしない）
- **AnimationSystem**（C-02）: `currentClip` と `hitReactTimer` を毎フレーム更新、`finishedListener` 管理

### 初期値（F-NG-15対応）
- EntityFactory 生成時に `currentClip = 'Idle_Shoot'` を設定
- AnimationSystem 初回フレームで `Idle_Shoot.play()` 即時（crossFade なし）

---

## C-04: LoaderScreen（新規UI）

### 責務
- ロード中の `Loading...` + 進捗バー表示
- タイムアウト（60秒）到達時にエラー画面へ切替
- エラー時: 再試行ボタン（最大3回）、4回目以降はリロード誘導
- **XSS対策**: `textContent` と DOM API のみ、`innerHTML` 使用禁止

### 状態遷移
```
(初期)  → showLoading(total)
loading → updateProgress(loaded)
loading → showError(msg)         (ロード失敗・タイムアウト)
error   → showLoading(total)     (再試行押下)
loading → hide()                 (成功)
```

### index.html 静的雛形（I-NG-5 / I-NG-16対応、FOUC防止）

`index.html` の `<body>` に以下を埋め込む（CSS inline で外部CSS未ロード時も表示可能）:

```html
<body>
  <div id="initial-loader" style="
    position: fixed; inset: 0;
    display: flex; align-items: center; justify-content: center;
    background: #1a1a1a; color: #e0e0e0;
    font-family: sans-serif; font-size: 18px;
    z-index: 100;
  ">Loading...</div>
  <script type="module" src="/src/main.ts"></script>
</body>
```

**main.ts での置換**:

```ts
const initialLoader = document.getElementById('initial-loader');
const loaderScreen = new LoaderScreen();
if (initialLoader?.parentNode) {
  initialLoader.replaceWith(loaderScreen.root);  // innerHTML 不使用、CSP整合
}
loaderScreen.show();
```

---

## C-05: EntityFactory（改修）

### 責務（変更点）
- ProceduralMeshFactory呼び出しを全廃
- AssetManager から GLTFテンプレートを取得 → SkeletonUtils.clone
- tint用 material 個別 clone（submesh対応、F-NG-16対応）
- BoneAttachmentConfig に基づき武器を bone へ attach
- 反転ハルメッシュの生成（FR-06、B-NG-12対応）

### 主要メソッド
```ts
class EntityFactory {
  constructor(
    private world: World,
    private assetManager: AssetManager,  // ロード済みを前提（DI制約、B-NG-2）
    private sceneManager: SceneManager,
  ) {}

  createPlayer(): EntityId;
  createAlly(): EntityId;                                    // Enemy clone + 青tint
  createEnemy(variant: 'NORMAL' | 'FAST' | 'TANK'): EntityId; // Enemy clone + 赤系tint + scale
  createBoss(): EntityId;                                     // Hazmat clone + 特殊色

  // 内部ヘルパー
  private cloneGltfScene(template: GltfTemplate): Object3D;
  private cloneMaterialsRecursive(root: Object3D): void;     // 全 submesh material 個別clone（F-NG-16）
  private applyTint(root: Object3D, color: number): void;
  private createOutlineMesh(root: Object3D): Object3D;       // 反転ハル、skeleton共有bind（FR-06）
  private attachGun(root: Object3D, gunType: GunType, config: BoneConfig): void;
  private setupAnimations(mixer, clips): Map<string, AnimationAction>;
}
```

### clone フロー（詳細）
```
1. template = assetManager.getCharacter(type)
2. root = SkeletonUtils.clone(template.scene)
3. cloneMaterialsRecursive(root):
   root.traverse(obj => {
     if (obj.isSkinnedMesh && obj.material) {
       obj.material = Array.isArray(obj.material)
         ? obj.material.map(m => m.clone())
         : obj.material.clone();
     }
   })
4. applyTint(root, tintColor)  // 全 submesh material の .color 書換
5. outlineRoot = createOutlineMesh(root)  // 反転ハル、Skeleton共有 .bind()
6. mixer = new AnimationMixer(root)
7. animations = setupAnimations(mixer, template.animations)  // Map<name, Action>
8. scene.add(root); scene.add(outlineRoot)
9. attachGun(root, gunType, BoneAttachmentConfig[type])
10. entity = world.createEntity()
    + MeshComponent { root, outlineMesh: outlineRoot, mixer, animations }
    + AnimationStateComponent { currentClip: 'Idle_Shoot', ... }
    + 既存Component群（Position, Velocity, Health, etc.）
```

---

## C-06: MeshComponent（拡張）

```ts
class MeshComponent {
  // 既存
  mesh: THREE.Object3D;

  // 🆕 Iter5 追加（全て optional）
  mixer?: THREE.AnimationMixer;
  animations?: Map<string, THREE.AnimationAction>;
  outlineMesh?: THREE.Object3D;  // 反転ハル（B-NG-12対応）
}
```

- 環境メッシュ・弾丸・エフェクトでは `mixer`/`animations`/`outlineMesh` は未設定（undefined）
- AnimationSystem は `if (!mesh.mixer) continue;` でスキップ
- CleanupSystem は `outlineMesh` 存在時に scene から remove + dispose

---

## C-07: CleanupSystem（改修）

### priority
- 55（AnimationSystem=50の直後、RenderSystem=60の直前、FIX-J）

### Iter5 での追加処理（FIX-H / F-NEW-01対応、linger消化統合版）
```ts
update(world, dt):
  // DeathCompleteFlag 消化（linger>0 は最終ポーズ保持）
  for each entity with DeathCompleteFlag:
    flag.linger -= dt;
    if (flag.linger <= 0):
      processDeath(entity);  // (a) XPドロップ → (b) dispose chain → (c) entity削除

processDeath(entity):
  // finished listener 解除（FIX-E、forceDispose経路と共通）
  if (anim.finishedListener) mesh.mixer.removeEventListener('finished', anim.finishedListener);
  // (a) XPドロップ（既存 Iter4 実装）
  dropXP(entity.position);
  // (b) dispose chain
  mesh.mixer?.stopAllAction();
  mesh.animations?.forEach(a => mesh.mixer.uncacheAction(a.getClip()));
  mesh.mixer?.uncacheRoot(mesh.mesh);
  disposeDeep(mesh.mesh);
  if (mesh.outlineMesh) disposeDeep(mesh.outlineMesh);
  // (c) entity削除
  world.removeEntity(entity);

// FIX-P: 起動失敗 / teardown経路で Death途中 entity も即dispose
forceDisposeAll(world): void
```

詳細実装は component-methods-v5.md C-07 参照。

---

## C-08: CombatSystem（軽微改修）

- ダメージ判定成功時、対象entityに `AnimationStateComponent` があれば `hitReactTimer = 0.4` を書込
- 即座にHP減算は従来通り

---

## C-09: HealthSystem（軽微改修）

- HP<=0 検知時に以下へ変更:
  - **旧（Iter4）**: 即entity削除
  - **新（Iter5）**: `AnimationStateComponent.deathFlag = true` を書込（削除はしない）
- entity削除は CleanupSystem が `DeathCompleteFlag` 検知で実行
- `AnimationStateComponent` を持たないentity（弾丸等）は従来通り即削除

---

## C-10: SceneManager（軽微改修）

### 環境GLTF配置
```ts
setupEnvironment(assetManager: AssetManager):
  // 既存のプロシージャル道路/地面タイルは継続
  setupRoadTiles();

  // GLTF環境物を配置（1回 clone、mixer不要）
  placeGltf(assetManager.getEnvironment('Fence'), position);
  placeGltf(assetManager.getEnvironment('Fence_Long'), position);
  placeGltf(assetManager.getEnvironment('Crate'), positions...);
  placeGltf(assetManager.getEnvironment('SackTrench'), positions...);
  placeGltf(assetManager.getEnvironment('Barrier_Single'), positions...);
  placeGltf(assetManager.getEnvironment('Tree_1'), positions...);
```

- 環境GLTFは **SkeletonUtils.clone 不要**（static mesh、`scene.clone(true)` で十分）
- 環境にはアウトライン付与しない（FR-06）

---

## C-11: GameStartScreen（軽微改修）

### Idle プレビュー（FR-04 非戦闘コンテキスト）
- 専用 mini-renderer を内部で保持（メインGame とは独立）
- 構成:
  - 小型 THREE.Scene + Camera + WebGLRenderer（小Canvas）
  - Character_Soldier を SkeletonUtils.clone
  - 独自 AnimationMixer で `Idle` clip を再生
  - `requestAnimationFrame` で `mixer.update(dt)` を独自ループ駆動
- Start押下時に mini-renderer を停止・dispose、メイン Game へ遷移

---

## C-12: ProceduralMeshFactory（削除）

- `src/factories/ProceduralMeshFactory.ts` を削除
- 関連テスト削除: `tests/factories/ProceduralMeshFactory.test.ts` 系（件数は Construction着手時に grep で確定、Q2-NG-1対応）
- 呼び出し元: SceneManager（環境生成）→ FR-07 GLTF配置に、EntityFactory（キャラ生成）→ GLTF clone に置換

---

## C-13: AssetPaths（新規 Constants、I-NG-11対応）

```ts
// src/constants/AssetPaths.ts
const ASSET_BASE = `${import.meta.env.BASE_URL}models/toon-shooter/v1/`;

export const ASSET_PATHS = {
  characters: {
    Soldier: `${ASSET_BASE}characters/Character_Soldier.gltf`,
    Enemy: `${ASSET_BASE}characters/Character_Enemy.gltf`,
    Hazmat: `${ASSET_BASE}characters/Character_Hazmat.gltf`,
  },
  guns: {
    AK: `${ASSET_BASE}guns/AK.gltf`,
    Pistol: `${ASSET_BASE}guns/Pistol.gltf`,
    Shotgun: `${ASSET_BASE}guns/Shotgun.gltf`,
  },
  environment: {
    Barrier_Single: `${ASSET_BASE}environment/Barrier_Single.gltf`,
    Crate: `${ASSET_BASE}environment/Crate.gltf`,
    SackTrench: `${ASSET_BASE}environment/SackTrench.gltf`,
    Fence: `${ASSET_BASE}environment/Fence.gltf`,
    Fence_Long: `${ASSET_BASE}environment/Fence_Long.gltf`,
    Tree_1: `${ASSET_BASE}environment/Tree_1.gltf`,
  },
} as const;
```

- 将来 v2/ 切替時は `ASSET_BASE` の `v1/` → `v2/` の1箇所変更のみ
- `import.meta.env.BASE_URL` で Vite のサブパス配信（GitHub Pages 等）対応（I-NG-12）

---

## C-14: BoneAttachmentConfig（新規 Constants）

```ts
// src/constants/BoneAttachmentConfig.ts
// Construction Day 1 のbone名実地調査後に確定
type BoneAttachmentConfig = Record<CharacterType, {
  handBone: string;
  offset: THREE.Vector3;
  rotation: THREE.Euler;
}>;

export const BONE_ATTACH: BoneAttachmentConfig = {
  Soldier: {
    handBone: 'Hand.R',  // ← Construction Day 1 で glTF inspector 実測確定
    offset: new THREE.Vector3(0, 0, 0),  // 実装時調整
    rotation: new THREE.Euler(0, 0, 0),  // 実装時調整
  },
  Enemy: {
    handBone: 'Hand.R',  // ← 実測
    offset: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
  },
  Hazmat: {
    handBone: 'Hand.R',  // ← 実測
    offset: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
  },
};
```

- Construction Day 1 の事前タスクで3モデルのbone名を確定（FR-05）
- 異なる場合でもこの Record で吸収、EntityFactory側は config 参照のみ

---

## C-15: MetricsProbe（新規、O-NG-1 / O-NG-7対応）

### 責務
- ゲーム開始時と5分後の `performance.memory` 差分取得・ログ出力（Chrome限定）
- 視覚回帰ベースライン配置先 `test-screenshots/iter5-baseline/` の documented pointer

### 実装
```ts
// src/services/MetricsProbe.ts
class MetricsProbe {
  private startHeap: number | null = null;
  private timer: number | null = null;

  start(): void {
    const mem = (performance as any).memory;
    if (!mem) return;  // 非Chromeは noop
    this.startHeap = mem.usedJSHeapSize;
    this.timer = window.setTimeout(() => this.snapshot(), 5 * 60 * 1000);
  }
  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  private snapshot(): void {
    const mem = (performance as any).memory;
    if (!mem || this.startHeap == null) return;
    const diffMB = (mem.usedJSHeapSize - this.startHeap) / (1024 * 1024);
    console.info(`[Metrics] heap5min=${diffMB.toFixed(1)}MB (start=${(this.startHeap/1024/1024).toFixed(1)}MB → now=${(mem.usedJSHeapSize/1024/1024).toFixed(1)}MB)`);
    // NFR-07: 5分で +10%（~20MB）以内が許容基準
  }
}
```

### Playwright 視覚回帰ベースライン

- 配置先: `test-screenshots/iter5-baseline/` （NFR-05参照）
- 基準画像3枚: Start画面 / 戦闘開始10秒 / Boss戦
- pixel diff 許容値 < 5%
- MetricsProbe 自身は視覚回帰を実行しないが、ベースラインパスの documented pointer

---

## 新規・改修ファイル一覧

### 新規
| ファイル | 責務 |
|---|---|
| `src/managers/AssetManager.ts` | C-01 |
| `src/systems/AnimationSystem.ts` | C-02 |
| `src/components/AnimationStateComponent.ts` | C-03 |
| `src/ui/LoaderScreen.ts` | C-04 |
| `src/constants/AssetPaths.ts` | C-13 |
| `src/constants/BoneAttachmentConfig.ts` | C-14 |
| `tests/fixtures/mockGltf.ts` | GLTFLoader mock（NFR-05） |
| `tests/managers/AssetManager.test.ts` | ロード成功/失敗/タイムアウト |
| `tests/systems/AnimationSystem.test.ts` | state遷移、Death完了、listener解除 |
| `tests/components/AnimationStateComponent.test.ts` | 初期値、書込 |
| `tests/factories/EntityFactory.gltf.test.ts` | clone独立性（material/skeleton `!==`） |

### 改修
| ファイル | 変更内容 |
|---|---|
| `src/factories/EntityFactory.ts` | GLTF版へ全面書換（C-05） |
| `src/components/MeshComponent.ts` | mixer?/animations?/outlineMesh? 追加（C-06） |
| `src/systems/CleanupSystem.ts` | dispose拡張、priority確定（C-07） |
| `src/systems/CombatSystem.ts` | hitReactTimer書込（C-08） |
| `src/systems/HealthSystem.ts` | deathFlag書込に変更（C-09） |
| `src/rendering/SceneManager.ts` | 環境GLTF配置（C-10） |
| `src/ui/GameStartScreen.ts` | Idleプレビュー mini-renderer（C-11） |
| `src/game/GameService.ts` | 起動シーケンス改修（AssetManager DI） |
| `src/main.ts` | LoaderScreen 表示→AssetManager.load→GameService |
| `index.html` | 静的loader雛形（FOUC防止） |

### 削除
| ファイル | 理由 |
|---|---|
| `src/factories/ProceduralMeshFactory.ts` | GLTF一本化（C-12） |
| `tests/factories/ProceduralMeshFactory.test.ts` 系 | 削除対象元の消滅 |

---

## リスクと対策（v5設計で対応）

| リスク | 設計での対応 |
|---|---|
| SkinnedMesh反転ハルの追随破綻 | C-05 で頂点シェーダ膨張方式を推奨（F-NG-14）、Construction Day 1 でPoC確認 |
| bone名のモデル差異 | C-14 BoneAttachmentConfig で吸収、Construction Day 1 で実測確定 |
| 複数 submesh の material 波及 | C-05 cloneMaterialsRecursive で `traverse` 全clone（F-NG-16） |
| finished listener蓄積 | C-02 で handler内 `removeEventListener`（F-NG-11）、clip名判定（F-NG-12） |
| System実行順序の不整合 | CombatSystem/HealthSystem → AnimationSystem → CleanupSystem → RenderSystem で確定 |
| AssetManager未ロード状態での EntityFactory 利用 | DI制約、GameServiceがロード完了後にのみ EntityFactory 生成 |
| 起動途中の例外による部分生成state | GameService.teardown() で生成済みWorld/Systems/entityを逆順dispose（O-NG-13） |
| メモリ増加率計測の自動化不在 | NFR-05 の5分後heap差分ログ + リリース前30分プレイチェックリスト（O-NG-11） |
