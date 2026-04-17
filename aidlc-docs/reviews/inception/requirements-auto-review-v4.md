# 要件定義自動レビュー結果（v4, Iteration 5）

**レビュー対象**: aidlc-docs/inception/requirements/requirements-v5.md
**レビュー日**: 2026-04-17
**レビュー方式**: 6専門家ロール自律レビュー+スコアリング+自動修正サイクル

---

## 判定: PASS

- イテレーション回数: **2回**（iter1 FAIL → 自動修正 15 FIX → iter2 PASS）
- 指摘総数: iter1で57件 → iter2で 前回48件解消・7件部分解消・新規20件浮上（全て許容範囲）
- critical 3件（B-NG-1, O-NG-1, O-NG-2）全解消
- 全軸平均: 6.83 → 7.67（+0.84改善）

---

## スコアマトリクス（最終 iter2）

| ロール | 正確性 | 設計品質 | セキュリティ | 保守性 | 平均 |
|--------|--------|---------|------------|--------|------|
| フロントエンド開発者 | 7 | 8 | 8 | 7 | 7.50 |
| バックエンド開発者（ECS） | 7 | 7 | 8 | 7 | 7.25 |
| インフラ（配信/ビルド） | 8 | 8 | 8 | 8 | 8.00 |
| セキュリティ | 8 | 8 | 7 | 8 | 7.75 |
| QA | 8 | 8 | 8 | 7 | 7.75 |
| 運用 | 8 | 8 | 8 | 7 | 7.75 |
| **全体平均** | **7.7** | **7.8** | **7.8** | **7.3** | **7.67** |

### 閾値判定
- 閾値: 全軸 ≥ 7/10
- 未達項目: なし
- **判定: PASS**

### スコア推移

| 軸 | iter1 | iter2 | 変動 |
|----|-------|-------|------|
| 正確性 | 6.5 | 7.7 | +1.2 |
| 設計品質 | 6.5 | 7.8 | +1.3 |
| セキュリティ | 7.5 | 7.8 | +0.3 |
| 保守性 | 6.8 | 7.3 | +0.5 |
| **平均** | **6.83** | **7.67** | **+0.84** |

---

## 解消した主要指摘

### B-NG-4（BE・critical）→ FIX-1
**指摘内容**: Death完了→エンティティ削除の連動フローが未定義（XPドロップ・dispose・削除の順序）
**対応**: FR-04に「Death 完了→エンティティ削除シーケンス」節を新設。HealthSystem→AnimationSystem→CleanupSystem の4ステップを明記、XPドロップ→dispose→removeEntity の順序を(a)(b)(c)で確定、mixer.finished イベント駆動を採用（タイマー方式を明示的に禁止）。

### O-NG-1（運用・critical）→ FIX-2
**指摘内容**: v3 NFR-05「メモリ管理」（dispose必須、JSヒープ200MB上限、30分で10%増加率、WebGLコンテキストロスト復帰）がv5で完全欠落、前回からの退行
**対応**: NFR-07「メモリ管理」を新設。v3 NFR-05の全項目を継承し、Iter5固有として `mixer.stopAllAction()` / `uncacheRoot` / `uncacheAction` / 反転ハル dispose 責任を追加。

### O-NG-2（運用・critical）→ FIX-3
**指摘内容**: SkeletonUtils.clone 結果の dispose 責任分界（テンプレート vs. entity側）が未明文化
**対応**: FR-03に「dispose 責任分界」表を追加。9リソース（scene/animations/元material/clone後root/clone後geometry/clone後material/mixer/AnimationAction/反転ハル material）を所有者・dispose責任者別に分類。原則「AssetManager保持は不変・dispose禁止、entity clone は CleanupSystem責任」を明文化。

### F-NG-1 / B-NG-3 / I-NG-5 / O-NG-3 / O-NG-4（4ロール重複・important）→ FIX-4
**指摘内容**: ロード失敗時のリトライ/エラー伝播/タイムアウト/部分失敗の扱いが全て不明
**対応**: FR-01に「ロード失敗時のハンドリング」節を新設。Promise.all全件待機、各30秒/全体60秒タイムアウト、自動リトライなし・ユーザー操作再試行最大3回、部分起動禁止、汎用エラー表示を統合定義。

