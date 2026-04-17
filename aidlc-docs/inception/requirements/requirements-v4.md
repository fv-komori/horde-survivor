# Requirements - Iteration 4: ビジュアルリッチ化（Polish Pass）

## 参考画像

- メイン: `./reference-visual.png`（LAST WAR風トップダウン：チビキャラ・西部風背景・バレル・明確な輪郭線・ソフトな接地影）
- 補助: `./lastwar.jpeg`（エフェクト強度の参考：長い弾丸ストリーク・大きなマズルフラッシュ・砂埃/煙・高彩度・味方青系統一）

## Intent Analysis

- **User Request**: 現行Three.js実装を参考画像のリッチな見た目に一段近づけるポリッシュ（全面書き換えではない）
- **Request Type**: Enhancement（ビジュアル品質の磨き込み）
- **Scope Estimate**: レンダリング/ファクトリ/エフェクト限定（ゲームロジック・UI・音は変更なし）
- **Complexity Estimate**: Moderate（Three.js資産は維持しつつ、PostFX・Outline・キャラディテール・環境素材を追加）

## スコープ確定事項

| 項目 | 決定 |
|---|---|
| キャラ表現力向上 | 対象（顔パーツ・帽子ツバ・制服の分割で参考画像のチビ風に） |
| 輪郭線＋影の強化 | 対象（Outline風処理 + PCFSoft / ContactShadow） |
| ライティング＋PostFX | 対象（Bloom, ACES Tonemapping, HemisphereLight, Fog） |
| 環境・背景リッチ化 | 対象（木製フェンス・グラデーション空・地面ディテール） |
| バレル等の破壊可能オブジェクト | **対象外**（今回はビジュアルのみ、ゲームロジック不変） |
| 味方カラー | 青系に統一（参考画像2のレイアウトに合わせ、既存の緑から変更） |
| ゲームプレイ変更 | なし（既存ロジック・バランス・スポーン維持） |
| 既存ECS/Systems | 維持（RenderSystem・ProceduralMeshFactory・EffectManager3D・SceneManagerに改修集中） |

## 機能要件

### FR-01: キャラクター表現力向上

- プレイヤー / 味方 / 敵 NORMAL / FAST / TANK / BOSS すべてに以下を追加:
  - **目**: 顔正面に小さな黒いスフィア2個（参考画像のキャラ表現）
  - **帽子のツバ**: 薄いBoxを前方に配置（参考画像の赤/青キャップを再現）
  - **靴**: 脚下部に濃色の短いBoxで接地感を出す
  - **体型バランス**: 頭:胴:脚 比率を参考画像のチビプロポーション寄りに調整
- 味方カラーを**青系に変更**（プレイヤーと同一ファミリーで参考画像2と整合）
- 敵 NORMAL は「赤キャップ + 赤系制服」に統一（参考画像の赤帽ガード）

### FR-02: 輪郭線強化（トゥーン感）

- キャラ / 武器 / 弾丸 / アイテムに**アウトライン**を付与
- 実装方式: **BackSide反転ハル法**（追加レンダリングパスなし・軽量）
  - 既存メッシュに、黒MeshBasicMaterial（side: BackSide）のわずかに拡大したメッシュを追加
  - 背景（道路・地面・フェンス）にはアウトライン不要
- 既存 MeshToonMaterial と組み合わせてセルシェ感を強化

### FR-03: 影の強化

- レンダラーを **PCFSoftShadowMap** に変更
- DirectionalLight 角度を参考画像風の斜光に再調整、影の柔らかさを向上
- `receiveShadow` を道路・地面タイルに設定
- `castShadow` をキャラ・武器・バレル相当の構造物に設定

### FR-04: ライティング

- **HemisphereLight** を追加（空色→地面色のバウンス。AmbientLightの代替/併用）
- DirectionalLight の色味を暖色（朝/夕方風）に調整
- **Fog** を追加し、遠景を馴染ませる（色は空と揃える、near/farはカメラに合わせる）

### FR-05: PostFX（ポストプロセス）

- **Bloom**: 弾丸・マズルフラッシュ・爆発など emissive マテリアルを発光させる
  - three/examples/jsm/postprocessing/ の UnrealBloomPass を使用
