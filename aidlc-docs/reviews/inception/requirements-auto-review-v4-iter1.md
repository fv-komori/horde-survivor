# 要件定義自動レビュー 中間（v4 iter1）

**レビュー対象**: aidlc-docs/inception/requirements/requirements-v5.md, questions-summary-v5.md
**レビュー日**: 2026-04-17
**レビュー方式**: 6専門家ロール並列独立レビュー（iter1）

## スコアマトリクス（iter1）

| ロール | 正確性 | 設計品質 | セキュリティ | 保守性 | 平均 |
|---|---|---|---|---|---|
| フロントエンド開発者 | 7 | 7 | 7 | 7 | 7.00 |
| バックエンド開発者（ECS） | 6 | 6 | 8 | 6 | 6.50 |
| インフラ（配信/ビルド） | 6 | 6 | 7 | 7 | 6.50 |
| セキュリティ | 7 | 7 | 7 | 7 | 7.00 |
| QA | 7 | 7 | 8 | 7 | 7.25 |
| 運用 | 6 | 6 | 8 | 7 | 6.75 |
| **全体平均** | **6.5** | **6.5** | **7.5** | **6.8** | **6.83** |

### 閾値判定
- 閾値: 全軸 ≥ 7/10
- **判定: FAIL**
- 未達項目:
  - BE: 正確性=6 / 設計品質=6 / 保守性=6
  - Infra: 正確性=6 / 設計品質=6
  - Ops: 正確性=6 / 設計品質=6
  - （他ロールも一律7でギリギリ、修正でバッファを作る必要あり）

## critical / important NG 一覧（要修正）

### critical（スコア上限6を引き起こす）
- **B-NG-1** (BE): Death完了→エンティティ削除の連動フロー未定義。既存の撃破処理（XPドロップ・mesh dispose・entity削除）との順序が決まっていない
- **O-NG-1** (Ops): v3 NFR-05「メモリ管理」(dispose必須/JSヒープ200MB上限/増加率10%以内/WebGLコンテキストロスト復帰)がv5で**完全欠落**。前回O-NG-3からの退行
- **O-NG-2** (Ops): SkeletonUtils.clone 結果の dispose 責任分界（テンプレート vs. entity clone）が未明文化

### important
- **F-NG-1** / **B-NG-3** / **I-NG-5** / **O-NG-4**: ロード失敗時のリトライ/エラー伝播設計（重複指摘、要統合）
- **F-NG-2** / **Q-NG-4**: bone名未確定（事前調査タスクで確定させる必要）
- **F-NG-3**: SkinnedMesh反転ハル成立性の事前スパイク要件未記載
- **B-NG-2**: ゲーム起動シーケンス（main→AssetManager→LoaderScreen→GameStartScreen→Game）の明示
- **B-NG-4**: HitReactタイマー所有Component未定義（AnimationStateComponent新規 or MeshComponent拡張）
- **B-NG-5**: SkinnedMesh + 反転ハルの同一スケルトンbind手順
- **B-NG-6**: プロシージャル削除の既存Systems/テスト影響棚卸し表
- **I-NG-1**: 10秒要件の回線速度前提未定義
- **I-NG-2**: 配信圧縮（gzip/brotli）方針未定義
- **I-NG-4**: HTTPキャッシュ戦略・バージョニング未定義
- **S-NG-1**: CSP方針（`img-src data: blob:` 等）との整合
- **S-NG-2**: アセット整合性検証（SHA-256 checksum）
- **Q-NG-1**: 既存86テスト中の破棄/追加件数未明記
- **Q-NG-2** / **Q-NG-3** / **O-NG-5**: ロード時間・fps の測定条件未定義
- **Q-NG-6**: Death完了判定契機（mixer finished event 等）未定義
- **Q-NG-11**: GLTFLoader mock戦略未定義
- **O-NG-3**: ローダー画面のタイムアウト要件なし
- **O-NG-6**: 退行検知手段（視覚ベースライン・メモリスナップ）の定量化

## medium / minor NG（参考）
F-NG-4〜10, B-NG-7〜10, I-NG-3/6/7/8, S-NG-3〜8, Q-NG-5/7/8/9/10/12/13, O-NG-7〜10

## 各ロール詳細

（iter1では割愛、最終レポート v4.md で統合）

## 次のアクション

FAIL + iter1のため **Step 8 自動修正エージェント起動** → iter2 へ。

修正優先度:
1. critical 3件（B-NG-1, O-NG-1, O-NG-2）の解消 — メモリ管理NFR復活 + Death/dispose シーケンス定義
2. important 重複指摘の統合対応（ロード失敗、起動シーケンス、bone名事前調査、測定条件、キャッシュ戦略、CSP/checksum、テスト件数）
3. medium 指摘は重要度別に自動設計判断（AUTO-DECIDED）で埋める
