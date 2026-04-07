# アプリケーション設計レビュー v1 - イテレーション2

**レビュー対象**: アプリケーション設計書（components.md, component-methods.md, services.md, component-dependency.md）
**上流ドキュメント**: requirements.md
**レビュー日**: 2026-04-07
**レビュー種別**: 再レビュー（イテレーション2）
**前回レビュー**: application-design-review-v1.md（ロール: アーキテクト A / フロントエンド F）
**今回ロール**: バックエンド開発者（B） / インフラエンジニア（I） / セキュリティエンジニア（S） / 運用エンジニア（O）

### イテレーション1からの主要修正確認

| 前回指摘 | 修正状況 |
|---------|---------|
| A-NG-1: 敵HP管理先未定義 (critical) | **修正済み** — C-04 HealthComponentの用途が「プレイヤー、敵」に拡張。C-07 EnemyComponentにも「HP関連はHealthComponentに分離」と明記 |
| A-NG-2: 複数武器管理未定義 (critical) | **修正済み** — C-13 WeaponInventoryComponent新設（weaponSlots最大3、activeWeaponCount）。WeaponSystemもInventory対応に更新 |
| A-NG-3: エラーハンドリング未設計 (important) | **修正済み** — services.mdにエラーハンドリング設計セクション追加（グローバルハンドラー、try-catch、エラー画面、アセットフォールバック） |
| A-NG-6: 敵数/弾丸数上限管理未設計 (important) | **修正済み** — SpawnManagerに敵数上限200体、WeaponSystemに弾丸上限100発の管理を追加 |
| F-NG-1: モバイルUI操作設計不足 (important) | **部分修正** — InputSystemにモバイルタッチUI設計セクション追加（44x44ptタッチ領域、スワイプ、長押し）。ただしInputHandler.tsのメソッド定義は依然欠落 |
| F-NG-2: パフォーマンス最適化未設計 (important) | **修正済み** — RenderSystemにカリング設計と同時描画上限500個を追加 |
| F-NG-3: deltaTime上限未設計 (medium) | **修正済み** — services.mdにdeltaTimeクランプ設計追加（上限100ms、0以下スキップ） |
| F-NG-7: Canvas初期化未設計 (important) | **修正済み** — RenderSystemにCanvas初期化・スケーリング設計を追加（devicePixelRatio、レターボックス、ResizeObserver） |

---

## 3. バックエンド開発者（B）

### レビュー観点
- データモデル整合性・型安全性
- ビジネスロジックの正確性・網羅性
- ECSクエリ効率とデータアクセスパターン
- エラーハンドリング・バリデーション
- テスタビリティ

### OK項目

| # | 対象設計 | OK理由 |
|---|---------|--------|
| B-OK-1 | HealthComponent共有設計: プレイヤー・敵の両方に適用 | 前回criticalだった敵HP管理先が解決。CollisionSystemのHealthComponent(敵)書き込みとデータモデルが整合し、HealthSystemでのHP0判定→破棄フローが統一的に処理可能 |
| B-OK-2 | WeaponInventoryComponent新設: 複数武器管理の型定義 | weaponSlots: WeaponComponent[]（最大3）とactiveWeaponCountの構造は、FR-03の武器同時装備上限3種を正確に表現。WeaponSystemのInventory対応記述も適切 |
| B-OK-3 | SpawnManager敵数上限管理: MAX_ENEMIES=200、上限時スキップ | NFR-01の同時敵数上限を静的定数で管理し、World.query(EnemyComponent)でカウントする方式は実装が明快。spawnEnemyのnull返却による抑制も適切な設計 |
| B-OK-4 | WeaponSystem弾丸上限管理: getBulletCount()による上限100発チェック | 弾丸生成前にカウントチェックを行う設計で、NFR-01の弾丸上限を遵守。スキップ時の挙動（単に生成しない）も副作用なく安全 |
| B-OK-5 | エラーハンドリング階層設計: グローバル→ゲームループ→個別アセット | NFR-08の3段階のエラーハンドリング要件を忠実に反映。致命的エラー時のstop()→エラー画面→リロードのフローが明確 |
| B-OK-6 | 入力バリデーション設計: -1/0/+1正規化、NaN/Infinity除外 | NFR-07の入力バリデーション要件に対応し、validateInput()メソッドとして独立。フレームあたり最大移動量制限も設計に含まれている |
| B-OK-7 | deltaTimeクランプ設計: Math.min(rawDt, 100)と0以下スキップ | タブ復帰時の物理破綻防止とタイムスタンプ異常値対策の両方をカバー。上限100ms（10FPS相当）は妥当な閾値 |

