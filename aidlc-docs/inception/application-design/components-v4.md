# Application Design v4 - ビジュアルリッチ化ポリッシュ

## 設計方針

- **既存構成を維持**し、レンダリング層のみ拡張（ECS・Systems・UI・音は不変）
- **段階的適用可能**: 新機能（PostFX, Outline, Hemisphere, Fog）はすべて Quality Tier で ON/OFF 可能
- **パフォーマンス予算**: Outlineのドローコール増加はNFR-01「2倍以内」の範囲内（キャラ・武器限定 + InstancedMesh除外）、Bloomは1パス・High品質のみ
- **外部アセット無し**: FR要件通りプロシージャル継続

## アーキテクチャ変更点

```
                    ┌──────────────────────────────────┐
                    │        GameService               │
                    │  (Three.js初期化・ゲームループ)   │
                    └──────┬───────────────────┬──────┘
                           │                    │
                           ▼                    ▼
              ┌─────────────────────┐  ┌────────────────────┐
              │ ThreeJSRenderSystem │  │  PostFXManager 🆕  │
              │  - WebGLRenderer    │──│  - EffectComposer  │
              │  - Tonemapping 🆕   │  │  - BloomPass       │
              │  - PCFSoftShadow 🆕 │  │  - RenderPass      │
              └──────────┬──────────┘  └────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌─────────┐  ┌─────────────┐  ┌──────────────────┐
    │ Scene   │  │ Procedural  │  │ EffectManager3D  │
    │ Manager │  │ MeshFactory │  │                  │
    │         │  │             │  │ - MuzzleFlash 🆕 │
    │ - Hemi🆕│  │ - Face 🆕   │  │   強化版         │
    │ - Fog🆕 │  │ - Outline🆕 │  │ - Smoke Puff 🆕  │
    │ - Sky🆕 │  │ - Hat 🆕    │  │ - Bullet Trail🆕│
    │ - Fence🆕│ │ - AllyBlue🆕│  │                  │
    └─────────┘  └─────────────┘  └──────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │ QualityManager   │
              │ - postFX 🆕      │
              │ - outline 🆕     │
              │ - hemi/fog 🆕    │
              └──────────────────┘
```

**生成フロー**（PostFXManager参照関係の明示）:

1. `GameService` が `ThreeJSRenderSystem` を生成（`WebGLRenderer` / `Scene` / `Camera` の所有はこちら）。
2. `ThreeJSRenderSystem` の初期化後、`GameService` が `PostFXManager.tryCreate(renderer, scene, camera)` を呼び出し、生成成否を保持。
3. 成功時は `ThreeJSRenderSystem` に `PostFXManager` 参照を注入、失敗時は `null` を注入して `renderer.render()` 直接呼びにフォールバック。
4. `QualityManager` は `SceneManager` と `PostFXManager` への参照を `GameService` から受け取り、`setQuality` 時に各切替メソッドを呼ぶ。
5. `PostFXManager` は `ThreeJSRenderSystem` を参照せず `renderer/scene/camera` のみを保持（一方向依存）。

## コンポーネント詳細

### C-01: ProceduralMeshFactory（拡張）

**責務**: プロシージャル3Dメッシュ生成（既存） + 顔ディテール + Outline付与

**新規メソッド**:
```ts
// キャラに顔（目・帽子ツバ・靴）を付与するヘルパー
private addFace(group: Group, faceColor: number, eyeOffset: {x, y, z}, capColor?: number): void

// メッシュグループに反転ハルOutlineを付与（子メッシュ全てに対して）
private applyOutline(group: Group, outlineColor: number, thickness: number): void

// 弾丸の進行方向を向く光るトレイル形状のジオメトリ
createBulletTrailGeometry(): CylinderGeometry

// マズルフラッシュ用の放射状プレーン（Sprite代替の平面）
createMuzzleFlashMesh(): Mesh
```

