# サービス定義 - Iteration 5: GLTFモデル導入

（components-v5.md の責務と重複する部分は省略、サービス間の連携と初期化フロー・ランタイムフローに焦点）

---

## S-SVC-01: GameService（改修）

### 責務の変更
- 起動シーケンスに AssetManager プリロード段階を追加
- World/Systems/EntityFactory 生成は AssetManager ロード完了後のみ
- 起動途中例外時のロールバック（teardown）

### 初期化フロー（Iter5 確定、FR-01/起動シーケンス節 準拠）

```
main.ts
  ├─ LoaderScreen 表示（textContent のみ、DOM構築）
  ├─ AssetManager 生成 → load() 呼出
  │    ├─ 12ファイル並列 GLTFLoader.load()
  │    ├─ 個別30秒/全体60秒タイムアウト
  │    ├─ onProgress → LoaderScreen.updateProgress(loaded, total)
  │    └─ 成功: Promise.resolve / 失敗: LoaderScreen.showError()
  │
  ├─ [成功後] GameStartScreen 表示
  │    └─ 内部 mini-renderer で Character_Soldier Idle プレビュー駆動
  │
  └─ [Start押下] GameService.init(assetManager)
       ├─ SceneManager 生成（既存）
       ├─ QualityManager 生成（既存）
       ├─ PostFXManager.tryCreate（既存、Iter4）
       ├─ EntityFactory 生成（AssetManager を DI）
       │    ※ AssetManager.isLoaded() を assert、未ロードなら throw
       ├─ SceneManager.setupEnvironment(assetManager)  // 環境GLTF配置
       ├─ World + Systems 登録
       │    - 既存System群（priority順）
       │    - AnimationSystem（RenderSystem直前、priority=X）🆕
       │    - CleanupSystem（AnimationSystem直後、priority=X+1）改修
       ├─ 初期entity生成（Player 1体）
       ├─ HTMLOverlayManager起動
       ├─ AudioManager初期化
       └─ GameLoop開始
```

### 起動失敗時のロールバック（O-NG-13対応）
```ts
async initSafely(assetManager: AssetManager): Promise<void> {
  try {
    await this.init(assetManager);
  } catch (err) {
    this.teardown();  // 生成済みリソースを逆順dispose
    throw err;        // 呼出元（main.ts）でLoaderScreenエラー表示へ
  }
}

private teardown(): void {
  // 逆順でdispose（O-NG-3対応）:
  //   1. GameLoop 停止（rafId cancel）
  //   2. SceneManager.dispose()（環境GLTF配置解除）
  //   3. World.clear() 呼出前に CleanupSystem.forceDisposeAll(world)
  //      Death途中 entity も mixer.finished を待たず即dispose（finishedリスナー解除込み）
  //   4. Systems解除
  //   5. PostFXManager.dispose()
  //   6. HTMLOverlayManager.destroy()
  //   7. MetricsProbe.stop()
  // AssetManager は保持（次回試行で再利用可、dispose禁止）
  // 全フィールドに optional chain でアクセス（init途中例外時に一部未生成の可能性）
}
```

### ゲームループ（変更なし）
- 既存構造維持、World.update(dt) が AnimationSystem を駆動

---

## S-SVC-02: AssetManager（新規サービス）

### 責務
- GLTFファイルのプリロード・キャッシュ
- **テンプレートは不変**（dispose禁止）

### 他サービスとの関係
- **main.ts** が生成、load() 完了を await
- **EntityFactory** が参照（DI経由でテンプレート取得）
- **SceneManager** が参照（環境GLTF配置）
- **GameStartScreen** が参照（Idleプレビュー用）

### load() 内部フロー
```
1. AssetPaths から全12ファイルのURLを取得
2. Promise.all([...12 Promises]) で並列ロード
   - 各 Promise は GLTFLoader.load(url) をラップ
   - Promise.race で30秒タイムアウトを重畳
3. 全体60秒タイムアウトを別 Promise.race で包む
4. onProgress コールバック（各ファイル完了時に loaded++）
5. 成功: テンプレートを内部 Map に格納
6. 失敗: reject、エラー詳細は console のみ（UIには汎用メッセージ）
```

### メモリ保持量（見積）
- 12ファイル合計7MB の glTF JSON
- パース後のThree.jsオブジェクト + アニメクリップ + skeleton は数十MB程度（見積）
- NFR-07 JSヒープ200MB上限内に収まる想定

---

## S-SVC-03: AnimationSystem（新規ECS System）

### 責務
components-v5.md C-02 参照。state machine駆動、mixer.update、finished listener管理。

### 他Systemとの関係
- **CombatSystem**（hitReactTimer 書込元）
- **HealthSystem**（deathFlag 書込元）
- **CleanupSystem**（DeathCompleteFlag 消費元）
- **ThreeJSRenderSystem**（ボーン行列反映後に描画）