### NG項目

| # | 対象設計 | NG理由 | 提案 |
|---|---------|--------|------|
| B-NG-1 | HealthSystem処理対象: **HealthComponent + PlayerComponent限定** | S-08 HealthSystemの処理対象が「HealthComponent + PlayerComponent」のままになっている。C-04でHealthComponentを敵にも適用する修正がされたが、HealthSystemが敵のHP0判定（撃破→XPドロップ生成）を処理しない設計になっている。現状CollisionSystemが敵HP減少とHP0判定の両方を担っているように読めるが、責務が不明確 | **提案**: HealthSystemの処理対象を「HealthComponent」に拡張し、プレイヤー固有処理（無敵時間等）はPlayerComponentの有無で分岐するか、CollisionSystemが敵HP0判定と破棄まで一貫して担当する旨を明記する <!-- severity: important --> |
| B-NG-2 | LevelUpManager.applyChoice: **HealthComponent更新パスが依存関係マトリクスに未反映** | FR-03の「レベルアップ時HP10%回復」「全強化取得済み時HP30%回復」の要件に対して、LevelUpManagerからHealthComponentへの書き込みパスが依存関係マトリクスに記載されていない。component-dependency.mdではLevelUpManagerの外部依存先が明示されていない | **提案**: LevelUpManagerの依存先にWorld（HealthComponent書き込み、PassiveSkillsComponent書き込み）を追加し、applyChoice内でのHP回復・パッシブスキル適用のデータフローを依存関係マトリクスに反映する <!-- severity: medium --> |
| B-NG-3 | CollisionSystem依存関係: **PositionComponent読み取りが依存マトリクスに未記載** | S-06 CollisionSystemは円形衝突判定に各エンティティのPositionComponentを使用するが、依存関係マトリクスの「読み取るコンポーネント」にPositionComponentが記載されていない。実際にはBulletComponent, EnemyComponent, ColliderComponent に加えてPositionComponentが必須 | **提案**: CollisionSystemの読み取りコンポーネントにPositionComponentを追加する <!-- severity: medium --> |
| B-NG-4 | EntityFactory.createBullet: **WeaponComponentのレベルに基づくダメージ計算の所在が不明** | createBulletはdamageを引数で受け取るが、WeaponComponentのレベルに応じたダメージ計算（FR-03: ダメージ増加）をどこで行うかが設計上不明。WeaponSystemが計算してからEntityFactoryに渡すと推測されるが明記されていない | **提案**: WeaponSystem内でweaponLevel→ダメージ倍率の計算を行いcreateBulletに渡す旨を、WeaponSystemのメソッドコメントまたはデータフローに明記する <!-- severity: medium --> |
| B-NG-5 | World.query: **パフォーマンス特性の設計方針が未記述** | SpawnManagerがWorld.query(EnemyComponent)で毎フレーム敵数を取得し、WeaponSystemがBulletComponentをクエリし、CollisionSystemが弾丸×敵の全組み合わせをチェックする。高頻度クエリのパフォーマンス方針（ビットマスク型アーキタイプ管理 vs 素朴なMap走査 等）が未記述 | **提案**: World.queryの実装方針（例: コンポーネント型ごとのインデックスを保持し O(1) でエンティティセットを取得する等）をECSコア設計に追記する。CONSTRUCTION PHASEへの先送りでも可だが、方針の明示を推奨 <!-- severity: medium --> |

### スコア評価

