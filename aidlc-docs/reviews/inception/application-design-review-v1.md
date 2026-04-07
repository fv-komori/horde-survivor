# アプリケーション設計レビュー v1

**レビュー対象**: アプリケーション設計書（components.md, component-methods.md, services.md, component-dependency.md）
**上流ドキュメント**: requirements.md
**レビュー日**: 2026-04-07
**レビュー種別**: 初回レビュー

---

## 1. ソフトウェアアーキテクト（A）

### レビュー観点
- ECSアーキテクチャの適切性
- 全体整合性（要件定義との一致）
- 拡張性・保守性
- 依存関係管理
- 責務分離

### OK項目

| # | 対象設計 | OK理由 |
|---|---------|--------|
| A-OK-1 | ECSアーキテクチャ選定: Component=データ、System=ロジックの分離 | ゲームの性質（大量のエンティティに対するバッチ処理）に適合しており、責務分離が明確。コンポーネントが純粋なデータコンテナとして設計されている点はECSの原則に忠実 |
| A-OK-2 | システム実行順序: 優先度による明示的な実行順序定義 | 入力→移動→射撃→衝突→HP管理→描画という論理的に正しい順序が設計されており、データフロー図と一致している。Cleanup(98)→Render(99)の順序も適切 |
| A-OK-3 | EntityFactory: エンティティ生成のファクトリパターン | コンポーネントの組み合わせをカプセル化し、エンティティ生成の一貫性を担保。新しいエンティティタイプ追加時の変更箇所が明確 |
| A-OK-4 | 依存関係マトリクス: システムごとの読み書きコンポーネントの明示 | 各システムがどのコンポーネントを読み取り/書き込みするかが明文化されており、データ競合の予防と影響分析が容易 |
| A-OK-5 | マネージャーとECSの分離: ゲーム管理ロジックをECS外に配置 | GameStateManager、WaveManager等のゲーム全体を跨ぐ管理ロジックをECS外のマネージャーとして分離しており、ECSの純粋性を保ちつつゲーム全体のオーケストレーションを実現 |
| A-OK-6 | GameServiceオーケストレーション: 状態に応じた処理分岐の設計 | TITLE/PLAYING/LEVEL_UP/GAME_OVERの各状態で適切な処理フローが設計されており、要件FR-04の状態遷移と整合 |
| A-OK-7 | configファイル分離: ゲームバランスパラメータの外部化 | gameConfig, enemyConfig, weaponConfig, waveConfigを分離し、バランス調整時のコード変更を最小化する設計 |

### NG項目

| # | 対象設計 | NG理由 | 提案 |
|---|---------|--------|------|
| A-NG-1 | EnemyComponent: **敵HPの管理先が不明確** | EnemyComponentにはHP関連フィールドがなく、HealthComponentはプレイヤー専用と定義（C-04: 用途=プレイヤー）。しかしCollisionSystemは「敵HP減少」を行い、CleanupSystemは「消滅した敵」を処理する。敵のHP管理先が設計上未定義 | **提案**: HealthComponentの用途に「敵エンティティ」を追加するか、EnemyComponentにHP関連フィールドを明示する。依存関係マトリクスでCollisionSystemがHealthComponent(敵)を書き込む記述と整合させる <!-- severity: critical --> |
| A-NG-2 | components.md: **所持武器・仲間表示のデータモデル未定義** | 要件FR-05に「所持武器・仲間の表示」があるが、プレイヤーが複数武器を保持する状態を管理するデータ構造が設計されていない。WeaponComponentは単一武器のデータのみ定義しており、複数武器の同時装備（FR-03: 最大3種）をどう実現するか不明 | **提案**: PlayerにWeaponComponentを複数アタッチする方式か、WeaponInventoryComponentのような複数武器管理コンポーネントを新設する。また、UIManagerがこの情報をどう参照するかのデータフローも明記する <!-- severity: critical --> |
| A-NG-3 | services.md: **エラーハンドリング設計の欠如** | 要件NFR-08でグローバルエラーハンドラー、ゲームループエラーのtry-catch、アセット読み込み失敗時のフォールバックが求められているが、GameServiceやAssetManagerのメソッド定義にエラーハンドリングの言及がない | **提案**: GameService.gameLoopにtry-catch戦略を明記し、AssetManager.loadAllにフォールバック処理の設計を追加する。エラー発生時の状態遷移（安全な停止→エラー画面）もGameStateManagerの状態に含めるか方針を明記する <!-- severity: important --> |
| A-NG-4 | component-dependency.md: **WaveManagerとLevelUpManagerの依存関係が不正確** | 依存関係図ではLevelUpManagerがWaveManagerの下位に配置されているが、実際にはLevelUpManagerはXPCollectionSystem→LevelUpManager→GameStateManager(LEVEL_UP)というフローで独立している。WaveManagerとの直接依存はないはず | **提案**: 依存関係図を修正し、LevelUpManagerはGameServiceから直接参照される形に変更する。ScoreServiceも同様にGameService直下に配置する <!-- severity: medium --> |
| A-NG-5 | components.md: **レベルアップ時HP回復のデータフロー未設計** | FR-03で「レベルアップ時にHP 10%回復」「全強化取得済みの場合HP回復30%」が要件だが、LevelUpManager.applyChoiceからHealthComponentへの書き込みパスが設計に未反映 | **提案**: LevelUpManagerがWorldへの参照を持ち、applyChoice時にHealthComponentを更新するフローを依存関係マトリクスに追加する <!-- severity: medium --> |
| A-NG-6 | components.md: **同時敵数・弾丸数の上限管理メカニズムが未設計** | NFR-01で同時敵数上限200体、弾丸上限100発が要件だが、これを制御するコンポーネントやシステムの設計がない。SpawnManagerにも上限チェックのインターフェースが定義されていない | **提案**: SpawnManagerに現在の敵数チェック機能を追加し、WeaponSystemにも弾丸数上限チェックを追加する。あるいはWorldレベルでエンティティカウント機能を提供する <!-- severity: important --> |
| A-NG-7 | component-dependency.md: **AudioManager(M-07)がモジュール構成に未反映** | components.mdでAudioManagerがスタブとして定義されているが、ファイル構成にAudioManager.tsが含まれていない | **提案**: managers/AudioManager.tsをファイル構成に追加する。スタブでも将来拡張用のインターフェースファイルとして配置しておくべき <!-- severity: minor --> |

