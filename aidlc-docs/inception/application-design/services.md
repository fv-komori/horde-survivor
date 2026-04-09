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
  private setupErrorHandlers(): void
  private showErrorScreen(error: Error): void
}
```

### deltaTimeクランプ設計（NFR-08）
- `gameLoop()`内でdeltaTimeを算出後、上限クランプを適用: `dt = Math.min(rawDt, 100)`（最大100ms = 10FPS相当）
- タブ復帰時やフレーム落ち時の異常な大きいdtによるゲーム物理の破綻を防止

### エラーハンドリング設計（NFR-08）
- **グローバルエラーハンドラー**: `window.onerror` + `unhandledrejection`
- **ゲームループtry-catch**: 致命的エラー時は停止+エラー画面表示（リロードボタン付き）
- **アセット読み込み失敗**: プレースホルダーで代替、ゲーム続行

### オーケストレーション
1. `init()` → setupErrorHandlers() → AssetManager.loadAll() → World初期化 → システム登録
2. `start()` → GameStateManager.changeState('TITLE') → requestAnimationFrame開始
3. `gameLoop()` → dt計算 → dtクランプ → 状態分岐:
   - TITLE: UIManager.showTitleScreen() のみ
   - PLAYING: World.update(dt) + WaveManager.update() + SpawnManager.update()
   - GAME_OVER: UIManager.showGameOverScreen()

---

## S-SVC-02: ScoreService

### 責務
- ゲーム内スコアデータの集計

### メソッド
```typescript
class ScoreService {
  reset(): void
  incrementKills(): void
  updateElapsedTime(dt: number): void
  updateAllyCount(count: number): void
  getScore(): ScoreData
  // ScoreData: { survivalTime, killCount, allyCount }（level削除）
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
  createEnemy(world: World, type: EnemyType, position: Position, hitCountMultiplier: number): EntityId
  // hitCountMultiplier: WaveManagerからのヒット数スケーリング倍率
  createBullet(world: World, origin: Position, direction: {dx, dy}, hitCountReduction: number, piercing: boolean): EntityId
  // direction: 真上方向{0, -1}が基本。拡散時は角度付き
  createItemDrop(world: World, position: Position, itemType: ItemType): EntityId
  // アイテムドロップエンティティ生成（ItemDropComponent + 消滅タイマー付き）
  createAlly(world: World, playerEntity: EntityId, allyIndex: number): EntityId
  // 仲間エンティティ生成（AllyComponent + WeaponComponent + joinTime設定）
  createEffect(world: World, type: EffectType, position: Position): EntityId
  // EffectType: 'muzzle_flash' | 'enemy_destroy' | 'buff_activate' | 'ally_convert'
}
```

### 変更点
- createXPDrop → createItemDrop に置換
- createBullet: damage → hitCountReduction、target → direction に変更
- createEnemy: hitCountMultiplier パラメータ追加
- createAlly: offset → allyIndex に変更（動的配置のため）
- createEffect: 'buff_activate', 'ally_convert' タイプ追加

---

## サービス間の関係

```
GameService（メインオーケストレーター）
  ├── World（ECSコンテナ）
  │     ├── Systems（S-01〜S-15）
  │     └── Entities + Components
  ├── GameStateManager（状態管理: TITLE/PLAYING/GAME_OVER）
  ├── WaveManager（ウェーブ進行）
  ├── SpawnManager → EntityFactory（敵生成）
  ├── ItemDropManager → EntityFactory（アイテム生成）
  ├── UIManager（HUD: HPバー/バフ表示/ウェーブ/仲間数/武器）
  ├── ScoreService（スコア: 生存時間/撃破数/仲間数）
  └── AssetManager（アセット管理）
```

---

## ログ出力設計

### 方針
- **ログレベル**: DEBUG / INFO / WARN / ERROR の4段階
- **実装**: console APIのラッパー（Logger ユーティリティ）
- **本番ビルド**: DEBUG/INFOはビルド時に除去（Vite define置換 or Tree-shaking）
- **出力対象**:
  - ERROR: 致命的エラー（アセット読み込み失敗、ECS不整合）→ console.error
  - WARN: 上限到達（敵300体、弾丸200発、アイテム50個）、パフォーマンス低下検知 → console.warn
  - INFO: ゲーム状態遷移、ウェーブ進行 → console.info
  - DEBUG: FPS、エンティティ数、衝突判定回数 → console.debug（開発時のみ）
- **フォーマット**: `[LEVEL] [System名] メッセージ` （例: `[WARN] [SpawnManager] Enemy limit reached: 300`）

```typescript
class Logger {
  static debug(system: string, message: string, ...args: unknown[]): void
  static info(system: string, message: string, ...args: unknown[]): void
  static warn(system: string, message: string, ...args: unknown[]): void
  static error(system: string, message: string, ...args: unknown[]): void
  static setLevel(level: LogLevel): void  // 実行時レベル変更（デバッグ用）
}
```

---

## CSP設計（NFR-07）
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'none';
  object-src 'none';
  form-action 'none';
```

---

## CI/CD パイプライン設計（NFR-09）
```
[Push to main] → Lint → Build → Test → Deploy
[Pull Request]  → Lint → Build → Test → npm audit
```