| 観点 | スコア (1-10) | 根拠 |
|------|-------------|------|
| 正確性 | 7 | 前回criticalの敵HP管理・複数武器管理が解決（B-OK-1, B-OK-2）。ただしB-NG-1のHealthSystem処理対象の不整合、B-NG-3の依存マトリクス記載漏れが残存し、実装時に混乱を招く可能性あり |
| 設計品質 | 7 | エラーハンドリング階層（B-OK-5）、入力バリデーション（B-OK-6）、上限管理（B-OK-3, B-OK-4）が適切に追加された。B-NG-4のダメージ計算所在不明、B-NG-5のクエリ性能方針欠如が品質を若干下げる |
| セキュリティ | 7 | 入力バリデーション（B-OK-6）、deltaTimeクランプ（B-OK-7）、グローバルエラーハンドラー（B-OK-5）でNFR-07/NFR-08を概ねカバー。ゲーム状態整合性チェック（NFR-07「不正な強化選択を防止」）の具体設計はまだ薄いが、設計フェーズとしては許容範囲 |
| 保守性 | 7 | 静的定数による上限管理（MAX_ENEMIES等）、configファイル分離、ECSの拡張性は良好。B-NG-2の依存関係マトリクス未反映は保守時の影響分析を困難にする |

---

## 4. インフラエンジニア（I）

### レビュー観点
- CI/CDパイプライン設計の妥当性
- デプロイ・ホスティング設計
- パフォーマンス監視・運用設計
- セキュリティ対策（CSP、依存管理）
- ビルド・テスト戦略

### OK項目

| # | 対象設計 | OK理由 |
|---|---------|--------|
| I-OK-1 | CI/CDパイプライン構成: Push to main / Pull Request で分岐 | NFR-09の要件に準拠。mainへのpush時はデプロイまで実行、PR時はデプロイ不要でセキュリティ監査（npm audit）を含む構成は適切 |
| I-OK-2 | ビルドツール選定: Vite + TypeScript | 静的サイトの高速ビルドに最適。TypeScript型チェックがビルドステージに含まれており、型安全性がCIで担保される |
| I-OK-3 | セキュリティ監査: npm audit --audit-level=high | NFR-07の依存ライブラリ管理要件に準拠。high以上をCIでブロックする方針は過度な誤検知を避けつつリスクを管理する妥当なレベル設定 |
| I-OK-4 | デプロイ対象: 静的サイトホスティング（GitHub Pages / Cloudflare Pages） | Canvas 2Dゲームの性質上、サーバーサイド処理が不要であり、静的サイトホスティングは最もシンプルかつ低コストな選択。NFR-06の要件に合致 |
| I-OK-5 | テスト戦略: Jest + 主要ゲームロジックカバー対象明示 | CollisionSystem、LevelUpManager、WaveManager等をテスト対象として明示しており、ゲームのコアロジックに絞った効率的なテスト戦略 |
| I-OK-6 | デバッグオーバーレイ設計: URLパラメータ/configフラグ切替、本番デフォルト無効 | 開発・ステージング環境でのパフォーマンス計測を可能にしつつ、本番ビルドではデフォルト無効とする運用設計が適切。NFR-09のFPSカウンター要件に合致 |

### NG項目