### 同時処理性能
- 51キャラ × `mixer.update()` = 51呼出/フレーム
- 各 mixer は独立、並列性はないが Three.js 内部ループは高速
- NFR-01 目標60fps（16.6ms/フレーム）のうち mixer 処理は見積2〜3ms

---

## S-SVC-04: LoaderScreen（新規UI、UIサービス扱い）

### 責務
components-v5.md C-04 参照。

### 他サービスとの関係
- **main.ts** が所有、AssetManager.load() の onProgress を受ける
- **AssetManager** とは一方向依存のみ（LoaderScreen → AssetManager ではない）
- GameStartScreen遷移時に破棄

---

## S-SVC-05: EntityFactory（改修）

### 責務の変更
- ProceduralMeshFactory依存を廃止
- AssetManager 経由で GLTF テンプレート取得、clone・tint・bone attach

### 初期化契約（DI制約）
```ts
constructor(world, assetManager, sceneManager) {
  if (!assetManager.isLoaded()) {
    throw new Error('EntityFactory requires loaded AssetManager');
  }
  // ...
}
```

### 他サービスとの関係
- **AssetManager** から GltfTemplate 取得
- **SceneManager** に生成 root/outlineMesh を add
- **World** に entity 登録、Component群注入

---

## S-SVC-06: SceneManager（軽微改修）

### 変更点
- `setupEnvironment(assetManager)` を追加（環境GLTF配置）
- プロシージャル環境（道路・地面タイル）は Iter4 同様継続
- AssetManager から環境テンプレートを取得し `scene.clone(true)` で配置

---

## S-SVC-06b: ThreeJSRenderSystem（webglcontextrestored 結線、O-R2-5対応）

```ts
// GameService.init() 内、ThreeJSRenderSystem 生成直後に結線
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  console.warn('[WebGL] context lost');
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  console.info('[WebGL] context restored, calling AssetManager.restoreTextures');
  this.assetManager.restoreTextures();
  // 注: clone 側 material の texture は AssetManager テンプレートと参照共有のため、
  // テンプレート Texture.needsUpdate=true により全entityに波及する
});
```

- material.clone() は texture を shallow copy（参照共有）するため、AssetManager 側の1回の `needsUpdate=true` で全entityに波及する
- これはIter5設計の重要な前提（material.color は独立、texture は共有）

---

## S-SVC-01 teardown 呼出トリガ（O-R2-3対応）

| トリガ | 呼出元 | dispose対象 |
|---|---|---|
| 起動例外（ロード後のinit失敗） | GameService.initSafely の catch | 部分生成リソース |
| Game Over → 再プレイ（World再構築する場合） | GameService.restart() | 既存World一式（forceDisposeAll経由） |
| タブ close / reload | 明示処理なし（ブラウザGC任せ） | — |

- teardown() は idempotent にする（2回呼ばれても安全、冒頭で `if (this.tornDown) return` ガード）
- forceDisposeAll の iterate は `Array.from(world.allEntities())` でスナップショット化してから実行（mutation回避）

---

## S-SVC-08: MetricsProbe（新規、O-NG-1 / O-NG-7対応）

components-v5.md C-15 参照。GameService から `start()` / `stop()` を呼ぶ。他Service依存なし。
- `start()`: `init` 成功時に呼ぶ
- `stop()`: `teardown` 時に呼ぶ

---

## S-SVC-07: GameStartScreen（軽微改修）

### 変更点
- 内部に独立した「プレビュー mini-renderer」を持つ:
  - THREE.Scene / PerspectiveCamera / WebGLRenderer（64x64等の小Canvas）
  - Character_Soldier を clone → AnimationMixer で `Idle` 再生
  - 専用 `requestAnimationFrame` ループ
- Start押下時に mini-renderer を停止・dispose、メインGame を起動

### リソース処理
- プレビュー用 clone は mini-renderer 破棄時に CleanupSystem 同等の dispose 処理を手動実行
- 本番World とは別経路のため、CleanupSystemの対象外

---

## サービス間のシーケンス（代表ケース）

### 起動〜プレイ開始
```
user         main.ts       AssetManager       LoaderScreen       GameStartScreen      GameService      World
 │              │               │                   │                    │                 │             │
 │              ├── show()──────────────────────────>│                    │                 │             │
 │              │               │                   │                    │                 │             │
 │              ├─ new() ───────>│                   │                    │                 │             │
 │              │               │                   │                    │                 │             │
 │              ├─ load(onProg)─>│                   │                    │                 │             │
 │              │               │─ load 12 gltf ───>│  (onProgress loop)  │                 │             │
 │              │               │                   │                    │                 │             │
 │              │<─ resolved ───│                   │                    │                 │             │
 │              ├── hide() ─────────────────────────>│                    │                 │             │
 │              ├─ show() ────────────────────────────────────────────────>│                 │             │
 │              │               │                   │                    │ (mini-renderer  │             │
 │              │               │                   │                    │  Idle再生ループ) │             │
 Start押下──────>│              │                   │                    │                 │             │
 │              ├── stopPreview────────────────────────────────────────────>│                 │             │
 │              ├─ init(assetMgr)────────────────────────────────────────────────────────────>│             │
 │              │               │                   │                    │                 ├─ setupEnv ─>│
 │              │               │                   │                    │                 ├─ createPlayer>
 │              │               │                   │                    │                 ├─ GameLoop──>│
```

