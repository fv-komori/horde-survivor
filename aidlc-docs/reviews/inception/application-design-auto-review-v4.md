# アプリケーション設計自動レビュー結果（v4）

**レビュー対象**: `aidlc-docs/inception/application-design/components-v4.md`
**レビュー日**: 2026-04-17
**レビュー方式**: 4専門家ロール並列自動レビュー + スコアリング（architect, frontend, security, ops）
**スキップロール**: backend（Python/Lambda/API非該当）, infra（CDK/AWS非該当、静的ホスティング変更なし）

---

## 判定: **PASS**

- イテレーション回数: 2回
- 指摘総数: iter2時点 約24件 / critical 0件 / important 3件 / medium 15件 / minor 6件
- 前回iter1からの改善: 全体平均 7.0 → 8.125（+1.125）、iter1指摘30件中28件解消

---

## 最終スコアマトリクス（イテレーション2）

| ロール | 正確性 | 設計品質 | セキュリティ | 保守性 | 平均 |
|--------|--------|---------|------------|--------|------|
| アーキテクト | 9/10 | 8/10 | 9/10 | 8/10 | 8.5 |
| FE | 8/10 | 8/10 | 9/10 | 7/10 | 8.0 |
| セキュリティ | 8/10 | 8/10 | 8/10 | 8/10 | 8.0 |
| 運用 | 8/10 | 8/10 | 8/10 | 8/10 | 8.0 |
| **全体平均** | **8.25** | **8.0** | **8.5** | **7.75** | **8.125** |

### 閾値判定
- 閾値: 全ロール × 全軸 ≥ 7/10
- 未達項目: **なし**
- 判定: **PASS**

---

## 前回イテレーション（iter1）からの修正適用結果

### 適用済み修正（HIGH信頼度）

| FIX-ID | 関連NG-ID | 修正内容 | 結果 |
|--------|----------|---------|------|
| FIX-1 | A-NG-1/8, F-NG-1, S-NG-1/5, O-NG-2/3 | PostFXManagerのtryCreate/handleContextLost/Restored/dispose/resize/render責務単一化 | 解消 |
| FIX-2 | A-NG-2/3, F-NG-6, O-NG-1 | Outline切替（userData.isOutline + SceneManager.setOutlineEnabled + QualityManager連携） | 解消 |
| FIX-3 | A-NG-8, F-NG-2, S-NG-3 | Outline適用範囲の定量化表（キャラ/武器のみ、InstancedMesh除外、+100ドローコール以内） | 解消 |
| FIX-4 | S-NG-2/6 | CSP適合性小節（BR-CSP01）追加 | 解消 |
| FIX-5 | F-NG-4, S-NG-4, O-NG-5 | static import結論 + 新規npm追加なし + gzip +70KB許容 | 解消 |
| FIX-6 | A-NG-6, F-NG-3, O-NG-6 | Fog/Sky距離整合 + setFog/Hemi切替（needsUpdate回避） | 解消 |
| FIX-7 | O-NG-4 | QualityManager.getRenderStats + ?debug=1表示 | 解消 |
| FIX-8 | A-NG-5 | Hemi OFF時のDirectional×1.15補正 | 解消 |
| FIX-9 | A-NG-7, F-NG-2 | PostFXManager/SceneManager/SettingsManager単体テスト追加 | 解消 |
| FIX-10 | F-NG-5, F-NG-7 | SmokePuffをSprite+Factoryキャッシュ+プール、Outline階層干渉対応 | 解消 |

### 自動設計判断（AUTO-DECIDED）

| FIX-ID | 関連NG-ID | 判断内容 | 根拠 |
|--------|----------|---------|------|
| AUTO-DECIDED-1 | F-NG-8 | ACES exposure 0.9〜1.2調整可、超過時はパレット再調整 | 要件FR-05整合 |
| AUTO-DECIDED-2 | O-NG-7 | LocalStorage欠損フィールド補完ロジック追加 | 後方互換性担保 |
| AUTO-DECIDED-3 | A-NG-9 | GLTF将来拡張のOutlineStrategy戦略パターン（YAGNI、現行はInvertedHullStrategy） | 過剰設計回避 |
| AUTO-DECIDED-4 | A-NG-4 | 生成フロー5ステップ明示 | 依存方向明文化 |

### スキップ/継続した項目