| # | 対象設計 | NG理由 | 提案 |
|---|---------|--------|------|
| I-NG-1 | CI/CDパイプライン: **デプロイ先の具体的な設定が未定義** | 「静的サイトホスティングにデプロイ」とあるが、GitHub Pages と Cloudflare Pages のどちらを使用するか、またはその選定基準が未記載。GitHub Actionsのデプロイステップ（actions/deploy-pages, wrangler等）が未設計のため、パイプラインが完結しない | **提案**: デプロイ先を1つに決定するか、両方の選択肢について具体的なActions設定方針を記述する。初期はGitHub Pagesが最もシンプル（リポジトリ設定のみでデプロイ可能）なので推奨 <!-- severity: important --> |
| I-NG-2 | CI/CDパイプライン: **テストカバレッジ閾値が未定義** | Jestによるユニットテストは設計されているが、カバレッジの目標値や最低閾値（CIブロック条件）が定義されていない。テストが形骸化するリスクがある | **提案**: カバレッジ閾値（例: ステートメントカバレッジ60%以上をCIブロック条件）を設定するか、CONSTRUCTION PHASEで決定する旨を明記する <!-- severity: medium --> |
| I-NG-3 | セキュリティ: **CSP（Content Security Policy）の設計が未反映** | NFR-07で「インラインスクリプト制限、外部リソース読み込み制限を設定」が要件だが、CSPヘッダーの具体的な設計（どのディレクティブを設定するか、ホスティング側での設定方法）が設計書に含まれていない | **提案**: CSPポリシーの方針（例: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:）を設計に追加する。GitHub PagesならHTMLのmetaタグ、Cloudflare Pagesなら_headers ファイルで設定する旨を明記 <!-- severity: important --> |
| I-NG-4 | ビルド設計: **本番ビルドの最適化設定が未記述** | NFR-07で「本番ビルド時にminify実施」が要件だが、Viteのビルド設定（minify, code splitting, asset hashing等）やバンドルサイズの目標値が設計に含まれていない | **提案**: vite.config.tsの本番ビルド方針（terserによるminify、チャンク分割戦略、アセットハッシュによるキャッシュバスティング）を設計に追記する。バンドルサイズの目標値（例: gzip後500KB以下）も設定を推奨 <!-- severity: medium --> |
| I-NG-5 | 運用: **デバッグオーバーレイのURLパラメータが本番環境でも有効** | デバッグオーバーレイの有効化が「URLパラメータ?debug=1」で可能な設計だが、本番環境でもURLパラメータを付与すればデバッグ情報が表示される。エンティティ数やゲーム状態等の内部情報が露出するセキュリティリスクがある | **提案**: 本番ビルドではデバッグオーバーレイコードをtree-shakingで除去するか、環境変数（import.meta.env.DEV）で分岐し本番では完全に無効化する設計に変更する <!-- severity: medium --> |

### スコア評価

| 観点 | スコア (1-10) | 根拠 |
|------|-------------|------|
| 正確性 | 7 | CI/CDパイプラインの基本構成（I-OK-1）はNFR-09に合致。ただしI-NG-1（デプロイ先未定義）によりパイプラインが完結せず、I-NG-3（CSP未設計）でNFR-07のセキュリティ要件が未反映 |
| 設計品質 | 7 | Vite + TypeScript（I-OK-2）、Jest（I-OK-5）の技術選定は適切。デバッグオーバーレイ（I-OK-6）も良い設計。I-NG-4（ビルド最適化未記述）とI-NG-5（デバッグ情報露出リスク）が品質を下げる |
| セキュリティ | 6 | npm audit（I-OK-3）は対応済みだが、I-NG-3（CSP未設計）とI-NG-5（本番デバッグ情報露出）の2点でNFR-07のセキュリティ要件を十分に満たしていない |
| 保守性 | 7 | CI/CDによる自動化（I-OK-1）、デバッグツール（I-OK-6）は運用保守性に貢献。I-NG-2（カバレッジ閾値未定義）はテスト品質の長期的な維持にリスクを残す |

---

## 5. セキュリティエンジニア（S）

### レビュー観点
- 入力バリデーション・サニタイズ
- ゲーム状態の整合性保護
- クライアントサイドの改ざん耐性
- エラーハンドリングによる情報漏洩防止
- 依存ライブラリのセキュリティ管理
- CSP・デプロイセキュリティ

### OK項目

