# コンポーネント依存関係 - Iteration 5

## 依存グラフ

```
                              main.ts
                                 │
                                 │ new / load await
                                 ▼
                         ┌──────────────┐
                         │ AssetManager │◄─────── (参照元3箇所)
                         └──────┬───────┘
                                │
                    ┌───────────┼───────────────────┐
                    │           │                   │
                    ▼           ▼                   ▼
            ┌──────────────┐  ┌────────────────┐  ┌───────────────┐
            │ LoaderScreen │  │ EntityFactory  │  │ GameStartScreen│
            │              │  │  (DI: ロード済) │  │ (Idleプレビュー)│
            └──────────────┘  └────────┬───────┘  └───────────────┘
                                       │
                                       │ 生成時にcomponent注入
                                       ▼
                              ┌────────────────────┐
                              │ Entity (in World)  │
                              │  - MeshComponent   │
                              │  - AnimationState  │
                              │  - Position等既存  │
                              └────────┬───────────┘
                                       │
                          ┌────────────┴─────────────┐
                          │                          │
                          ▼                          ▼
                ┌──────────────────┐        ┌─────────────────┐
                │ CombatSystem     │        │ HealthSystem    │
                │ (hitReactTimer書込)│       │ (deathFlag書込) │
                └──────────────────┘        └─────────────────┘
                          │                          │
                          └────────────┬─────────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ AnimationSystem  │ ← state machine駆動
                              │  - mixer.update  │
                              │  - clip切替      │
                              │  - finished監視  │
                              └────────┬─────────┘
                                       │ (Death完了時)
                                       ▼
                              ┌──────────────────┐
                              │ CleanupSystem    │ ← dispose責任
                              │  - XPドロップ     │
                              │  - mixer uncache │
                              │  - disposeDeep   │
                              │  - entity削除     │
                              └────────┬─────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ ThreeJSRender    │
                              │  System          │
                              └──────────────────┘
```

## 依存の向き（矢印は「使用する側 → 使用される側」）

### 起動時の依存
- `main.ts` → `AssetManager`, `LoaderScreen`, `GameStartScreen`, `GameService`
- `GameService` → `AssetManager`（DI受取）, `EntityFactory`, `SceneManager`, `World`
- `EntityFactory` → `AssetManager`（DI、constructor assert）, `SceneManager`, `BoneAttachmentConfig`, `AssetPaths`

### ランタイムの依存
- `CombatSystem` → `AnimationStateComponent`（書込）
- `HealthSystem` → `AnimationStateComponent`（書込）
- `AnimationSystem` → `MeshComponent`, `AnimationStateComponent`, `VelocityComponent`（読取、A-NG-7対応で明示）
- `CleanupSystem` → `MeshComponent`, `DeathCompleteFlag`, `mixer` API（uncache系）
- `ThreeJSRenderSystem` → `Scene`（既存、Iter3から変更なし）

### 定数の依存
- `AssetManager` → `AssetPaths`（パス取得）
- `EntityFactory` → `BoneAttachmentConfig`（attach時）

## 循環依存なし（検証）

| A | B | 方向 | 逆方向 | 判定 |
|---|---|---|---|---|
| AssetManager | LoaderScreen | ← onProgress callback | なし | OK |
| AssetManager | EntityFactory | ← DI参照 | なし | OK |
| AnimationSystem | CombatSystem | ← 書込フラグ読取 | なし | OK |
| AnimationSystem | CleanupSystem | ← DeathCompleteFlag受渡 | なし | OK |
| CleanupSystem | mixer API | ← uncache系 | なし | OK |

## 影響範囲マップ（変更時の波及）

| 変更対象 | 影響するファイル | 影響するテスト |
|---|---|---|
| `AssetPaths` 変更（v1→v2） | AssetManager（1行変更のみ） | AssetManager.test.ts |
| `BoneAttachmentConfig` bone名変更 | EntityFactory（config参照のみ、コード不変） | EntityFactory.gltf.test.ts |
| `AnimationStateComponent` フィールド追加 | AnimationSystem, CombatSystem, HealthSystem, EntityFactory | AnimationStateComponent.test.ts, AnimationSystem.test.ts |
| `MeshComponent` 拡張 | EntityFactory（生成時）, AnimationSystem, CleanupSystem, ThreeJSRenderSystem（参照） | AnimationSystem.test.ts, EntityFactory.gltf.test.ts |
| `AssetManager` ロード失敗ハンドリング変更 | main.ts, LoaderScreen | AssetManager.test.ts |
| System priority変更 | World（登録順） | 該当Systemのtest |

## 非機能属性の依存

### NFR-07 メモリ管理
- CleanupSystem が mixer.uncacheRoot / uncacheAction を呼ぶ責任
- EntityFactory が生成する material/geometry の dispose 可能性（単独インスタンス）を保証
- AssetManager は**テンプレートを保持するのみ**、dispose 経路を持たない（アプリ終了まで保持）

### NFR-01 パフォーマンス
- AnimationSystem がフレーム予算の最大2割を占有（~3ms/16.6ms）
- 51キャラ同時稼働時に mixer.update 51回を直列実行
- アニメクリップの共有（AssetManager内 Array<AnimationClip>）により複製せずメモリ節約

### NFR-05 テスタビリティ
- GLTFLoader は `jest.mock` で stub 化可能（`tests/fixtures/mockGltf.ts`）
- AssetManager は fixture から任意のロード結果を注入可能
- EntityFactory は mock AssetManager で clone 独立性のみテスト可能

### NFR-08 CSP
- GLTFLoader は fetch 経由でロード（`connect-src 'self'`）
- LoaderScreen は DOM API のみ使用（`innerHTML` 非使用）
- 追加 Web Worker 不使用（現時点、将来DRACO採用時は `worker-src 'self' blob:`）

## 依存関係の検証手順（Construction時）

1. TypeScript コンパイル: 循環import検出
2. `madge --circular src/` で import グラフ検証
3. ESLint: `import/no-cycle` ルール追加検討（既存ルール踏襲）