- **F-NG-6（FPS閾値の具体数値）**: iter2でF-NG-iter2-6として継続再指摘。既存QualityManagerの閾値設定（gameConfig.ts 既存）を継承する前提で設計書本文には値を再掲せず、実装時に既存値を参照する方針。

---

## iter2 新規指摘（Construction時に対応推奨）

### important（実装時に留意すべき事項）

| # | 概要 | 推奨対応 |
|---|------|---------|
| F-NG-iter2-4 | EffectComposer + ACES Tonemapping適用順で OutputPass 未記述（色味が想定と乖離する可能性） | Code Generation時に EffectComposer 末尾に `OutputPass` を追加、もしくは three バージョンに応じた ACES 適用経路を実装 |
| F-NG-iter2-6 | FPS閾値・Outline切替コストの定量値未記載（前回F-NG-6継続） | 既存 QualityManager.ts の閾値（fpsThresholdForDowngrade: 25 等）を継承、追加検証不要 |
| O-NG-2' | PostFX handleContextRestored 二次失敗時のログ未規定 | Code Generation時に console.warn を追加 |

### medium（運用フェーズで発覚しやすい改善ポイント）

- A-NG-1 (iter2): setQuality失敗時の例外ハンドリング（try/catch + fail-open）
- A-NG-2 (iter2): handleContextRestored失敗後のQuality再適用との状態一貫性ガード
- A-NG-4 (iter2): setOutlineEnabled の outlineMeshes キャッシュ配列化による O(n) 最適化
- F-NG-iter2-1: Outline拡大方式の実装確定（scale倍率 vs 頂点法線オフセット）
- F-NG-iter2-3: skyMesh の depthWrite=false, renderOrder=-1, side=BackSide 指定追加
- F-NG-iter2-5: Outline マテリアルの transparent=false 固定 / キャラ子Meshに半透明禁止
- S-NG-1 (iter2): debug Overlay の textContent 限定 / innerHTML 禁止
- S-NG-2 (iter2): dispose 例外の try/catch 飲み込み
- S-NG-3 (iter2): Smoke プール枯渇時 LRU 方針
- O-NG-1' / O-NG-3'〜O-NG-6': 運用時の閾値検知・schemaVersion・disabledFar根拠・復帰ドリフト防止

### minor（将来改善）

- A-NG-3 (iter2): QualityManager から renderer への参照注入経路
- A-NG-5 (iter2): OutlineStrategy抽出トリガ条件の明文化
- F-NG-iter2-2: PostFXManager.render(dt) の dt 引数利用要否
- F-NG-iter2-7: HemisphereLight.groundColor と地面色の検証
- F-NG-iter2-8: requirements-v4.md FR-02 の本文更新（設計と整合）
- S-NG-4 (iter2): コンテキストロスト再入制御（restoringInFlight）
- O-NG-7': Overlay DOM挿入方式の明記

---

## 主要改善ポイント（iter1 → iter2）

1. **PostFXManagerの成熟**: tryCreate/dispose/handleContextLost/Restored/resize の公式ライフサイクルと、render責務の内部集約で責務分離が劇的に改善
2. **Outline適用範囲の定量化**: キャラ/武器限定 + InstancedMesh除外表 + ドローコール +100以内見積もりでNFR-01整合性が担保
3. **CSP適合性の自己完結**: v4単体で BR-CSP01 整合を確認できる小節追加
4. **setHemi/Fog/Outline のシェーダ再コンパイル回避実装**: intensity=0, fog.far=9999, visible切替でスタッター回避
5. **永続設定マイグレーション**: LocalStorage欠損フィールド補完ロジック追加で後方互換性確保
6. **パフォーマンス監視**: getRenderStats + ?debug=1 でNFR-01定量検証手段確立

---

## 次ステップ

1. **Construction Phase (FD→CG→Build&Test)**: 本設計書に基づき実装開始
2. **Requirements-v4.md FR-02修正**: 設計書のフィードバックに応じて要件側 FR-02 を「キャラクター/武器のみ」に更新（F-NG-iter2-8対応）
3. **F-NG-iter2-4（OutputPass）対応**: Code Generation 時に EffectComposer 構成へ OutputPass 追加を必須事項として明記
4. **その他 medium/minor 指摘**: Code Generation 時に実装レベルで吸収