- **ACES Filmic Tonemapping**: `renderer.toneMapping = ACESFilmicToneMapping` と `toneMappingExposure` を設定
- Low 品質設定では Bloom を OFF（NFR-01 既存ルール継続）

### FR-06: 弾丸・マズルフラッシュ強化

- **弾丸**: 現在の短い球から**光るトレイル**を持つ形状へ（Cylinder + emissive ToonMaterial、長手方向を進行方向に向ける）
- **マズルフラッシュ**: 発砲時に短命の**大型スプライト or Plane**を銃口に表示（黄橙色の放射状テクスチャ/シェーダ）
- 着弾スモーク: 小さな白い半透明ビルボード（短命パーティクル、既存EffectManager3Dを拡張）

### FR-07: 環境・背景リッチ化

- **ガードレール**: 既存の金属棒を**木製フェンス**（縦の杭 + 横木2本）に変更、色は参考画像の焼け木色
- **空/背景色**: 単色 `0xc9a96e` から**上下グラデーション**（青→砂色）の背景スフィア or `scene.background` をグラデShader化
- **地面ディテール**: 砂漠地面に色ムラ（MeshToonMaterialのvertexColorsやNoiseベース疑似模様）を追加
- **道路ライン**: 中央の白破線を少しだけ明度を上げ、道路色との対比を強化

### FR-08: 味方（Ally）カラー変更

- 既存 ProceduralMeshFactory.createAlly の色パレットを**青系**に差し替え（プレイヤー色より1段明るめで識別可能）

## 非機能要件

### NFR-01: パフォーマンス（Iter3のNFRを継承 + 以下を追加）

- Bloom有効時でも High品質: 平均60fps / 最低45fps を維持
- Outline追加によるドローコール増加は2倍以内に抑える（同一ジオメトリ使い回し + マテリアルキャッシュ）
- Low品質設定では Bloom / Outline / HemisphereLight を無効化可能にする

### NFR-02: 既存アーキテクチャ互換

- ECS・Systems は**変更なし**
- 改修範囲は以下に限定:
  - `src/factories/ProceduralMeshFactory.ts`（FR-01, FR-02, FR-06, FR-07）
  - `src/rendering/SceneManager.ts`（FR-03, FR-04, FR-07）
  - `src/rendering/QualityManager.ts`（NFR-01 品質切替）
  - `src/rendering/EffectManager3D.ts`（FR-06）
  - `src/rendering/PostFXManager.ts`（**新規** - FR-05）
  - `src/game/GameService.ts`（PostFXComposer統合）
  - `src/config/gameConfig.ts`（新パラメータ追加）

### NFR-03: ビジュアル品質受入基準

- 参考画像との目視比較で以下が改善していること:
  - キャラに顔・帽子ツバが見える
  - 黒い輪郭線で背景と分離されて見える
  - 接地影が視認できる
  - 発砲時に画面が明るく華やかに見える（Bloom）
  - フェンスが木製風に見える
- ステークホルダー（依頼者）によるスクリーンショット承認で受入

### NFR-04: テスト

- 既存86テストが全てPASSを維持
- 新規ユーティリティ（Outline生成、PostFXセットアップ）は単体テスト対象外（ビジュアルテスト）

## 影響範囲サマリ

### 大幅変更
- `src/factories/ProceduralMeshFactory.ts` — キャラ全種に顔/帽子/靴追加、味方色変更、Outline適用、弾丸/マズルフラッシュのメッシュ改修、フェンス再設計
- `src/rendering/SceneManager.ts` — HemisphereLight / Fog / グラデ背景 / PCFSoftShadowMap 適用

### 中程度
- `src/rendering/EffectManager3D.ts` — マズルフラッシュ、着弾スモークのエフェクト拡張
- `src/game/GameService.ts` — EffectComposer / Bloom / Tonemapping統合、resize対応

### 新規
- `src/rendering/PostFXManager.ts` — EffectComposer・UnrealBloomPass管理

### 軽微
- `src/config/gameConfig.ts` — Bloom強度、Outline太さ、Fog設定、HemiLight色等のパラメータ追加
- `src/rendering/QualityManager.ts` — Low品質時のPostFX/Outline切替

### 変更なし（維持）
- ECS全般、ゲームロジック系System、オーディオ、UI、設定管理