| # | 対象設計 | OK理由 |
|---|---------|--------|
| S-OK-1 | InputSystem 入力バリデーション（S-01, NFR-07対応） | 移動方向を -1, 0, +1 に正規化し、NaN/Infinity等の不正値を無視して前回値を維持する設計が明記されている。フレームあたり最大移動量制限（maxSpeed x dt）も設計に含まれており、NFR-07の入力バリデーション要件を適切にカバー |
| S-OK-2 | deltaTimeクランプ設計（GameService, NFR-08対応） | `Math.min(rawDt, 100)`による上限クランプ、dt <= 0 のスキップが明記されている。タブ復帰時やフレームスパイクによるゲーム物理の異常動作を防止し、タイムスタンプ操作による不正な高速移動・スキップを抑制する設計として適切 |
| S-OK-3 | グローバルエラーハンドラー設計（GameService, NFR-08対応） | window.onerror / unhandledrejection の登録、致命的エラー時のゲームループ停止+エラー画面表示が設計されている。ゲームが不整合な状態で動作し続けることを防止するフェイルセーフ |
| S-OK-4 | CI/CD npm auditの組み込み（services.md, NFR-07対応） | PRおよびmainブランチへのpush時に`npm audit --audit-level=high`を実行する設計がCI/CDパイプラインに含まれている。NFR-07の「依存ライブラリ管理」要件に対応し、既知の高リスク脆弱性がリリース前に検出される |
| S-OK-5 | エンティティ上限管理（SpawnManager/WeaponSystem, NFR-01対応） | 同時敵数上限200体（SpawnManager.MAX_ENEMIES）、弾丸同時表示上限100発の設計が明記されている。意図的な大量エンティティ生成によるリソース枯渇を防止する設計として機能 |
| S-OK-6 | アセット読み込み失敗時のフォールバック（GameService, NFR-08対応） | 個別アセットのcatchでプレースホルダー（単色矩形）代替によりゲーム続行を試行する設計。アセット配信障害時にも完全なクラッシュを回避する耐障害性を確保 |
| S-OK-7 | デバッグオーバーレイのデフォルト無効化（GameService, NFR-09対応） | 本番ビルドでデフォルト無効、URLパラメータまたはconfigフラグで有効化する設計。デバッグ情報（エンティティ数、FPS等）が本番環境で不用意に露出しない基本方針 |

### NG項目

| # | 対象設計 | NG理由 | 提案 |
|---|---------|--------|------|
| S-NG-1 | services.md: **エラー画面に表示するエラー情報の範囲が未定義** | エラー画面で「エラーメッセージ」を表示する設計だが、Error.messageやstacktraceをそのまま表示するとシステム内部構造（ファイルパス、変数名等）が露出する可能性がある。クライアントサイドアプリケーションではDevToolsで確認可能だが、一般ユーザーへの不必要な情報露出は避けるべき | **提案**: エラー画面にはユーザーフレンドリーな定型メッセージ（例:「エラーが発生しました。リロードしてください」）のみ表示し、詳細エラーはconsole.errorに出力する設計方針を明記する <!-- severity: medium --> |
| S-NG-2 | services.md: **デバッグオーバーレイのURLパラメータ`?debug=1`が本番環境で有効化可能** | URLパラメータ`?debug=1`で有効化できる設計のため、本番環境でも誰でもデバッグ情報を閲覧可能。現在表示されるのはFPS、エンティティ数、ゲーム状態だが、将来的にデバッグ情報が拡張された場合にリスクが増大する | **提案**: 本番ビルド（production build）ではURLパラメータによるデバッグモード有効化を無効にする設計を明記する。例: `if (import.meta.env.DEV && urlParams.has('debug'))` のようにビルドモード判定を組み合わせ、本番ビルドではtree-shakingによりデバッグコード自体を除去する <!-- severity: medium --> |
| S-NG-3 | component-methods.md / services.md: **LevelUpManager.applyChoiceの選択データ整合性チェックが未設計** | NFR-07で「レベルアップ選択データはゲーム内部状態と照合し、不正な強化選択を防止」が明示的な要件だが、applyChoice(world, choice)のメソッド定義に入力検証ロジックの言及がない。DevToolsからの関数呼び出しで任意のUpgradeChoiceを適用できる可能性がある | **提案**: applyChoice内で、受け取ったchoiceがgenerateChoices()で生成された有効な選択肢リストに含まれるかを検証する設計を明記する。現在のgenerateChoices結果をインスタンス変数に保持し、applyChoice時に照合→無効な選択肢は無視するフローを追加する <!-- severity: important --> |
| S-NG-4 | services.md / components.md: **CSP（Content Security Policy）の設計が未反映** | NFR-07で「インラインスクリプト制限、外部リソース読み込み制限を設定」が要件として明記されているが、アプリケーション設計書のどこにもCSPの設定方針・ヘッダー構成が記載されていない。XSS等の攻撃に対する基本的な防御層が設計に含まれていない | **提案**: デプロイ設計またはservices.mdに、CSPヘッダーの基本方針を追加する。Canvas 2Dゲームの特性上、推奨ポリシー: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'`。ホスティングサービスでの設定方法（GitHub Pages: HTMLのmeta tag、Cloudflare Pages: _headersファイル）も併記する <!-- severity: important --> |
| S-NG-5 | component-methods.md: **GameStateManager.changeStateの遷移バリデーションが未設計** | changeState(newState)は任意のGameState値を受け付ける設計で、不正な状態遷移（例: TITLE→GAME_OVER、LEVEL_UP→TITLE）を防止する仕組みが設計されていない。DevToolsから直接呼び出した場合にゲームの整合性が崩れ、スコア改ざんやゲーム状態の不正操作に繋がる可能性がある | **提案**: changeState内で許可された遷移パス（FR-04で定義済み: TITLE→PLAYING、PLAYING→LEVEL_UP、LEVEL_UP→PLAYING、PLAYING→GAME_OVER、GAME_OVER→TITLE）のみを受け付けるバリデーションを設計に追加する。不正遷移はconsole.warnで記録し無視する <!-- severity: medium --> |