### スコア評価

| 観点 | スコア (1-10) | 根拠 |
|------|-------------|------|
| 正確性 | 5 | A-NG-1（敵HP管理先未定義）、A-NG-2（複数武器管理未定義）がcriticalであり、要件FR-02/FR-03の中核機能の実現方法が設計上曖昧。A-NG-5のHP回復フローも未反映 |
| 設計品質 | 7 | ECSパターンの適用（A-OK-1）、責務分離（A-OK-5）、ファクトリパターン（A-OK-3）は適切。ただしA-NG-4の依存関係図の不正確さが設計品質を下げる |
| セキュリティ | 6 | NFR-07の入力バリデーション・状態整合性チェックに対応するシステム/マネージャー設計が明示されていない（A-NG-3のエラーハンドリングと関連）。ただし設計フェーズとしては許容範囲 |
| 保守性 | 7 | configファイル分離（A-OK-7）、明確なモジュール構成、ECSの拡張性は良好。A-NG-6の上限管理が未設計である点、A-NG-7のスタブ未反映が若干の減点要因 |

---

## 2. フロントエンド開発者（F）

### レビュー観点
- Canvas描画設計
- 状態管理
- UI設計
- レスポンシブ対応
- パフォーマンス

### OK項目

| # | 対象設計 | OK理由 |
|---|---------|--------|
| F-OK-1 | RenderSystem: レイヤー順序の明示的定義 | 背景→XPアイテム→敵→弾丸→仲間→プレイヤー→エフェクトの描画順序が明記されており、視覚的な重なりの優先度が要件に適合 |
| F-OK-2 | UIManager: handleResize()の定義 | NFR-02/NFR-05のレスポンシブ対応・レターボックス処理に対応するリサイズハンドラが設計されている |
| F-OK-3 | UIManager: showLevelUpScreen()がPromise返却 | レベルアップ選択画面をPromiseで設計しており、非同期のユーザー選択待ちとゲームループの一時停止を適切に表現 |
| F-OK-4 | InputSystem: キーボード・タッチ両対応 | FR-01の操作要件（PC: A/D/矢印キー、モバイル: タッチ）に対応するInputSystemが設計されている |
| F-OK-5 | UI分離: HUD/TitleScreen/LevelUpScreen/GameOverScreenのファイル分離 | UIManagerの下に各画面コンポーネントが独立ファイルとして設計されており、画面ごとの変更が局所化できる |
| F-OK-6 | GameStateManager: コールバック方式の状態変更通知 | onStateChange(callback)によりUIの状態連動が疎結合で実現でき、状態遷移に応じたUI切り替えが柔軟に行える |

### NG項目