**改修メソッド**:
- `createPlayer`: 目・青キャップ・黒ブーツ追加、プロポーション調整、Outline付与
- `createAlly`: **青系パレット**に変更、目・青キャップ・ブーツ・Outline
- `createEnemyNormal`: 赤キャップ・目・ブーツ・Outline
- `createEnemyFast/Tank/Boss`: 目・固有ヘッドギア・Outline
- `createGuardrail`: **木製フェンス**（縦杭 + 横木2本、色は焼け木色）に再設計

**設計ポイント**:
- Outlineは `BackSide` + `MeshBasicMaterial(depthWrite: false)` で軽量化
- Outline用マテリアルはFactory内で1つキャッシュして全メッシュで共有
- Outline厚みは子Mesh単位で BackSide シェルを `group.add`（親Groupにscaleを掛けず、親のscale/position同期に影響しない）
- Outline子メッシュには生成時に `mesh.userData.isOutline = true` を設定する
- Outline子メッシュは親キャラ `Group` の子として追加される（`parentGroup.add(outlineMesh)` による階層明示）
- Outline用マテリアル/ジオメトリの dispose 責任は **ProceduralMeshFactory** が保持する（`Factory.disposeAll()` でキャッシュ済みマテリアル/ジオメトリを一括 release）。ゲームライフサイクル中はキャッシュを保持し、エンティティごとのdisposeは行わない

**Outline適用範囲（定量化）**:

| 描画対象 | 描画方式 | Outline適用 | 視認性担保 |
|---|---|---|---|
| Player / Ally / Enemy（Normal/Fast/Tank/Boss） | Group + 個別Mesh | **適用** | 反転ハル |
| 武器（ライフル等） | Group + 個別Mesh | **適用** | 反転ハル |
| 弾丸 | InstancedMesh | 適用外 | emissive + Bloom |
| アイテム | InstancedMesh | 適用外 | emissive + Bloom |
| エフェクト（Muzzle/Smoke/Trail） | Sprite/Mesh（半透明） | 適用外 | emissive + Bloom |

- Outline は **Group描画のキャラ・武器のみ** に限定。InstancedMesh描画の弾丸・アイテムは反転ハル適用が技術的に困難（全インスタンスに追加ジオメトリが必要でドローコール倍増が非現実的）なため、emissive + Bloom での視認性担保に切替える。
- ドローコール見込み: キャラ同時50体想定で「本体 × 2（本体 + Outline）」＝ +50 ドローコール程度。武器（片手分）を加味しても +100 以内。NFR-01「Outline追加によるドローコール増加は2倍以内」の制約を満たす。
- **上流フィードバック**: requirements-v4.md FR-02 の「キャラ / 武器 / 弾丸 / アイテムにアウトラインを付与」記述は本設計と乖離するため、FR-02 を「**キャラクター / 武器にアウトラインを付与し、弾丸 / アイテムは emissive + Bloom で視認性を担保**」に修正する提案を requirements-v4.md へフィードバック。

**将来拡張（GLTF差し替え時のOutline戦略）**:

- 現行は **InvertedHullStrategy**（BackSide反転ハル法）を採用。プロシージャル生成メッシュに対して最小コストで適用可能。
- 将来、キャラクターメッシュを GLTF アセットに差し替える場合、頂点法線の品質や透明マテリアルとの干渉で反転ハルが破綻しうる。その場合は `three/examples/jsm/postprocessing/OutlinePass` への切替が可能な **戦略パターン（OutlineStrategy インターフェース）** を視野に入れた設計とする。
- 現時点ではインターフェース抽出はせず、差し替えが必要になった時点で ProceduralMeshFactory からの抽出リファクタリングで対応する（YAGNI）。

### C-02: SceneManager（拡張）

**責務**: Three.jsシーン管理（既存） + 環境ライティングリッチ化 + Outline/Hemi/Fog 切替

