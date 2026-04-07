# サービス定義

**注記**: ECSアーキテクチャにおけるサービスは、システム間の調整やゲーム全体のオーケストレーションを担当。

---

## S-SVC-01: GameService（メインオーケストレーター）

### 責務
- ゲーム全体のライフサイクル管理
- ゲームループの駆動（requestAnimationFrame）
- 各マネージャーとECS Worldの統合
- 画面サイズ・スケーリング管理

### メソッド
```typescript
class GameService {
  constructor(canvas: HTMLCanvasElement)
  init(): Promise<void>           // アセットロード、ECS初期化
  start(): void                    // ゲームループ開始
  stop(): void                     // ゲームループ停止
  reset(): void                    // ゲーム状態リセット
  private gameLoop(timestamp: number): void
  private update(dt: number): void  // 全システム更新
  private render(): void           // 描画
  private setupErrorHandlers(): void  // グローバルエラーハンドラー設定
  private showErrorScreen(error: Error): void  // エラー画面表示
}
```

### deltaTimeクランプ設計（NFR-08 / セキュリティ）
- `gameLoop()`内でdeltaTimeを算出後、上限クランプを適用: `dt = Math.min(rawDt, 100)`（最大100ms = 10FPS相当）
- タブ復帰時やフレーム落ち時の異常な大きいdtによるゲーム物理の破綻を防止
- dt = 0 以下の場合もスキップ（タイムスタンプの異常値対策）

### エラーハンドリング設計（NFR-08）
- **グローバルエラーハンドラー**: `init()`時に`window.onerror`および`window.addEventListener('unhandledrejection')`を登録。キャッチ時はゲームループを停止しエラー画面を表示
- **ゲームループtry-catch**: `gameLoop()`全体をtry-catchでラップ。致命的エラー時は`stop()`を呼びエラー画面を表示（リロードボタン付き）
- **エラー画面**: Canvas上にエラーメッセージと「リロード」ボタンを表示。ボタン押下で`location.reload()`
- **アセット読み込み失敗**: AssetManager.loadAll()の個別アセットでcatch。失敗時はプレースホルダー（単色矩形）で代替し、ゲーム続行を試行

### エラーログ設計（NFR-08）
- **出力方針**: 全エラーは`console.error()`で構造化ログを出力。フォーマット: `[FV-GAME][{severity}][{component}] {message}` （例: `[FV-GAME][ERROR][CollisionSystem] Invalid entity reference: id=42`）
- **ログレベル**: ERROR（致命的エラー、ゲーム続行不可）、WARN（非致命的エラー、フォールバック処理で続行）
- **出力対象**:
  - ゲームループ内の例外キャッチ時（ERROR）
  - アセット読み込み失敗時（WARN）
  - 不正入力検出時（WARN）
  - レベルアップ選択肢の検証失敗時（WARN）
- **外部エラー監視（オプション拡張）**: 将来的にSentry等の外部エラー監視サービスとの連携を想定。`ErrorReporter`インターフェースを定義し、console.error出力とは別にエラーイベントを送信可能な設計とする
  ```typescript
  interface ErrorReporter {
    captureError(error: Error, context?: Record<string, unknown>): void
    captureWarning(message: string, context?: Record<string, unknown>): void
  }
  // デフォルト実装: ConsoleErrorReporter（console.errorへの出力のみ）
  // 拡張時: SentryErrorReporter等を差し替え可能
  ```

### デバッグオーバーレイ設計（NFR-09）
- **FPSカウンター**: デバッグモード有効時、画面左上にFPS値をリアルタイム表示（直近60フレームの平均）
- **デバッグ情報**: エンティティ数、敵数、弾丸数、現在のゲーム状態を表示
- **有効化方法**: URLパラメータ`?debug=1`またはgameConfig.debugMode フラグで切替
- **本番ビルド**: デフォルト無効。開発時のみ利用を想定

### オーケストレーション
1. `init()` → setupErrorHandlers() → AssetManager.loadAll() → World初期化 → システム登録
2. `start()` → GameStateManager.changeState('TITLE') → requestAnimationFrame開始
3. `gameLoop()` → dt計算 → **dtクランプ適用** → 状態に応じた処理分岐:
   - TITLE: UIManager.showTitleScreen() のみ
   - PLAYING: World.update(dt) + WaveManager.update() + SpawnManager.update()
   - LEVEL_UP: UIManager.showLevelUpScreen() → 選択待ち
   - GAME_OVER: UIManager.showGameOverScreen()

---

## S-SVC-02: ScoreService

### 責務
- ゲーム内スコアデータの集計
- 生存時間、倒した敵数、到達レベルの追跡

### メソッド
```typescript
class ScoreService {
  reset(): void
  incrementKills(): void
  updateElapsedTime(dt: number): void
  getScore(): ScoreData
  // ScoreData: { survivalTime, killCount, level }
}
```