### 敵撃破シーケンス（Death完了→削除）
```
HealthSystem                 AnimationSystem                 CleanupSystem        World
    │                             │                              │                  │
    ├ HP<=0検知                    │                              │                  │
    ├ anim.deathFlag = true ──────>│                              │                  │
    │                             │                              │                  │
    │  (次フレーム)                  │                              │                  │
    │                             ├ deathFlag検知                  │                  │
    │                             ├ Death.setLoop(LoopOnce,1)    │                  │
    │                             ├ action.play()               │                  │
    │                             ├ addEventListener('finished', handler)            │
    │                             ├ mixer.update(dt) (Death進行中)                   │
    │                             │                              │                  │
    │  (Death clip完了、~1.5秒後)     │                              │                  │
    │                             ├ handler発火                   │                  │
    │                             ├ event.action.clip=='Death' OK                    │
    │                             ├ entity.add(DeathCompleteFlag)│                  │
    │                             ├ removeEventListener         │                  │
    │                             │                              │                  │
    │                             │                              ├ DeathCompleteFlag検知
    │                             │                              ├ (a) XPドロップ      │
    │                             │                              ├ (b) mixer.stopAllAction
    │                             │                              ├     uncacheAction   │
    │                             │                              ├     uncacheRoot     │
    │                             │                              ├     disposeDeep    │
    │                             │                              ├ (c) world.removeEntity──>│
```

---

## テストカバレッジ（NFR-05対応、概算件数）

### 新規テストファイル（5種）
| ファイル | 想定件数 | 主カバー観点 |
|---|---|---|
| `AssetManager.test.ts` | 8 | 成功/部分失敗/タイムアウト/payload上限/mock GLTFLoader |
| `AnimationSystem.test.ts` | 10 | state遷移/crossFade/Death完了/HitReactパルス/listener解除 |
| `AnimationStateComponent.test.ts` | 4 | 初期値/hitReactTimer書込/deathFlag書込/currentClipリセット |
| `EntityFactory.gltf.test.ts` | 8 | clone独立性（material/skeleton `!==`）/tint波及なし/outlineMesh生成/bone attach |
| `mockGltf.ts`（fixture） | - | 共通 |

### 削除想定テストファイル
- `ProceduralMeshFactory.test.ts` 系（実件数は Construction着手時に grep で確定）

### 見積: 86件 - 削除約10件 + 追加約30件 ≒ **106件程度**

---

## パフォーマンス予算（NFR-01対応）

| 処理 | 予算（1フレーム16.6ms内） | 備考 |
|---|---|---|
| 既存 Update系Systems | ~6ms | Iter4維持 |
| **AnimationSystem.update** | ~3ms | 51キャラ mixer.update |
| PostFX / Bloom | ~2ms | High品質のみ |
| ThreeJSRenderSystem | ~5ms | SkinnedMesh 102体描画 |
| 余剰 | ~0.6ms | GC/イベント処理 |

- 45fps 維持（22ms/フレーム）が最低ラインで、mixer処理を最大6msまで許容
- Low品質: AnimationSystem間引き（本Iter未採用、Iter6判断）

---

## 残課題（Construction着手時の補完項目）

| 項目 | 対応タイミング | 備考 |
|---|---|---|
| bone名3モデル実測 | Construction Day 1 | **完了**: 3キャラ共通 `LowerArm.R` 確定、BoneAttachmentConfig は1パターン |
| 反転ハルSkinnedMesh PoC | Construction Day 1 | **完了**: geometry clone + skeleton 共有 bind 成立、`outlineThickness=0.02` 基準値、Run/Walk/Wave/Death 等7アニメで破綻なし |
| payload実測（Character 2.3MB） | Construction Day 1 | **完了**: 全12ファイル 3MB上限内、最大 Character_Soldier.gltf 2.23 MiB |
| ProceduralMeshFactory呼び出し元grep最終確認 | Construction Day 1 | **完了**: EffectManager3D 漏れ追加、Option B 移設方針確定 |
| GLTF→GLB 変換（data: URL 排除） | Construction Day 2 | dev CSP で暫定 `connect-src 'self' data:` 許容中。本番 CSP 最小化（NFR-09）のため `.glb` 単一バイナリへ変換予定 |
| テスト削除件数の確定 | Construction 早期 | NFR-05件数合わせ |
| renderer.info triangle/drawCall実測 | Construction PoC段階 | NFR-01追記 |
