# Functional Design 自動レビュー結果 — Iteration 2 (v2)

**レビュー対象**: aidlc-docs/construction/game-app/functional-design/ (domain-entities.md, business-rules.md, business-logic-model.md)
**レビュー日**: 2026-04-09
**レビュー方式**: 6ロール自動レビュー+スコアリング（最大3イテレーション）

---

## 判定: PASS

- イテレーション回数: 2回
- 指摘総数: 28件 / 解決済: 14件 / 未解決: 14件（全てmedium/minor）

---

## スコアマトリクス

### イテレーション 1 → 2 のスコア推移

| ロール | 正確性 | 設計品質 | セキュリティ | 保守性 |
|--------|--------|---------|------------|--------|
| アーキテクト (A) | 5→**8** | 7→**9** | 7→8 | 7→8 |
| フロントエンド (F) | 6→**7** | 7→7 | 8→8 | 7→8 |
| バックエンド (B) | 6→**8** | 7→8 | 8→9 | 7→8 |
| インフラ (I) | 8→8 | 7→8 | 8→9 | 8→8 |
| セキュリティ (S) | 8→9 | 8→8 | 7→8 | 8→8 |
| 運用 (O) | 8→8 | 8→8 | 8→9 | 7→8 |
| **全体平均** | 6.83→**8.00** | 7.33→**8.00** | 7.67→**8.50** | 7.33→**8.00** |

---

## 解決済みの指摘

### A-NG-2 / F-NG-3 / B-NG-3（A/F/B・critical）— 修正済
**指摘内容**: 仲間のfireRateBonus=100時に発射間隔が `0.15 × (1-100/100) = 0` になる計算式の矛盾
**対応内容**: 計算式を `interval = baseInterval / (1 + fireRateBonus/100)` に変更。BR-AL03, BR-AL04, business-logic-model 4.2節, 9.2節の4箇所を修正。最大強化時 `0.15 / 2 = 0.075秒` で正しく2倍速
**対象**: business-rules.md, business-logic-model.md

### A-NG-6 / B-NG-2 / F-NG-6（A/F/B・important）— 修正済
**指摘内容**: 撃破キュー消費タイミングが未定義。CollisionSystem→AllyConversionSystemの通知方式が不整合
**対応内容**: メインループにステップ6b「撃破キュー消費」を追加。アイテムドロップ→仲間化→スコア加算→敵破棄→キュークリアの順序を明確化
**対象**: business-logic-model.md

### F-NG-1（F・important）— 修正済
**指摘内容**: Canvas描画のZオーダー（描画順序）が未定義
**対応内容**: business-logic-model 15.0節に描画レイヤー順序（背景→アイテム→敵→仲間→プレイヤー→弾丸→エフェクト→HUD）の8段階テーブルを追加
**対象**: business-logic-model.md

### F-NG-5（F・important）— 修正済
**指摘内容**: devicePixelRatio（DPR）が考慮されておらず、Retinaでぼやける
**対応内容**: business-logic-model 14.1.1節にDPR対応（canvas.width = clientWidth×dpr, ctx.scale(dpr,dpr)）を追加
**対象**: business-logic-model.md

### I-NG-2（I・important）— 修正済
**指摘内容**: 描画オブジェクト800個の内訳整合性が未検証
**対応内容**: BR-S03テーブル直下に内訳目安（敵300+ヒットカウント300+弾丸200+アイテム50+エフェクト50+プレイヤー1+仲間10+HUD20）を追記
**対象**: business-rules.md

### I-NG-3（I・important）— 修正済
**指摘内容**: ウェーブ4+のスポーンレート（秒間33体）のモバイルFPS持続可能性が不透明
**対応内容**: business-logic-model 8.6節にアダプティブ戦略を新設。エンティティ上限・描画上限・画面外省略・空間ハッシュの4段階防御を明記
**対象**: business-logic-model.md

### O-NG-3 / B-NG-6（O/B・important/medium）— 修正済
**指摘内容**: 設定ファイルバリデーション失敗時のフォールバック挙動が未定義
**対応内容**: business-logic-model 12.3節にフォールバック戦略（個別パラメータ違反→デフォルト値+WARN、パースエラー→全デフォルト+ERROR）と値域チェック例を追記
**対象**: business-logic-model.md

### A-NG-1（A・medium）— 修正済
**指摘内容**: 仲間化成功時にアイテムドロップも同時発生するかが未定義
**対応内容**: 撃破キュー消費フローに「仲間化判定とアイテムドロップ判定は独立して両方実行される」旨を注記
**対象**: business-logic-model.md

### A-NG-4（A・medium）— 修正済
**指摘内容**: SPREAD武器の弾数「3〜5発」が曖昧
**対応内容**: BR-W03テーブルとdomain-entities WeaponTypeを「3」に統一
**対象**: business-rules.md, domain-entities.md

### A-NG-5（A・medium）— 修正済
**指摘内容**: アイテム上限チェックでボスの100%ドロップ保証が無効化される
**対応内容**: determineDropsのアイテム上限チェックにBOSS例外条件を追加
**対象**: business-logic-model.md

### B-NG-5（B・medium）— 修正済
**指摘内容**: Allyのライフサイクルが未定義
**対応内容**: domain-entities E-05とBR-AL03に「ゲームオーバーまで存続し、プレイ中の離脱・死亡は発生しない」を追記
**対象**: domain-entities.md, business-rules.md

---

## 未解決の指摘（全てmedium/minor — PASS判定に影響なし）

### イテレーション2 新規指摘（medium）
- **A-NG-1/F-NG-2/B-NG-1**: メインループのステップ11が6bと重複（仲間化判定の二重記載）
- **A-NG-3**: 武器アイテムでFORWARDに戻れない仕様の明示性不足
- **F-NG-1**: 描画コンテキスト初期化でDPRスケール毎フレーム消失の可能性
- **F-NG-3**: 仲間スプライト重なり時の描画仕様未定義
- **F-NG-4**: ビットマップフォントの生成・管理仕様不足
- **I-NG-1**: 描画オブジェクト理論最大値931が800を超過
- **I-NG-2**: 仲間10体の弾丸生成負荷の定量分析不足
- **B-NG-4**: ウェーブ4開始時のスポーン間隔の初期値未明示
- **O-NG-1**: デバッグモードの有効化手段未定義
- **O-NG-3**: ゲームリセット時のクリーンアップ対象不完全

### イテレーション1からの継続（minor）
- **S-NG-1**: CSP設計がfunctional-designに未反映
- **S-NG-2**: 乱数方針（Math.random()で十分）の明記不足
- **S-NG-3**: hitEntitiesセットの無制限成長に関する設計判断未記載
- **I-NG-3**: JSON設定ファイルのキャッシュ戦略未定義