| # | 対象設計 | NG理由 | 提案 |
|---|---------|--------|------|
| F-NG-1 | InputSystem/InputHandler: **モバイルUI操作の設計詳細が不足** | NFR-02で「左右移動ボタン（タップ長押しで連続移動）」「水平スワイプ操作」が要件だが、InputSystemは「キーボード/タッチ入力を読み取り」としか記述がない。InputHandler.tsがファイル構成にあるが、メソッド定義がなく、タッチ操作のUIボタン描画・イベント処理の設計が欠落 | **提案**: InputHandlerのメソッド定義を追加し、タッチボタンのDOM/Canvas上の配置、スワイプ検出ロジック、長押し判定の設計を明記する。またタッチ領域44x44pt以上の確保方針も記述する <!-- severity: important --> |
| F-NG-2 | RenderSystem: **パフォーマンス最適化戦略の未設計** | NFR-01で500オブジェクト同時描画、PC60FPS/モバイル30FPS維持が要件。RenderSystemは全SpriteComponentを毎フレーム描画する設計だが、画面外カリング、バッチ描画、ダーティフラグ等の最適化戦略が言及されていない | **提案**: RenderSystemにオフスクリーン判定（カリング）、スプライトバッチ描画、必要に応じたOffscreenCanvasの活用方針を設計に追加する <!-- severity: important --> |
| F-NG-3 | services.md: **デルタタイム上限の設計が未反映** | FR-04で「タブ非アクティブ復帰時にデルタタイム上限を設けてスキップ防止」が要件だが、GameService.gameLoopのdt計算にこの上限処理が設計として言及されていない | **提案**: GameService.gameLoopまたはupdateメソッドにdt上限（例: 100ms）のクランプ処理を設計として明記する <!-- severity: medium --> |
| F-NG-4 | UIManager: **HUD配置の詳細設計が不足** | FR-05で「HPバー（画面上部）、XPバー、ウェーブ/経過時間表示、所持武器・仲間の表示」が要件だが、UIManagerのupdateHUD(state: HUDState)のHUDState型定義がなく、各要素の描画位置・サイズの設計が欠落 | **提案**: HUDState型の定義を追加し、各HUD要素の論理座標での配置ガイドラインを設計に含める。NFR-05の基準解像度720x1280上でのレイアウト仕様を記述する <!-- severity: medium --> |
| F-NG-5 | SpriteComponent: **アニメーション設計の詳細が不足** | C-03で「アニメーションフレーム」が言及されているが、アニメーション制御（フレームレート、ループ、アニメーション状態遷移）のデータ構造が未定義。NFR-04のアニメーション要件（移動、射撃エフェクト、敵撃破エフェクト）への対応が不明確 | **提案**: SpriteComponentにアニメーション関連フィールド（currentFrame, totalFrames, frameRate, isLooping, animationState）を明示するか、AnimationComponentを新設する <!-- severity: medium --> |
| F-NG-6 | components.md: **エフェクトシステムの未設計** | RenderSystemのレイヤー順序に「エフェクト」が含まれ、NFR-04で「射撃エフェクト、敵撃破エフェクト」が要件だが、エフェクト用のコンポーネントやシステムが定義されていない | **提案**: EffectComponent（エフェクト種別、持続時間、開始時刻）を追加し、エフェクトエンティティの生成・描画・破棄のフローを設計する。あるいはRenderSystem内のサブ処理として設計方針を明記する <!-- severity: medium --> |
| F-NG-7 | component-dependency.md: **Canvas初期化とスケーリングの設計が不明確** | NFR-05で論理解像度720x1280、レターボックス方式が要件だが、GameServiceがcanvasを受け取った後のスケーリング設定（ctx.scale、CSS transform等）や、RenderSystemがどのようにCanvasコンテキストを取得するかの設計が欠落 | **提案**: GameService.init()内でのCanvas初期化手順（論理解像度設定、デバイスピクセル比対応、スケーリング行列設定）を設計に追加する。RenderSystemへのCanvasコンテキスト注入方法も明記する <!-- severity: important --> |

### スコア評価

| 観点 | スコア (1-10) | 根拠 |
|------|-------------|------|
| 正確性 | 6 | F-NG-1（モバイル操作設計不足）、F-NG-6（エフェクト未設計）でNFR-02/NFR-04の要件を満たす設計が不十分。ただし基本的なUI構成（F-OK-5）と状態管理（F-OK-3, F-OK-6）は要件と整合 |
| 設計品質 | 6 | UIの画面分離（F-OK-5）やPromise活用（F-OK-3）は良いが、F-NG-2（パフォーマンス最適化戦略なし）、F-NG-7（Canvas初期化未設計）がフロントエンド設計品質として不十分 |
| セキュリティ | 7 | 入力バリデーション（移動入力値範囲チェック）はInputSystemで対応可能な構造。ただし具体的な実装設計はまだない。フロントエンド特有のセキュリティリスク（XSS等）は静的ゲームの性質上低い |
| 保守性 | 7 | UIコンポーネントのファイル分離（F-OK-5）、configファイルの外部化は保守性に貢献。F-NG-4（HUDState型未定義）やF-NG-5（アニメーション構造未定義）は実装時に設計判断が必要になるリスク |

---

## 総括

### Critical指摘（要修正）
- **A-NG-1**: 敵HPの管理先が未定義（HealthComponentの用途拡張が必要）
- **A-NG-2**: 複数武器の同時装備管理のデータモデルが未定義

### Important指摘（修正推奨）
- **A-NG-3**: エラーハンドリング設計の欠如（NFR-08対応）
- **A-NG-6**: 同時敵数・弾丸数の上限管理メカニズムが未設計（NFR-01対応）
- **F-NG-1**: モバイルUI操作の設計詳細が不足（NFR-02対応）
- **F-NG-2**: パフォーマンス最適化戦略の未設計（NFR-01対応）
- **F-NG-7**: Canvas初期化とスケーリングの設計が不明確（NFR-05対応）

### 次回レビューへの期待
上記Critical/Important指摘の修正を反映した上で、再レビューを実施することを推奨する。