### スコア評価

| 観点 | スコア (1-10) | 根拠 |
|------|-------------|------|
| 正確性 | 7 | 入力バリデーション（S-OK-1）、deltaTimeクランプ（S-OK-2）、npm audit（S-OK-4）がNFR-07/NFR-08要件と正確に対応。ただしCSP設計（S-NG-4）とLevelUp選択検証（S-NG-3）がNFR-07の一部要件を未カバー |
| 設計品質 | 7 | エラーハンドリングの多層防御（グローバル+ゲームループ+アセット個別: S-OK-3, S-OK-6）は堅実な設計。デバッグモードの本番制御（S-NG-2）や状態遷移バリデーション（S-NG-5）の防御層が不足 |
| セキュリティ | 6 | イテレーション1から大幅改善。入力バリデーション・deltaTimeクランプ・エンティティ上限で主要な攻撃ベクトルを抑制。しかしCSP未設計（S-NG-4）、ゲーム状態整合性チェック不足（S-NG-3, S-NG-5）が残存。クライアントサイドゲームの性質上、完全な改ざん防止は困難だが、設計レベルで要件に定義された最低限の整合性保護は必要 |
| 保守性 | 7 | CI/CDでのnpm audit自動実行（S-OK-4）はセキュリティ保守性に貢献。デバッグモードの本番/開発切り替え方針（S-NG-2）が明確化されれば、将来のデバッグ機能拡張時にもセキュリティが担保される |

---

## 6. 運用エンジニア（O）

### レビュー観点
- デプロイ・ホスティング設計の運用性
- CI/CDパイプラインの完全性・運用効率
- 監視・ログ・可観測性
- 障害時のリカバリ設計
- パフォーマンス監視・計測
- 運用時の設定管理・環境分離

### OK項目

| # | 対象設計 | OK理由 |
|---|---------|--------|
| O-OK-1 | CI/CDパイプライン設計（services.md, NFR-09対応） | Lint→Build→Test→Deploy（mainブランチ時）、PR時はLint→Build→Test→npm auditの構成が明記されており、NFR-09の要件を適切にカバー。各ステージの役割と停止条件が明確 |
| O-OK-2 | エラーハンドリングの多層設計（GameService, NFR-08対応） | グローバルハンドラー（window.onerror/unhandledrejection）→ゲームループtry-catch→アセット個別catchの3層構造が設計されている。障害発生時に段階的に対応でき、致命的エラーではゲーム停止+エラー画面を表示するフェイルセーフ設計 |
| O-OK-3 | デバッグオーバーレイによるパフォーマンス計測（GameService, NFR-09対応） | FPSカウンター（直近60フレーム平均）、エンティティ数、敵数、弾丸数のリアルタイム表示が設計されている。開発時のパフォーマンスボトルネック特定に有用 |
| O-OK-4 | アセット読み込み失敗のフォールバック（GameService, NFR-08対応） | 個別アセット失敗時にプレースホルダーで代替しゲーム続行を試行する設計。CDN障害やネットワーク不安定時にもゲームが完全に起動不能にならない耐障害性を確保 |
| O-OK-5 | エンティティ上限管理による安定性確保（SpawnManager/WeaponSystem/RenderSystem） | 敵200体、弾丸100発、描画オブジェクト500個の上限が設計されており、低スペック端末やメモリ制約環境でもリソース枯渇を防止。上限到達時の挙動（スポーンスキップ、弾丸生成スキップ、低優先度描画スキップ）も明確 |
| O-OK-6 | deltaTimeクランプによる安定動作（GameService） | タブ復帰時の大きなdtを100msに制限し、ゲーム物理の破綻を防止。運用環境での予期しないフレームスパイクに対する堅牢性を確保 |