**新規/改修**:
```ts
private hemisphereLight: HemisphereLight | null = null;  // 🆕
private skyMesh: Mesh | null = null;                      // 🆕 グラデーション空

private setupLighting(): void
  // + HemisphereLight(skyColor=0x87ceeb, groundColor=0xc9a96e, intensity=0.4)
  // + DirectionalLight色を暖色に変更 (0xfff4e0)

private setupBackground(): void
  // グラデ空: SphereGeometry(radius=40) + ShaderMaterial
  //   - uniforms: { uTopColor: Color, uBottomColor: Color, uOffset: number, uExponent: number }
  //   - GLSL は静的リテラルのみ（動的結合禁止、BR-CSP01参照）
  //   - material.fog = false  （Fog の影響を受けない）
  //   - 半径40 は Fog far=45 より内側にして距離逆転を回避
  // scene.fog = new Fog(0xc9a96e, 15, 45)
  // scene.background は設定しない（グラデ空ドームで置き換え）

private setupGroundDetail(): void  // 🆕
  // + 砂漠地面にvertexColorsで微妙な色ムラ
  // + 岩/草のアクセント小メッシュを数個配置
```

**品質切替メソッド**:

- `setHemisphereEnabled(enabled: boolean)`:
  - enabled=false 時は `hemisphereLight.intensity = 0`（`scene.remove` しない）でシェーダ再コンパイルによるスタッターを回避。
  - 併せて **DirectionalLight.intensity を × 1.15 に補正** して全体明度を保持し、暗転を抑える（enabled=true 復帰時は元値に戻す）。
- `setFogEnabled(enabled: boolean)`:
  - enabled=false 時は `scene.fog.far = 9999` にして実質無効化（`scene.fog = null` にするとマテリアルの `#ifdef USE_FOG` 分岐でシェーダ再コンパイルが走るため回避）。
  - enabled=true 復帰時は `scene.fog.far = config.fog.far (=45)` に戻す。
- `setOutlineEnabled(enabled: boolean)`:
  - `scene.traverse` で `userData.isOutline === true` のメッシュを `visible = enabled` に切替。
  - 生成/破棄を伴わないためスパイク（GCや再コンパイル）を回避、O(n) で実行。
- Low品質では上記3つが一括でOFFに切替わる。

### C-03: PostFXManager（新規）

**責務**: ポストプロセスエフェクト管理（composer/bloomPass/renderPass のライフサイクル・dpr制御・コンテキストロスト復帰・初期化失敗フォールバック）

```ts
export class PostFXManager {
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private renderPass: RenderPass | null = null;
  private enabled: boolean = true;
  private contextLost: boolean = false;

  // 初期化は try/catch を内包したファクトリ経由。失敗時は null を返しフォールバック可能。
  static tryCreate(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera
  ): PostFXManager | null;

  private constructor(renderer, scene, camera);

  render(dt: number): void;            // enabled=false or contextLost=true の分岐は内部集約、外部は常にこれを呼ぶ
  setEnabled(enabled: boolean): void;  // Low品質時 false
  resize(width: number, height: number): void;
  handleContextLost(): void;           // render呼び出しを停止（contextLost=true）
  handleContextRestored(): void;       // composer/bloomPass/renderPass を再生成
  dispose(): void;                     // composer.dispose → bloomPass.dispose → renderPass.dispose の順
  isEnabled(): boolean;
}
```

**Bloomパラメータ**（config化）:
- strength: 0.6
- radius: 0.4
- threshold: 0.85（emissive マテリアル中心のみ発光）

**ライフサイクル詳細**:

