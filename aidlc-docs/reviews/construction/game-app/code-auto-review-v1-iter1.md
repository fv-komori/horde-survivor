# コードレビュー結果（自動レビュー v1 イテレーション1）

**レビュー対象**: src/ 配下全TypeScriptソースコード（49ファイル）+ テスト（5ファイル）
**レビュー日**: 2026-04-08
**レビュー方式**: 2つの専門家ロールによるクロスファンクショナルレビュー（独立エージェント並列実行）
**前回レビューからの変更点**: 初回レビュー

---

## 1. フロントエンド開発者（TypeScript）

### レビュー観点
- コード品質（単一責務、適切な粒度、型定義の適切さ）
- TypeScript活用（any回避、適切な型定義、型ガード、ジェネリクス）
- ECSパターンの適切な実装（コンポーネント分離、システム設計）
- Canvas API活用（描画最適化、パフォーマンス考慮）
- エラーハンドリング（例外処理、境界値処理、ユーザーフィードバック）
- コードの可読性・保守性（命名規則、関心の分離、DRY原則）
- テストカバレッジと品質
- 上流ドキュメントとの整合性

### OK項目

| # | 対象ファイル:行 | OK理由 |
|---|---------|--------|
| F-OK-1 | `src/config/gameConfig.ts`: 全体 | BR-CFG01に従い、すべてのバランスパラメータを`as const`で外部設定化されており、マジックナンバーの排除と型安全性が両立されている |
| F-OK-2 | `src/ecs/World.ts`: 全体 | ECSパターンの中核が適切に実装されている。遅延破棄キュー、ジェネリクス活用、優先度ベースのシステム実行順序制御が正しく動作する |
| F-OK-3 | `src/systems/CollisionSystem.ts`: L69-79 | 衝突判定でsqrt省略による距離二乗比較最適化を適切に実装。貫通弾の再ヒット防止もSetで管理されている |
| F-OK-4 | `src/systems/RenderSystem.ts`: L76-104 | レターボックスのスケーリング計算がbusiness-logic-modelに正確に準拠。devicePixelRatio対応、リサイズ時の再計算が正しい |
| F-OK-5 | `src/game/GameStateManager.ts`: L7-12 | BR-ST01の状態遷移制約がValidation Mapとして明示的に定義され、不正遷移をwarnログで拒否する設計が堅牢 |
| F-OK-6 | `src/managers/LevelUpManager.ts`: L153-238 | BR-G05の選択肢検証（ID照合、状態ガード、最大レベルチェック）が網羅的に実装されている |
| F-OK-7 | `src/systems/DefenseLineSystem.ts`: 全体 | BR-P03（無敵状態での防衛ライン処理）が正確に実装 |
| F-OK-8 | `src/input/InputHandler.ts`: L162-169 | BR-V01の入力バリデーション（NaN/Infinity対策、-1/0/+1正規化）が適切に実装されている |
| F-OK-9 | `tests/`: 全体 | World、CollisionSystem、DefenseLineSystem、WaveManager、LevelUpManagerの主要テストケースが存在 |

### NG項目

| # | 対象ファイル:行 | NG理由 | 提案 |
|---|---------|--------|------|
| F-NG-1 | `src/ecs/World.ts:57`: **queryメソッドの型安全性不足** | 引数型が`Function`になっており、任意の関数を渡せてしまう | **提案**: `(new (...args: any[]) => Component)[]`に制約する |
| F-NG-2 | `src/ecs/Entity.ts:8`: **componentsのMap型が`Function`で型安全でない** | キーが`Function`型でコンポーネントクラス以外が混入可能 | **提案**: `Map<new (...args: any[]) => Component, Component>`に変更 |
| F-NG-3 | `src/types/index.ts:5`と`src/ecs/Entity.ts:3`: **EntityIdの重複定義** | 同一型が2箇所で定義されており保守性低下 | **提案**: 一方を削除して統一する |
| F-NG-4 | `src/config/enemyConfig.ts:11`: **ENEMY_CONFIGのキー型が`string`** | `Record<string, EnemyTypeConfig>`で任意キーが許容される | **提案**: `Record<EnemyType, EnemyTypeConfig>`に変更 |
| F-NG-5 | `src/managers/SpawnManager.ts:35`: **EnemyTypeの安全でないキャスト** | 文字列を無検証でenumにキャスト | **提案**: enum値のバリデーションを追加 |
| F-NG-6 | `src/game/GameService.ts:89-91`: **as constオブジェクトのミューテーション** | `as const`宣言済みオブジェクトを型アサーションで強制的にミューテーション | **提案**: ランタイム設定オブジェクトを分離する |
| F-NG-7 | `src/game/GameService.ts:178-179`: **non-null assertionの暗黙使用** | 毎フレームnon-null assertionを使用 | **提案**: コンストラクタでctxを取得・保持する |
| F-NG-8 | `src/input/InputHandler.ts`: **イベントリスナーの解除漏れ** | 解除メソッドがなく、リスナーが蓄積する可能性 | **提案**: `destroy()`メソッドを追加する |
| F-NG-9 | `src/systems/RenderSystem.ts:106-108`: **ResizeObserver未使用** | 上流設計でResizeObserverが指定されているが未実装 | **提案**: ResizeObserverを使用する |
| F-NG-10 | `src/systems/WeaponSystem.ts:164-181`: **毎フレームの全敵走査** | 最大3000回/フレームの距離計算でボトルネックになりうる | **提案**: ターゲット情報キャッシュまたは空間分割導入 |
| F-NG-11 | `src/managers/LevelUpManager.ts:140`: **ソートによるシャッフルが不均一** | Fisher-Yatesではなく偏りが生じる | **提案**: Fisher-Yatesシャッフルを使用する |
| F-NG-12 | `src/game/GameService.ts:289-301`: **グローバルエラーハンドラーの上書きリスク** | `window.onerror = ...`で既存ハンドラーを上書き | **提案**: `window.addEventListener('error', ...)`を使用する |
| F-NG-13 | `src/systems/RenderSystem.ts:328-348`: **モバイルUIのボタン押下時フィードバック未実装** | 仕様では押下時に変化するが未使用 | **提案**: 押下状態に応じた描画を実装 |
| F-NG-14 | `src/config/waveConfig.ts:6`と`src/managers/WaveManager.ts:68-85`: **敵タイプの出現確率がstring型** | EnemyType enumが使用されていない | **提案**: `Record<EnemyType, number>`に統一 |
| F-NG-15 | テスト全体: **テストカバレッジ不足** | 多くのシステム・マネージャーにテストが存在しない | **提案**: WeaponSystem、XPCollectionSystem、CleanupSystem、EntityFactory等のテストを追加 |
| F-NG-16 | `src/managers/WaveManager.ts:89-98`: **ボスのスポーンタイミングの設計上の不整合** | bossTimerがelapsedTimeと独立して変化 | **提案**: 絶対時間管理に変更する |