### NG項目

| # | 対象設計 | NG理由 | 提案 |
|---|---------|--------|------|
| O-NG-1 | services.md: **エラー発生時のログ出力・集約設計が未定義** | エラーハンドリング設計はゲーム停止+エラー画面表示までカバーしているが、エラー情報のログ出力先や形式が未定義。クライアントサイドアプリケーションにおいてもconsole.errorへの構造化ログ出力や、将来的な外部ログ集約（Sentry等）へのフック点の設計が欠落。障害発生率の把握や再現調査が困難 | **提案**: setupErrorHandlers()内でconsole.errorによる構造化ログ出力（タイムスタンプ、エラー種別、ゲーム状態、エンティティ数等のコンテキスト情報付き）を設計に追加する。将来的な外部ログサービス統合のためのフック点（onError callback）も設計しておく <!-- severity: important --> |
| O-NG-2 | services.md: **CI/CDパイプラインのキャッシュ・アーティファクト管理が未設計** | CI/CDパイプラインのステージ構成は定義されているが、node_modulesキャッシュ戦略、ビルドアーティファクトの保存・バージョニング、デプロイ成果物のロールバック手段が設計されていない。CI実行時間の増大やデプロイ障害時の復旧遅延に繋がる | **提案**: CI/CDパイプライン設計にnode_modulesキャッシュ（package-lock.jsonハッシュベース）、ビルドアーティファクトの保存期間、デプロイ失敗時のロールバック手順（前回デプロイへの切り戻し方針）を追加する <!-- severity: medium --> |
| O-NG-3 | services.md / component-dependency.md: **ビルド成果物のサイズ管理・最適化設計が未定義** | Viteによるビルドは設計されているが、バンドルサイズの目標値、コード分割（code splitting）方針、アセットの最適化（画像圧縮等）の設計がない。モバイル回線でのロード時間に直結し、NFR-02（モバイル対応）の実質的なユーザー体験に影響する | **提案**: ビルド設計にバンドルサイズ目標（例: gzip後500KB以下）、Viteのチャンク分割設定方針、アセット最適化方針を追加する。CI/CDでバンドルサイズチェック（サイズ上限超過時の警告）も検討する <!-- severity: medium --> |
| O-NG-4 | services.md: **デプロイ先の具体的設定・環境分離が未設計** | NFR-06で「GitHub Pages または Cloudflare Pages 推奨」とあるが、具体的なデプロイ先の選定、ステージング環境の有無、環境ごとの設定切り替え（デバッグモード、ベースパス等）が設計されていない。運用開始時に環境構築の手戻りが発生するリスク | **提案**: デプロイ先の選定基準と決定、環境変数による設定切り替え（import.meta.env）の方針、本番/ステージング環境の構成を明記する。Viteのbase設定やenvファイル管理方針も含める <!-- severity: medium --> |
| O-NG-5 | services.md: **ヘルスチェック・可用性監視の設計が欠落** | デプロイ後のアプリケーション可用性を確認する手段が設計されていない。静的サイトとはいえ、デプロイ成功後のページロード確認やアセット配信の正常性を検証する仕組みが運用上必要 | **提案**: デプロイ後の簡易ヘルスチェック（例: CIパイプライン最終ステージでデプロイURLへのHTTPリクエスト成功確認 + index.htmlの存在チェック）を追加する。ホスティングサービスのアナリティクス機能やUptime監視の活用も検討する <!-- severity: medium --> |