### F-NG-2 / Q-NG-4（FE+QA・important）→ FIX-5
**指摘内容**: bone名が "Hand.R" or "RightHand" と2候補併記のまま
**対応**: FR-05に「Construction 着手前の事前タスク」を追加。3モデル全数調査、`BoneAttachmentConfig` 型定義で bone名の差異を吸収、ハードコード禁止を明記。

### F-NG-3 / O-NG-8（FE+運用・important）→ FIX-6
**指摘内容**: SkinnedMesh反転ハルの skinning 追随成立性が未検証、失敗時のリリース判定も曖昧
**対応**: FR-06に「反転ハルの bind 手順」5ステップと「事前スパイク」節を追加。Construction初日にPoC実施、成立基準は Playwright 目視4点確認、不成立時は Outline OFF で本Iterリリース可とする退避策を明記。

### B-NG-2（BE・important）→ FIX-7
**指摘内容**: main→AssetManager→LoaderScreen→GameStartScreen→Game の起動フロー・EntityFactory DI制約が未定義
**対応**: 「起動シーケンス」節を新設。8ステップの時系列、EntityFactory DI制約（AssetManager完全ロード済みでなければ生成禁止）、GameStartScreenのIdleプレビュー責務を明記。

### B-NG-4（BE・important）→ FIX-8
**指摘内容**: HitReactタイマー・deathFlag の所有Component未定義
**対応**: `AnimationStateComponent` を新規Componentとして定義。hitReactTimer / deathFlag / currentClip を集約、書き込み責任（CombatSystem/HealthSystem）と読み取り責任（AnimationSystem）を分離。

### B-NG-6 / Q-NG-1（BE+QA・important）→ FIX-9
**指摘内容**: ProceduralMeshFactory削除の呼び出し元棚卸し・テスト削除/追加件数の一覧が欠如
**対応**: 「既存コード影響マップ」節を新設。呼び出し元マッピング表、削除対象テストと追加テスト4ファイル（AssetManager/AnimationSystem/AnimationStateComponent/EntityFactory.gltf）を列挙。

### I-NG-1/2/3 / Q-NG-2（インフラ+QA・important）→ FIX-10
**指摘内容**: 10秒要件の回線速度前提・gzip/brotli方針・Content-Type が全て未定義
**対応**: NFR-02「測定条件」「配信圧縮方針」節を追加。Chrome最新版/Mac M1/10Mbps以上/cold load、gzip/brotli必須、GitHub Pages/Netlify/CloudFront別の設定指針、`.gltf`=`model/gltf+json` を明記。

### S-NG-1 / I-NG-4 / S-NG-2 / O-NG-7（セキュリティ+インフラ+運用・important）→ FIX-11
**指摘内容**: CSP方針・キャッシュ戦略・アセット整合性・バージョニングが全て未定義
**対応**: NFR-08「CSP整合」（default-src/img-src data: blob:/connect-src/worker-src）、NFR-09「アセット配信キャッシュ・バージョニング」（`public/models/toon-shooter/v1/`、max-age=31536000 immutable、CIで HEAD 200検証、CHECKSUMS.txt将来対応）を新設。

### Q-NG関連（QA・important）→ FIX-12, FIX-13
**指摘内容**: テスト件数・mock戦略・fps測定条件・視覚回帰・観測性の詳細が未定義
**対応**: NFR-05大幅拡充（GLTFLoader mock fixture、material/skeleton `!==` assertion、pixel diff <5%、5項目目視チェックリスト、window error listener、heap差分ログ）。NFR-01拡充（30秒計測、移動平均60フレーム、自動降格ルール）。

---

## 残存する指摘（iter2新規・合格範囲内）

### important（10件）- Construction着手前に application-design v5 で吸収可能
- **F-NG-11**: mixer finished listener の removeEventListener 呼出タイミング
- **F-NG-12**: `event.action.getClip().name === 'Death'` 判定の明記
- **F-NG-14**: 反転ハルメッシュのスケール方法（bindMatrix vs. 頂点シェーダ膨張）
- **F-NG-16**: 複数 submesh の material clone（traverse で全 SkinnedMesh.material を clone）
- **B-NG-11**: CleanupSystem の priority 確定（AnimationSystem との実行順序）
- **B-NG-12**: MeshComponent の反転ハル mesh 参照（本体と反転ハルの両方を参照）
- **B-NG-13**: hitReactTimer の減算主体（AnimationSystem で dt 減算）
- **S-NG-9**: payload 2MB上限の妥当性（Character 2.3MB 超過の可能性）
- **O-NG-11**: 30分heap計測の責任者・CIでの自動化
- **O-NG-13**: 起動シーケンス Step 7 失敗時のロールバック手順