- `tryCreate(renderer, scene, camera)`: 内部で `new EffectComposer / RenderPass / UnrealBloomPass` を try/catch。失敗時は `console.warn('[PostFX] disabled: <reason>')` を出力し `null` を返す。呼び出し側（GameService / ThreeJSRenderSystem）は null の場合、従来の `renderer.render(scene, camera)` をフォールバックとして用いる。
- `render(dt)`: `contextLost === true` または `enabled === false` または `composer === null` の場合は `renderer.render(scene, camera)` を実行。それ以外は `composer.render()`。**分岐はPostFXManager内部に集約**し、ThreeJSRenderSystem からは常に `postFXManager.render(dt)` のみ呼ぶ（render責務の単一化）。
- `resize(width, height)`: `const dpr = Math.min(window.devicePixelRatio, 2);` および RenderTarget最大サイズを `2048` にクランプ（`const w = Math.min(width * dpr, 2048); const h = Math.min(height * dpr, 2048);`）して `composer.setPixelRatio(dpr); composer.setSize(w, h);` を実行。Bloomパスの `resolution` も同値に同期。
- `handleContextLost()`: `contextLost = true` を立てて以降の `composer.render()` 呼び出しを抑止（`renderer.render()` フォールバックに切替）。
- `handleContextRestored()`: 既存 composer / bloomPass / renderPass を `dispose()` してから再 `tryCreate` 相当の処理を行い、失敗時は `enabled=false` に落とす。成功後 `contextLost = false`。
- `dispose()`: `composer?.dispose()` → `bloomPass?.dispose()` → `renderPass?.dispose()` の順で解放し、参照を null にリセット。

**統合点**:

- `ThreeJSRenderSystem.update()` の最終レンダリングは **常に** `postFXManager.render(dt)` を呼ぶ（PostFXManagerが null の場合のみ `renderer.render(scene, camera)` を直接呼ぶフォールバック分岐を置く）。
- `ThreeJSRenderSystem.handleContextLost` → `postFXManager?.handleContextLost()` を呼ぶ。
- `ThreeJSRenderSystem.handleContextRestored` → `postFXManager?.handleContextRestored()` を呼ぶ。
- `ThreeJSRenderSystem.handleResize` → `postFXManager?.resize(w, h)` を呼ぶ。
- `ThreeJSRenderSystem.dispose` → `postFXManager?.dispose()` を呼ぶ。

**CSP適合性（BR-CSP01）**:

- `UnrealBloomPass` / `EffectComposer` / `RenderPass` は内部で `ShaderMaterial`（事前コンパイル済みGLSL文字列）のみを使用し、`new Function` / `eval` / `import(dynamic URL)` を利用しない。
- グラデーション空の `ShaderMaterial` も GLSL 文字列リテラルを WebGL に渡すのみであり、JavaScript の `eval` / 動的コード生成には該当しない。**GLSLは静的リテラルのみ使用し、文字列結合による動的生成は禁止** する。
- 現行 `index.html` の CSP（`script-src 'self'`, `style-src 'self' 'unsafe-inline'`）を **変更不要**。`unsafe-eval` / `unsafe-inline`(script) の追加は発生しない。
- 依存追加は `three` 本体のサブパス（`three/examples/jsm/postprocessing/*`）のみで、**新規 npm パッケージ追加なし**。Vite が同一オリジン `script-src 'self'` にバンドル、CDN/外部ESM不使用。

### C-04: EffectManager3D（拡張）

**責務**: ゲーム内エフェクト（既存） + 新規エフェクト追加

**改修/新規 詳細**:

- `spawnMuzzleFlash`: 小さなBoxから **平面放射状メッシュ + emissive** に変更（Bloomで光る）。geometry/material は Factory キャッシュを共有し、spawnごとに new しない。
- **新規** `spawnSmokePuff(worldPos)`:
  - Three.js の `Sprite` で実装（自動的にカメラ正対し、ビルボード向き制御コードが不要）。
  - `SpriteMaterial` と Sprite用のテクスチャ（プロシージャル生成：`CanvasTexture` に白いグラデ円を描画してキャッシュ）は Factory キャッシュ経由で **全Smokeインスタンスで共有**。
  - `QualitySettings.maxParticles` 上限内でオブジェクトプールに格納し、再利用（GC削減）。
  - `disposeEffect(effect)`: **Factory キャッシュ由来の geometry/material は dispose をスキップ** する分岐を追加（キャッシュの二重破棄防止）。per-effect に作成したインスタンス固有オブジェクトのみ dispose。