---

## S-SVC-03: EntityFactory

### 責務
- エンティティ生成のファクトリ。コンポーネントの組み合わせをカプセル化

### メソッド
```typescript
class EntityFactory {
  createPlayer(world: World): EntityId
  createEnemy(world: World, type: EnemyType, position: Position): EntityId
  createBullet(world: World, origin: Position, target: Position, damage: number, piercing: boolean): EntityId
  createXPDrop(world: World, position: Position, amount: number): EntityId
  createAlly(world: World, playerEntity: EntityId, offset: number): EntityId
  createEffect(world: World, type: 'muzzle_flash' | 'enemy_destroy', position: Position): EntityId
  // 射撃エフェクト・敵撃破エフェクトのエンティティ生成（NFR-04）
}
```

---

## サービス間の関係

```
GameService（メインオーケストレーター）
  ├── World（ECSコンテナ）
  │     ├── Systems（S-01〜S-11）
  │     └── Entities + Components
  ├── GameStateManager（状態管理）
  ├── WaveManager（ウェーブ進行）
  ├── SpawnManager → EntityFactory（敵生成）
  ├── LevelUpManager（成長システム）
  ├── UIManager（UI描画）
  ├── ScoreService（スコア集計）
  └── AssetManager（アセット管理）
```

---

## CSP（Content Security Policy）設計（NFR-07）

### 方針
本アプリケーションはCanvas 2Dベースのシングルページゲームであり、外部リソース依存を最小化する。以下のCSPディレクティブをHTMLのmetaタグまたはレスポンスヘッダーで適用する。

### 基本ディレクティブ
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'none';
```

### ディレクティブ設計根拠
| ディレクティブ | 値 | 理由 |
|---|---|---|
| `default-src` | `'self'` | 外部リソースの読み込みをデフォルトで禁止 |
| `script-src` | `'self'` | インラインスクリプト禁止。`'unsafe-eval'`不使用（ECSアーキテクチャではevalは不要） |
| `style-src` | `'self' 'unsafe-inline'` | Canvas描画はCSS非依存だが、HUD/UIのスタイリングでインラインstyleを許可 |
| `img-src` | `'self' data:` | スプライト画像はローカルアセット。Canvas.toDataURL()利用のためdata:を許可 |
| `object-src` | `'none'` | Flash/Java等のプラグインを完全ブロック |
| `form-action` | `'none'` | フォーム送信なし（ゲームアプリのため） |

### 適用方法
- **開発環境**: Vite設定（vite.config.ts）のdevサーバーヘッダーに設定
- **本番環境**: 静的サイトホスティングのレスポンスヘッダーまたはHTMLの`<meta http-equiv="Content-Security-Policy">`タグで設定

---

## CI/CD パイプライン設計（NFR-09）

### 概要
GitHub Actionsによる自動ビルド・テスト・デプロイパイプライン。

### パイプライン構成
```
[Push to main] → Lint（ESLint） → Build（Vite） → Test（Jest） → Deploy（静的サイトホスティング）
[Pull Request]  → Lint（ESLint） → Build（Vite） → Test（Jest） → npm audit
```

### ステージ詳細
1. **Lint**: ESLintによる静的解析。エラーがあればパイプライン停止
2. **Build**: `vite build`による本番ビルド。TypeScript型チェック含む
3. **Test**: Jestによるユニットテスト実行。主要ゲームロジック（CollisionSystem、LevelUpManager、WaveManager等）をカバー
4. **Security**: `npm audit --audit-level=high`で高リスク脆弱性チェック
5. **Deploy**: mainブランチへのpush時のみ、ビルド成果物を静的サイトホスティングにデプロイ

### キャッシュ戦略
- **node_modulesキャッシュ**: GitHub Actionsの`actions/cache`でnode_modulesをキャッシュ。キャッシュキーは`${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}`で管理
- **Viteビルドキャッシュ**: `node_modules/.vite`ディレクトリをキャッシュし、依存関係の事前バンドル結果を再利用
- **キャッシュ無効化**: package-lock.jsonの変更時に自動的にキャッシュを再構築

### ロールバック方針
- **手順**: 本番デプロイ後に問題が発生した場合、以下の手順でロールバック
  1. `git revert <問題のコミットハッシュ>` でリバートコミットを作成
  2. mainブランチへpushし、CI/CDパイプラインを通じて自動再デプロイ
- **即時ロールバック**: 静的サイトホスティングが過去のデプロイ履歴を保持している場合、ホスティング管理画面から直前のデプロイバージョンに即時切替可能
- **デプロイ履歴**: 直近5回分のビルド成果物をGitHub Actionsのartifactsとして保持（retention-days: 14）