---

## 4. セキュリティエンジニア

### レビュー観点
- インジェクション防止（XSS、コマンドインジェクション）
- 機密情報漏洩（ハードコードされたシークレット、ログへの機密情報出力）
- 入力バリデーション（ユーザー入力の検証と無害化）
- 依存脆弱性（既知の脆弱性を持つライブラリ）
- データ保護（暗号化実装、安全なデータ受け渡し）
- OWASP Top 10対応
- ゲーム固有のセキュリティ（チート防止、不正操作防止）

### OK項目

| # | 対象ファイル:行 | OK理由 |
|---|---------|--------|
| S-OK-1 | `src/input/InputHandler.ts`:164-169 | BR-V01に準拠し入力バリデーション実装 |
| S-OK-2 | `src/game/GameStateManager.ts`:7-12,27-33 | 状態遷移制約の強制 |
| S-OK-3 | `src/managers/LevelUpManager.ts`:160-169 | レベルアップ選択肢のID検証 |
| S-OK-4 | `src/systems/PlayerMovementSystem.ts`:34 | 画面境界制限 |
| S-OK-5 | `src/game/GameService.ts`:160-161 | デルタタイムクランプ |
| S-OK-6 | `vite.config.ts`:12-23 | CSPヘッダー設定 |
| S-OK-7 | `src/game/GameService.ts`:289-300 | グローバルエラーハンドラー |
| S-OK-8 | `src/config/gameConfig.ts`全体 | パラメータ外部設定化 |

### NG項目

| # | 対象ファイル:行 | NG理由 | 提案 |
|---|---------|--------|------|
| S-NG-1 | `index.html`:7 | **CSPメタタグがコメントアウト** — 本番ビルドでCSP未適用。NFR-07違反 | **提案**: CSPメタタグのコメントアウトを解除 |
| S-NG-2 | `src/game/GameService.ts`:319-323 | **エラーメッセージの直接表示** — `error.message`をCanvas上に表示 | **提案**: 汎用メッセージに変更、詳細はデバッグ時のみ |
| S-NG-3 | `src/game/GameService.ts`:88-91 | **デバッグモードのURLパラメータ切替** — 本番環境でも有効化可能 | **提案**: `import.meta.env.DEV`で開発環境のみ有効化 |
| S-NG-4 | `src/managers/LevelUpManager.ts`:140 | **選択肢シャッフルの偏り** — Fisher-Yatesでない | **提案**: Fisher-Yatesシャッフルを使用 |
| S-NG-5 | `src/managers/LevelUpManager.ts`:282 | **選択肢IDの予測可能性** — `Math.random()`使用 | **提案**: `crypto.getRandomValues()`使用 |
| S-NG-6 | `package.json`全体 | **npm auditの未設定** — NFR-07違反 | **提案**: auditスクリプト追加 |
| S-NG-7 | `src/game/GameService.ts`:304-305,319-323 | **エラー画面でのスタック情報** — 開発者ツールで漏洩 | **提案**: 本番ではconsole.error出力を抑制 |
| S-NG-8 | `src/game/GameService.ts`全体 | **クライアントサイドの改ざん防止なし** | **提案**: 設定値のObject.freeze等を検討 |

---

## スコアマトリクス（イテレーション 1）

| ロール | 正確性 | 設計品質 | セキュリティ | 保守性 | 平均 |
|--------|--------|---------|------------|--------|------|
| フロントエンド開発者 | 7/10 | 7/10 | 7/10 | 6/10 | 6.75 |
| セキュリティエンジニア | 7/10 | 7/10 | 6/10 | 7/10 | 6.75 |
| **全体平均** | **7.0** | **7.0** | **6.5** | **6.5** | **6.75** |

### 閾値判定
- 閾値: 全軸 ≥ 7/10
- 未達項目: フロントエンド/保守性 = 6, セキュリティ/セキュリティ = 6
- 判定: **FAIL**