- **新規** `spawnBulletTrail`: 弾丸エンティティ自体のジオメトリを Factory の `createBulletTrailGeometry()` に差替えるため、EffectManager3D 側の変更は最小。

### C-05: QualityManager（拡張）

**QualitySettings 追加フィールド**:
```ts
{
  shadowEnabled,          // 既存
  shadowMapSize,          // 既存
  maxParticles,           // 既存
  maxBulletInstances,     // 既存
  postProcessEnabled,     // 既存（未使用→本イテレーションで実効化）
  outlineEnabled,         // 🆕
  hemisphereEnabled,      // 🆕
  fogEnabled,             // 🆕
}
```

**切替連携**:
- `setQuality` 内で以下を順次呼ぶ:
  - `PostFXManager.setEnabled(settings.postProcessEnabled)`
  - `SceneManager.setHemisphereEnabled(settings.hemisphereEnabled)`
  - `SceneManager.setFogEnabled(settings.fogEnabled)`
  - `SceneManager.setOutlineEnabled(settings.outlineEnabled)` 🆕
  - `SceneManager.setShadowEnabled(settings.shadowEnabled)`（既存）

**パフォーマンス監視（Bloom有効時の定量把握）**:

```ts
getRenderStats(): { fps: number; drawCalls: number; triangles: number }
  // fps: 既存 measureFPS のサンプル値
  // drawCalls: renderer.info.render.calls
  // triangles: renderer.info.render.triangles
```

- `?debug=1` クエリ付きでゲームを起動した場合、HTMLOverlayManager に renderStats を 1秒周期で表示する（Outline適用有無でのドローコール増分を実測で確認するデバッグ用途）。
- 通常起動時はサンプリング・表示とも無効（オーバーヘッド回避）。
- NFR-01「ドローコール2倍以内」の受入検証はこのデバッグ表示で実測して確認する。

### C-06: ThreeJSRenderSystem（軽微変更）

- `renderer.shadowMap.type = PCFSoftShadowMap`
- `renderer.toneMapping = ACESFilmicToneMapping`
- `renderer.toneMappingExposure = 1.0`
- `update()` の最終 render を **常に** `postFXManager?.render(dt) ?? renderer.render(scene, camera)` に変更（分岐は PostFXManager 内部集約、外部はフォールバック用1分岐のみ）
- `handleResize` で `postFXManager?.resize(w, h)` を呼ぶ
- `handleContextLost` で `postFXManager?.handleContextLost()` を呼ぶ
- `handleContextRestored` で SceneManager 再初期化 → `postFXManager?.handleContextRestored()` → `QualityManager.setQuality(currentTier)` の順に復帰
- `dispose` で `postFXManager?.dispose()` を呼ぶ

**受入基準（ACES色検証）**:

- ACES Filmic Tonemapping 適用前後で既存パレット（Boss `0xb71c1c`、Ally 青系、Enemy Normal 赤キャップ）の**目視検証**を実施し、想定色から著しい逸脱がないことを確認する。
- 逸脱が大きい場合は `renderer.toneMappingExposure` を **0.9〜1.2 の範囲**で調整可能とする（既定値1.0、config化済み）。本範囲を超える調整が必要な場合はパレット側を再調整する。

### C-07: GameConfig（設定追加）