### スコア評価

| 観点 | スコア (1-10) | 根拠 |
|------|-------------|------|
| 正確性 | 7 | CI/CDパイプライン（O-OK-1）、エラーハンドリング（O-OK-2）がNFR-08/NFR-09の要件に対応。ただしログ出力設計（O-NG-1）の欠如でNFR-08のエラーハンドリング要件の運用面が不完全、デプロイ先の具体化（O-NG-4）でNFR-06の完全カバーに至っていない |
| 設計品質 | 6 | エラーハンドリングの3層構造（O-OK-2）とエンティティ上限管理（O-OK-5）は運用品質に貢献。しかしCI/CDの運用面（キャッシュ、ロールバック: O-NG-2）やバンドルサイズ管理（O-NG-3）の設計が不十分で、運用開始後に課題が顕在化するリスク |
| セキュリティ | 7 | npm auditのCI組み込み（O-OK-1経由）でサプライチェーンセキュリティに対応。エラー画面の情報露出制御はセキュリティエンジニア観点のS-NG-1と連動する課題だが、運用面では致命的ではない |
| 保守性 | 6 | デバッグオーバーレイ（O-OK-3）は開発時の保守性に貢献するが、本番運用のログ集約（O-NG-1）、環境分離（O-NG-4）、ロールバック手段（O-NG-2）の欠如が長期運用の保守性リスク。障害発生時の原因調査・復旧に時間がかかる構造 |

---

## 総括

### 前回指摘の修正状況
イテレーション1のcritical指摘2件（敵HP管理、複数武器管理）は適切に修正済み。important指摘についてもエラーハンドリング、上限管理、Canvas初期化、パフォーマンス最適化が追加され、設計の完成度が大幅に向上した。

### 今回の新規指摘一覧

#### Important（最大スコア7点）
- **B-NG-1**: HealthSystemの処理対象がPlayerComponent限定のまま。敵へのHealthComponent適用との不整合
- **I-NG-1**: CI/CDデプロイ先が未決定でパイプラインが完結しない
- **I-NG-3**: CSP設計が未反映（NFR-07要件）
- **S-NG-3**: LevelUpManager.applyChoiceの選択データ整合性チェックが未設計（NFR-07明示要件）
- **S-NG-4**: CSP設計が未反映（NFR-07明示要件）※I-NG-3と同一課題
- **O-NG-1**: エラーログ出力・集約設計の欠如

#### Medium（最大スコア8点）
- **B-NG-2**: LevelUpManagerからHealthComponent/PassiveSkillsComponentへの書き込みパスが依存関係マトリクスに未反映
- **B-NG-3**: CollisionSystemの依存マトリクスにPositionComponent読み取りが未記載
- **B-NG-4**: 武器レベル→ダメージ計算の責務所在が不明
- **B-NG-5**: World.queryのパフォーマンス方針が未記述
- **I-NG-2**: テストカバレッジ閾値が未定義
- **I-NG-4**: 本番ビルド最適化設定が未記述
- **I-NG-5**: デバッグオーバーレイが本番でもURL経由で有効化可能
- **S-NG-1**: エラー画面のエラー情報露出範囲未定義
- **S-NG-2**: デバッグオーバーレイの本番環境無効化が不完全 ※I-NG-5と同一課題
- **S-NG-5**: GameStateManager状態遷移バリデーション未設計
- **O-NG-2**: CI/CDキャッシュ・ロールバック未設計
- **O-NG-3**: バンドルサイズ管理未設計
- **O-NG-4**: デプロイ先・環境分離未設計
- **O-NG-5**: ヘルスチェック・可用性監視の欠落

### 次回イテレーションへの推奨
Important指摘（CSP設計、LevelUp選択検証、HealthSystem処理対象、デプロイ先決定、ログ設計）を優先的に修正し、Medium指摘はCONSTRUCTION PHASEでの対応でも許容可能。特にCSP設計（S-NG-4/I-NG-3）とデバッグモード本番制御（S-NG-2/I-NG-5）は複数ロールから指摘されており、優先度が高い。
