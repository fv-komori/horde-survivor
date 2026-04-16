# Code Generation Plan - ビジュアルリニューアル（Three.js導入）

## ユニット情報
- **ユニット名**: visual-overhaul
- **プロジェクトタイプ**: Brownfield
- **ワークスペースルート**: /Users/komori/fv-genai-specialforce/fv-game
- **既存構造**: src/ 配下にECSベースのTypeScriptコード

## FD自動レビュー指摘の対応方針
- 品質切替: BL-06にsustainDuration追加（BR-Q01の連続5秒を反映）
- 敵NORMALプール: maxCount=100（画面内同時最大を考慮、枯渇時は個別Meshフォールバック）
- 武器メッシュ: WeaponType別(FORWARD/SPREAD/PIERCING)のGroup構成を実装
- Allyメッシュ: Player類似の緑系Group構成を実装
- dispose一元化: World.destroyEntity()にフックしSceneManager経由でdispose
- DOMプール: acquire/releaseパターンで実装
- Tree-shaking: Named importを原則使用

## 実装ステップ

### Phase 1: 基盤セットアップ
- [ ] Step 1: Three.js依存パッケージのインストール
  - `npm install three` / `npm install -D @types/three`
- [ ] Step 2: MeshComponent作成（SpriteComponent置換）
  - 新規: `src/components/MeshComponent.ts`
  - 変更: `src/types/index.ts` — MeshComponent関連の型追加
- [ ] Step 3: CoordinateMapper作成
  - 新規: `src/utils/CoordinateMapper.ts`
- [ ] Step 4: gameConfig拡張（three設定追加）
  - 変更: `src/config/gameConfig.ts` — three セクション追加

### Phase 2: メッシュ生成 & シーン管理
- [ ] Step 5: ProceduralMeshFactory作成
  - 新規: `src/factories/ProceduralMeshFactory.ts`
  - Player/Ally/Enemy(4タイプ)/Bullet/Item/Weapon(3タイプ)/背景メッシュ生成
  - マテリアルキャッシュ管理
- [ ] Step 6: InstancedMeshPool作成
  - 新規: `src/rendering/InstancedMeshPool.ts`
  - acquire/release/updateMatrix/setColor/rebuild
- [ ] Step 7: SceneManager作成
  - 新規: `src/rendering/SceneManager.ts`
  - Scene/Light管理、背景タイル循環配置、エンティティObject3D追加/除去/dispose

### Phase 3: レンダリングシステム
- [ ] Step 8: QualityManager作成
  - 新規: `src/rendering/QualityManager.ts`
  - FPS計測(60フレーム移動平均)、品質ティア自動切替(sustainDuration付き)、SettingsManager連携
- [ ] Step 9: ThreeJSRenderSystem作成
  - 新規: `src/systems/ThreeJSRenderSystem.ts`
  - PerspectiveCamera(FOV60,固定位置)、WebGLRenderer、毎フレーム位置同期
  - InstancedMesh対象/個別Meshの分岐、背景スクロール更新
  - WebGLコンテキストロスト復帰(handleContextLost/Restored)
  - リサイズハンドリング

### Phase 4: エフェクト & HP表示
- [ ] Step 10: EffectManager3D作成
  - 新規: `src/rendering/EffectManager3D.ts`
  - マズルフラッシュ(PointLight+パーティクル)、敵撃破パーティクル、バフ光柱、アイテム回転
  - 品質ティア別パーティクル数
- [ ] Step 11: HTMLOverlayManager作成
  - 新規: `src/ui/HTMLOverlayManager.ts`
  - HUD(HP,バフ,スコア,ウェーブ,武器)、タイトル画面、ゲームオーバー画面
  - HP表示(3D→スクリーン座標投影)、ダメージ数値フロートアップ(DOMプール)
  - モバイル操作ボタン、フォールバックメッセージ
  - innerHTML禁止、textContent/DOM API使用

### Phase 5: 既存コード改修
- [ ] Step 12: EntityFactory改修
  - 変更: `src/factories/EntityFactory.ts`
  - SpriteComponent→MeshComponent、ProceduralMeshFactory/SceneManager/InstancedMeshPool DI
- [ ] Step 13: WeaponSystem / AllyFollowSystem改修
  - 変更: `src/systems/WeaponSystem.ts` — SpriteComponent.width→MeshComponent.logicalWidth
  - 変更: `src/systems/AllyFollowSystem.ts` — 同上
- [ ] Step 14: EffectSystem改修
  - 変更: `src/systems/EffectSystem.ts` — EffectManager3D経由の3Dエフェクト生成
- [ ] Step 15: InputSystem / InputHandler改修
  - 変更: `src/systems/InputSystem.ts` — renderer.domElement参照
  - 変更: `src/input/InputHandler.ts` — canvas参照先変更