```ts
three: {
  // ... 既存
  lighting: {
    // ... 既存
    hemisphereSkyColor: 0x87ceeb,
    hemisphereGroundColor: 0xc9a96e,
    hemisphereIntensity: 0.4,
    directionalColor: 0xfff4e0,  // 暖色に変更
    directionalBoostWhenHemiOff: 1.15,  // Hemi OFF時のDirectional補正係数
    toneMappingExposure: 1.0,
  },
  fog: {
    color: 0xc9a96e,
    near: 15,
    far: 45,
    disabledFar: 9999,  // setFogEnabled(false) 時の値
  },
  sky: {
    topColor: 0x87ceeb,
    bottomColor: 0xc9a96e,  // Fog色と統一
    radius: 40,             // Fog far=45 より内側
  },
  postFX: {
    bloomStrength: 0.6,
    bloomRadius: 0.4,
    bloomThreshold: 0.85,
    maxPixelRatio: 2,
    maxRenderTargetSize: 2048,
  },
  outline: {
    color: 0x000000,
    thickness: 0.04,  // メッシュサイズに対する拡大率
  },
  guardrail: {
    // ... 既存（色を木製風に変更）
    color: 0x8b5a3c,
    topRailColor: 0x6b4223,
    postColor: 0x8b5a3c,
  },
}
```

## データフロー

### レンダリング1フレーム

```
ThreeJSRenderSystem.update(dt)
  ├─ QualityManager.measureFPS / checkQualitySwitch
  ├─ syncEntityPositions(world)          # 2D→3D座標同期
  ├─ SceneManager.updateBackgroundScroll
  ├─ HTMLOverlayManager.updatePositions  # HP表示
  └─ postFXManager?.render(dt)           # 内部で enabled/contextLost を分岐
     # postFXManager === null の場合のみ renderer.render(scene, camera)（フォールバック）
```

### 品質切替

```
FPS低下検知
  → QualityManager.setQuality('low')
     ├─ SceneManager.setShadowEnabled(false)
     ├─ SceneManager.setHemisphereEnabled(false)   # intensity=0 + Directional×1.15 補正
     ├─ SceneManager.setFogEnabled(false)          # fog.far=9999（シェーダ再コンパイル回避）
     ├─ SceneManager.setOutlineEnabled(false)      # userData.isOutline の visible 切替、生成破棄なし
     └─ PostFXManager.setEnabled(false)            # 内部でrenderer直接レンダへ切替
```

### WebGLコンテキストロスト/復帰

```
webglcontextlost
  → ThreeJSRenderSystem.handleContextLost
     └─ PostFXManager.handleContextLost()  # 以降 renderer.render フォールバック

webglcontextrestored
  → ThreeJSRenderSystem.handleContextRestored
     ├─ SceneManager.recompileAllMaterials / reuploadAllTextures / rebuildPools
     ├─ PostFXManager.handleContextRestored()  # composer/passes 再生成、失敗時は enabled=false
     └─ QualityManager.setQuality(currentTier)  # 全切替メソッドを再適用
```

## ファイル変更サマリ

| ファイル | 種別 | 変更内容 |
|---|---|---|
| src/factories/ProceduralMeshFactory.ts | 改修 | Face/Hat/Boot追加、Outline適用（userData.isOutline）、Ally青系、Fence木製化、弾丸/マズル形状、キャッシュ一括dispose |
| src/rendering/SceneManager.ts | 改修 | HemisphereLight, Fog, グラデ空(r=40, fog=false), 地面ディテール, PCFSoftShadow, setHemi/Fog/OutlineEnabled |
| src/rendering/EffectManager3D.ts | 改修 | MuzzleFlash強化（平面+emissive）、SmokePuff（Sprite+プール）、disposeEffectキャッシュスキップ |
| src/rendering/QualityManager.ts | 改修 | PostFX/Outline/Hemi/Fog切替追加、getRenderStats追加 |
| src/rendering/PostFXManager.ts | **新規** | EffectComposer + Bloom管理、tryCreate/handleContextLost/Restored/dispose/resize |
| src/systems/ThreeJSRenderSystem.ts | 軽微 | PCFSoftShadow, Tonemapping, PostFX統合、context lost/restored 連携 |
| src/game/GameService.ts | 軽微 | PostFXManager初期化（tryCreate）・配線・QualityManager連携 |
| src/game/SettingsManager.ts | 軽微 | QualitySettings欠損フィールド補完ロジック（後方互換） |
| src/config/gameConfig.ts | 軽微 | hemisphere/fog/sky/postFX/outline パラメータ追加 |

