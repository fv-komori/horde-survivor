# アプリケーション設計レビュー結果（自動レビュー v2）

**レビュー対象**: `aidlc-docs/inception/application-design/` 配下4ファイル
**レビュー日**: 2026-04-09
**レビュー方式**: 6つの専門家ロールによる自動スコアリングレビュー

---

## 判定: PASS

- イテレーション回数: 2回
- 指摘総数: 28件 / 解決済: 8件 / 未解決: 20件（important 3件, medium 11件, minor 6件）

---

## スコアマトリクス（最終）

| ロール | 正確性 | 設計品質 | セキュリティ | 保守性 | 平均 |
|--------|--------|---------|------------|--------|------|
| アーキテクト (A) | 7 | 7 | 8 | 7 | 7.25 |
| FE開発者 (F) | 7 | 7 | 8 | 8 | 7.50 |
| BE開発者 (B) | 7 | 8 | 8 | 8 | 7.75 |
| インフラ (I) | 8 | 7 | 8 | 8 | 7.75 |
| セキュリティ (S) | 7 | 7 | 7 | 7 | 7.00 |
| 運用 (O) | 8 | 7 | 8 | 8 | 7.75 |
| **全体平均** | **7.33** | **7.17** | **7.83** | **7.67** | **7.50** |

---

## 解決済みの指摘

### FIX-1: I-NG-4 / O-NG-1（インフラ・運用・important）— AUTO-DECIDED
**指摘内容**: NFR-03でJSON外部化が要件なのに、設計上はconfig/*.tsファイルのみ
**対応内容**: config/にJSON+TSローダー二層構成を設計。JSONファイル5種+TSローダー5種
**対象**: component-dependency.md モジュール構成

### FIX-2: A-NG-3 / F-NG-3 / B-NG-1（3ロール・medium）— AUTO-DECIDED
**指摘内容**: NFR-01のアイテム同時表示上限50個が未設計
**対応内容**: ItemDropManagerにMAX_ITEMS=50と上限チェック、getItemCount()メソッドを追加
**対象**: components.md M-04, component-methods.md M-04

### FIX-3: A-NG-1（アーキテクト・important）— AUTO-DECIDED
**指摘内容**: CollisionSystemがItemDropManager/AllyConversionSystemに直接依存し責務肥大
**対応内容**: 撃破キュー（defeatedEnemies）を介した間接通知パターンに変更
**対象**: components.md S-06, component-methods.md S-06

### FIX-4: A-NG-4（アーキテクト・important）— AUTO-DECIDED
**指摘内容**: ScoreServiceへのkill通知経路が依存関係テーブルに未記載
**対応内容**: CollisionSystem外部依存にScoreServiceを追加、データフロー図にも反映
**対象**: component-dependency.md

### FIX-5: O-NG-4（運用・medium）— AUTO-DECIDED
**指摘内容**: ログ出力設計が存在しない
**対応内容**: services.mdにログ出力設計セクション追加（4レベル、Loggerクラス、出力対象定義）
**対象**: services.md

### FIX-6: F-NG-1（FE・important）— AUTO-DECIDED
**指摘内容**: 弾丸200×敵300のO(n×m)衝突判定で60FPS維持困難
**対応内容**: CollisionSystemに空間ハッシュグリッド（SpatialHashGrid）設計を追加
**対象**: components.md S-06, component-methods.md S-06

### FIX-7: F-NG-2（FE・medium）— AUTO-DECIDED
**指摘内容**: ヒットカウント被弾時の赤点滅アニメーションが未設計
**対応内容**: HitCountComponentにflashTimerフィールドを追加（命中時0.1秒、毎フレーム減算）
**対象**: components.md C-11

### FIX-8: B-NG-2（BE・important）— AUTO-DECIDED
**指摘内容**: 貫通弾のヒット後存続ロジックと重複ヒット防止が未設計
**対応内容**: BulletComponentにhitEntities: Set追加、CollisionSystemに貫通弾分岐ロジック追加
**対象**: components.md C-08, component-methods.md S-06

---

## 未解決の指摘（設計フェーズ以降で対応可能）

| NG-ID | ロール | 重大度 | 内容 |
|-------|--------|--------|------|
| A-NG-2 | Architect | medium | WaveManager↔SpawnManager双方向依存 |
| A-NG-5 | Architect | minor | 武器切替時の仲間武器への非影響が暗黙的 |
| F-NG-4 | FE | medium | UIManagerとRenderSystemのHUD描画責務重複 |
| F-NG-5 | FE | medium | ビットマップフォントのアセット生成方法が未設計 |
| I-NG-1(v2) | Infra | minor | CSPにobject-src追加の根拠コメント不足 |
| I-NG-2(v2) | Infra | medium | アセットキャッシュ戦略・ビルドハッシュ未設計 |
| I-NG-3(v2) | Infra | minor | npm audit失敗時のPRブロック未記載 |
| I-NG-4(v2) | Infra | important | モバイル30FPS向け描画品質調整方針なし |
| S-NG-1 | Security | medium | CSPのunsafe-inline残存 |
| S-NG-2 | Security | minor | Math.random()と将来のランキング対応 |
| S-NG-3 | Security | medium | 画面境界チェックの具体範囲未定義 |
| S-NG-4 | Security | medium | 状態遷移の不正遷移防止ガードなし |
| O-NG-1(v2) | Ops | medium | 上限到達の予兆警告閾値未定義 |
| O-NG-2(v2) | Ops | important | JSONバリデーション失敗時のフォールバック未設計 |
| O-NG-3(v2) | Ops | medium | 不正状態遷移の防止ロジック未設計 |
| O-NG-4(v2) | Ops | minor | パフォーマンス低下検知の具体閾値未定義 |