- [ ] Step 16: CleanupSystem改修 + World拡張
  - 変更: `src/systems/CleanupSystem.ts` — MeshComponent保有エンティティのdispose追加
  - 変更: `src/ecs/World.ts` — destroyEntity時のdisposeフック（onDestroyCallback）

### Phase 6: GameService統合 & エントリポイント
- [ ] Step 17: GameService統合
  - 変更: `src/game/GameService.ts`
  - Three.js初期化フロー、WebGL2チェック、System登録変更(RenderSystem→ThreeJSRenderSystem)
  - UIレンダリングをHTMLOverlayManager経由に変更
  - 旧Canvas 2D UIクラス(HUD/TitleScreen/GameOverScreen)の参照除去
- [ ] Step 18: index.html & CSS更新
  - 変更: `index.html` — Three.js用DOM構造、HTMLオーバーレイコンテナ
  - 新規: `src/styles/overlay.css` — HUD/ダメージ/タイトル/ゲームオーバーのCSS
- [ ] Step 19: 旧Canvas 2D描画コード廃止
  - 削除: `src/systems/RenderSystem.ts`
  - 削除: `src/ui/HUD.ts`
  - 削除: `src/ui/TitleScreen.ts`
  - 削除: `src/ui/GameOverScreen.ts`
  - 変更: `src/components/SpriteComponent.ts` → MeshComponentに置換（ファイル削除）

### Phase 7: SettingsManager拡張 & 品質設定
- [ ] Step 20: SettingsManager拡張
  - 変更: `src/game/SettingsManager.ts` — 品質設定(high/low)の永続化追加
  - 変更: `src/ui/SettingsScreen.ts` — 品質切替UIの追加

### Phase 8: ビルド検証
- [ ] Step 21: TypeScriptコンパイル & ESLint修正
  - `npx tsc --noEmit` でコンパイルエラー確認・修正
  - `npm run lint` でESLintエラー修正
- [ ] Step 22: Viteビルド確認
  - `npm run build` でビルド成功確認
  - バンドルサイズ確認（gzip後1MB以下目標）

## ファイル一覧サマリー

### 新規作成（12ファイル）
| # | パス | 内容 |
|---|------|------|
| 1 | src/components/MeshComponent.ts | Three.js Object3D参照コンポーネント |
| 2 | src/utils/CoordinateMapper.ts | 2D⇔3D座標変換 |
| 3 | src/factories/ProceduralMeshFactory.ts | プロシージャルメッシュ生成 |
| 4 | src/rendering/InstancedMeshPool.ts | InstancedMesh管理プール |
| 5 | src/rendering/SceneManager.ts | Three.jsシーン管理 |
| 6 | src/rendering/QualityManager.ts | 品質ティア自動切替 |
| 7 | src/systems/ThreeJSRenderSystem.ts | Three.jsレンダリングSystem |
| 8 | src/rendering/EffectManager3D.ts | 3Dエフェクト管理 |
| 9 | src/ui/HTMLOverlayManager.ts | HTMLオーバーレイUI |
| 10 | src/styles/overlay.css | オーバーレイCSS |

### 変更（11ファイル）
| # | パス | 変更内容 |
|---|------|---------|
| 1 | src/types/index.ts | MeshComponent型追加 |
| 2 | src/config/gameConfig.ts | three設定追加 |
| 3 | src/factories/EntityFactory.ts | MeshComponent+DI |
| 4 | src/systems/WeaponSystem.ts | MeshComponent参照 |
| 5 | src/systems/AllyFollowSystem.ts | MeshComponent参照 |
| 6 | src/systems/EffectSystem.ts | EffectManager3D連携 |
| 7 | src/systems/InputSystem.ts | renderer.domElement |
| 8 | src/input/InputHandler.ts | canvas参照先変更 |
| 9 | src/systems/CleanupSystem.ts | dispose追加 |
| 10 | src/ecs/World.ts | onDestroyCallback |
| 11 | src/game/GameService.ts | Three.js統合 |
| 12 | index.html | DOM構造変更 |
| 13 | src/game/SettingsManager.ts | 品質設定追加 |
| 14 | src/ui/SettingsScreen.ts | 品質切替UI |

### 削除（4ファイル）
| # | パス | 理由 |
|---|------|------|
| 1 | src/systems/RenderSystem.ts | ThreeJSRenderSystemに置換 |
| 2 | src/ui/HUD.ts | HTMLOverlayManagerに統合 |
| 3 | src/ui/TitleScreen.ts | HTMLOverlayManagerに統合 |
| 4 | src/ui/GameOverScreen.ts | HTMLOverlayManagerに統合 |
| 5 | src/components/SpriteComponent.ts | MeshComponentに置換 |