### medium/minor（20件超）
- Vite `.gltf` MIME 実測（I-NG-9）
- gzip/brotli 実効圧縮確認（I-NG-10）
- AssetPaths 定数一元化（I-NG-11）
- サブパス配信 BASE_URL 対応（I-NG-12）
- bundle size 予算 +100KB 目標（I-NG-15）
- index.html 静的ローダー雛形（I-NG-16、FOUC対策）
- CSP `script-src`/`style-src` 個別（S-NG-11）
- WebGLコンテキストロスト繰返しDoS（S-NG-12）
- source map 公開方針（O-NG-14）
- テスト件数の暫定値確定（Q2-NG-1）
- 統合テスト層の明示（Q2-NG-2）
- 視覚回帰ベースライン更新承認フロー（O-NG-12）
- 他

これらは **Construction 段階で application-design v5 または実装時の詳細補完で吸収可能**。要件定義フェーズとしては十分な粒度に到達。

---

## 設計判断ログ（AUTO-DECIDED）

本レビューサイクルで自動判断された主な設計選択:

1. **ロード失敗ハンドリング**: Promise.all全件待ち + 自動リトライなし + ユーザー操作最大3回（安全側、無限ループ回避）
2. **Death完了検知**: `mixer.finished` イベント採用（タイマー非採用、clip長がモデル依存のため）
3. **AnimationStateComponent新規**: MeshComponent拡張ではなく専用Componentとして切出（ECS単一責任原則）
4. **バージョン付きパス**: `public/models/toon-shooter/v1/` 採用（将来パック更新時のキャッシュbust、定数1箇所変更で切替）
5. **反転ハル失敗時**: Outline OFFでリリース可（B計画明記、Iter6でOutlinePass検討）
6. **アニメ間引き**: 本Iter未採用、採用時もHitReact/Death毎フレーム更新は必須
7. **CHECKSUMS.txt**: CI検証は将来、本Iterはgit固定で整合性担保
8. **Credits画面**: Iter6対応、本IterはLICENSE.txt同梱のみ
9. **payload 2MB上限**: MVPとして採用、実測超過時は Construction 段階で上限見直し
10. **統合テスト層**: NFR-05で包括言及、個別シナリオは application-design v5 で詳細化

---

## 対応推奨（Construction着手前）

Go/No-Go に影響しないが、Construction 初日〜初週で以下を application-design v5 に吸収すると実装手戻りが減る:

| 優先度 | 項目 | 対応タイミング |
|---|---|---|
| 1 | bone名3モデル調査 → BoneAttachmentConfig 確定 | Construction Day 1 |
| 2 | 反転ハル SkinnedMesh スパイク（FR-06 成立確認） | Construction Day 1 |
| 3 | payload上限の実測（Character 2.3MB の妥当性確認） | Construction Day 1 |
| 4 | grep 最終確認（ProceduralMeshFactory 呼び出し元棚卸） | Construction Day 1 |
| 5 | ECS System 実行順序確定（AnimationSystem / CleanupSystem priority） | application-design v5 |
| 6 | MeshComponent への反転ハル mesh 参照追加 | application-design v5 |
| 7 | AssetPaths 定数一元化（NFR-09拡張） | application-design v5 |
| 8 | テスト件数暫定値確定（削除N件/追加N件） | Construction 早期 |

---

## 最終レポート出力先
`aidlc-docs/reviews/inception/requirements-auto-review-v4.md`

## 中間ファイル
- iter1: `aidlc-docs/reviews/inception/requirements-auto-review-v4-iter1.md`
- iter1 fixes log: `aidlc-docs/reviews/inception/requirements-auto-review-v4-iter1-fixes.md`
- iter2: `aidlc-docs/reviews/inception/requirements-auto-review-v4-iter2.md`