## NFR-04 永続設定のマイグレーション

- `SettingsManager` の LocalStorage ロード処理で、既存キー（v3以前）の QualitySettings に **`outlineEnabled` / `hemisphereEnabled` / `fogEnabled` / `postProcessEnabled` フィールドが欠損している場合は、対応する QualityTier のデフォルト値で補完** する読み込みロジックを追加する。
- 欠損検知時は `localStorage` を即時に補完済みオブジェクトで上書きし、次回以降はマイグレーション処理を省略する。
- テスト: v3形式の JSON 文字列を localStorage にセットした状態での load が、補完後のオブジェクトを返すことを単体テストで検証。

## テスト戦略

- 既存86テスト全PASS維持
- **PostFXManager 単体テスト（新規）**: モックベースで public API（`tryCreate` 成功/失敗、`setEnabled`、`resize` の dpr/最大サイズクランプ、`dispose` 呼び出し順、`handleContextLost/Restored` 状態遷移、`isEnabled`）をカバー。`three/examples/jsm/postprocessing/*` は `jest.mock` でスタブ化し、Bloom効果そのものは対象外。
- **SceneManager 単体テスト（追記）**: `setOutlineEnabled` が `userData.isOutline === true` のメッシュの `visible` のみ切替えることを検証（生成/破棄が発生しないことを mesh数の不変性でassert）。`setFogEnabled(false)` で `fog.far === 9999`、`setHemisphereEnabled(false)` で `hemisphereLight.intensity === 0` かつ Directional が補正係数1.15倍になることを検証。
- **SettingsManager 単体テスト（追記）**: v3形式の欠損フィールドの補完ロジックを検証。
- **Bloom効果の視覚確認**: Playwright で参考画像と比較スクリーンショット撮影して承認（E2E目視）。

## リスクと対策

| リスク | 対策 |
|---|---|
| Bloomでパフォーマンス低下 | Low品質で自動OFF、High品質でもパラメータ抑制（strength=0.6） |
| Outline反転ハルで半透明マテリアルと干渉・ドローコール倍増 | Outlineは **Group描画のキャラ・武器のみ** に限定（InstancedMesh描画の弾丸/アイテム/エフェクトは対象外）。同時50体想定で +100 ドローコール以内に抑え NFR-01 2倍以内制約を満たす |
| HemisphereLightで影が薄くなりすぎる | intensity=0.4 で控えめに設定、Directionalを引き続き主光源、Hemi OFF時はDirectional×1.15補正 |
| グラデ空とFogの色不整合・距離逆転 | 空ドーム半径を Fog far より内側（40 vs 45）、色を同じ `0xc9a96e` 系統で統一、`skyMesh.material.fog = false` |
| EffectComposer追加でバンドルサイズ増加 | `three/examples/jsm/postprocessing/*`（EffectComposer / RenderPass / UnrealBloomPass）は **static import** でバンドルに含め、Vite の Tree-shaking に任せる。新規 npm パッケージ追加なし、gzip後 +70KB 程度を許容 |
| WebGLコンテキストロスト時のPostFX/Scene破綻 | handleContextLost/Restored を ThreeJSRenderSystem と PostFXManager 双方に実装、復帰時は SceneManager → PostFXManager → QualityManager の順で再構築 |
| PostFX初期化失敗（WebGL2非対応等） | `PostFXManager.tryCreate` で try/catch、null返却時は renderer.render 直接呼びにフォールバック、`console.warn('[PostFX] disabled: <reason>')` を出力 |
