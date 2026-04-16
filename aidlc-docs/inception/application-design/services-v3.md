# サービス定義 - Iteration 3: ビジュアルリニューアル

---

## S-SVC-01: GameService（メインオーケストレーター）— 変更

### 責務（変更点）
- Three.js初期化（SceneManager, ThreeJSRenderSystem, QualityManager）
- Canvas 2Dの初期化を削除、WebGLレンダラーに置換
- UIレンダリングをHTMLOverlayManager経由に変更
- ゲームループ構造は維持（requestAnimationFrame）

### 初期化フロー（変更後）
```
GameService.init()
  ├─ SceneManager 生成
  ├─ QualityManager 生成（品質自動検出）
  ├─ ProceduralMeshFactory 生成
  ├─ ThreeJSRenderSystem 生成（Scene, Camera, Renderer, Lights）
  ├─ HTMLOverlayManager 生成
  ├─ EntityFactory 生成（ProceduralMeshFactory, SceneManager注入）
  ├─ EffectManager3D 生成
  ├─ ECS Systems 登録（既存順序維持、RenderSystem→ThreeJSRenderSystem）
  ├─ AudioManager 初期化（既存維持）
  └─ SettingsManager 初期化（既存維持）
```

### ゲームループ（変更後）
```
gameLoop(timestamp)
  ├─ dt計算（既存維持）
  ├─ update(dt)
  │  ├─ GameState判定（TITLE/PLAYING/GAME_OVER）
  │  ├─ world.update(dt) → 全System実行（ThreeJSRenderSystem含む）
  │  └─ HTMLOverlayManager更新（HUD, 画面遷移）
  └─ requestAnimationFrame(gameLoop)
```

---

## S-SVC-02: SceneManager（新規）

### 責務
- Three.js Sceneの一元管理
- エンティティのObject3Dライフサイクル（追加/除去/dispose）
- 背景オブジェクト管理
- ライティングセットアップ

### 他サービスとの関係
- **ThreeJSRenderSystem** が毎フレーム参照（scene, camera）
- **EntityFactory** がエンティティ生成時にObject3D追加
- **CleanupSystem** がエンティティ破棄時にObject3D除去+dispose

---

## S-SVC-03: QualityManager（新規）

### 責務
- デバイスGPU性能の推定
- High/Low品質パラメータ管理
- fps監視による自動品質切替
- SettingsManagerとの連携（ユーザー手動設定の永続化）

### 品質設定
| パラメータ | High | Low |
|---|---|---|
| シャドウマップ | 有効 (1024px) | 無効 |
| パーティクル数 | 最大50 | 最大15 |
| ポストプロセス | 有効 | 無効 |
| テクスチャ品質 | フル | 半分 |

---

## S-SVC-04: HTMLOverlayManager（新規）

### 責務
- Canvas 2D UIの全機能をHTMLオーバーレイに移行
- 既存HUD, TitleScreen, GameOverScreenの機能を統合
- モバイル操作ボタン
- DOM要素のtextContent/DOM API使用（innerHTML禁止）

### 既存UIからの移行マッピング
| 既存 | 移行先 |
|---|---|
| HUD.ts (Canvas描画) | HTMLOverlayManager.updateHUD() |
| TitleScreen.ts (Canvas描画) | HTMLOverlayManager.showTitleScreen() |
| GameOverScreen.ts (Canvas描画) | HTMLOverlayManager.showGameOverScreen() |
| SettingsScreen.ts (既にHTML) | 既存維持 |

---

## S-SVC-05: EffectManager3D（新規）

### 責務
- 3Dエフェクトの生成・アニメーション・除去
- 品質ティアに応じたパーティクル数調整
- EffectSystemとの連携

---

## 既存サービス（変更なし）

| サービス | 責務 | 変更 |
|---|---|---|
| ScoreService | スコア計算・管理 | なし |
| SettingsManager | 設定永続化 | 品質設定項目追加のみ |
| AudioManager | BGM/SE管理 | なし |
| BGMGenerator | BGM生成 | なし |
| SoundGenerator | SE生成 | なし |
| WaveManager | ウェーブ進行管理 | なし |
| SpawnManager | エンティティ生成制御 | なし |
| ItemDropManager | アイテム生成制御 | なし |
