# コンポーネントメソッド定義

**注記**: ECSアーキテクチャのため、コンポーネントはデータのみ。ロジックはシステムに集約。
ここでは各システム・マネージャーの主要メソッドシグネチャを定義する。
詳細なビジネスルールは Functional Design（CONSTRUCTION PHASE）で定義。

---

## ECS コア

### World
```typescript
class World {
  createEntity(): Entity
  destroyEntity(id: EntityId): void
  addComponent<T>(entityId: EntityId, component: T): void
  removeComponent<T>(entityId: EntityId, componentType: ComponentType<T>): void
  getComponent<T>(entityId: EntityId, componentType: ComponentType<T>): T | undefined
  query(...componentTypes: ComponentType[]): Entity[]
  addSystem(system: System): void
  update(deltaTime: number): void
}
```

### Entity
```typescript
type EntityId = number
interface Entity {
  id: EntityId
  components: Map<ComponentType, Component>
}
```

---

## システムメソッド

### S-01: InputSystem
```typescript
class InputSystem implements System {
  update(world: World, dt: number): void
  // キーボード・タッチ入力を読み取り、PlayerComponentの移動意図を更新
  // 入力値を -1, 0, +1 に正規化し、NaN/Infinity等の不正値は無視
  private setupKeyboardListeners(): void
  private setupTouchListeners(canvas: HTMLCanvasElement): void
  // モバイルタッチUI: 左右ボタン（タップ長押し対応）、水平スワイプ（画面下半分）
  private validateInput(value: number): number
  // 入力バリデーション: フレームあたり最大移動量制限チェック
  private isMobileDevice(): boolean
  // デバイスタイプ判定でタッチUI表示を切替
}
```

### S-02: MovementSystem
```typescript
class MovementSystem implements System {
  update(world: World, dt: number): void
  // Velocity × dt で Position を更新
}
```

### S-03: PlayerMovementSystem
```typescript
class PlayerMovementSystem implements System {
  update(world: World, dt: number): void
  // 入力方向 × 移動速度 × パッシブ補正で Player を移動。画面境界制限
}
```

### S-04: AllyFollowSystem
```typescript
class AllyFollowSystem implements System {
  update(world: World, dt: number): void
  // プレイヤー位置からオフセットを計算し仲間位置を更新
}
```

### S-05: WeaponSystem
```typescript
class WeaponSystem implements System {
  update(world: World, dt: number): void
  // プレイヤーはWeaponInventoryComponentの全武器を順に処理
  // 発射間隔チェック → 弾丸数上限チェック → ターゲット選定 → 弾丸エンティティ生成
  findNearestEnemy(world: World, position: Position, range: number): EntityId | null
  private getBulletCount(world: World): number
  // 現在の弾丸数を取得。上限100発を超える場合は弾丸生成をスキップ
}
```

### S-06: CollisionSystem
```typescript
class CollisionSystem implements System {
  update(world: World, dt: number): void
  // 弾丸-敵の円形衝突判定。命中時：敵HP減少、HP0なら破棄＋XPドロップ生成
  checkCircleCollision(a: {x,y,r}, b: {x,y,r}): boolean
}
```

### S-07: DefenseLineSystem
```typescript
class DefenseLineSystem implements System {
  update(world: World, dt: number): void
  // 敵のY座標が防衛ライン以下かチェック。到達時：プレイヤーHP減少、敵破棄
}
```

### S-08: HealthSystem
```typescript
class HealthSystem implements System {
  update(world: World, dt: number): void
  // 無敵時間カウントダウン、HP0判定→ゲームオーバーイベント発火
}
```

### S-09: XPCollectionSystem
```typescript
class XPCollectionSystem implements System {
  update(world: World, dt: number): void
  // XPアイテムとプレイヤーの距離チェック（48px以内で回収）
}
```

### S-10: RenderSystem
```typescript
class RenderSystem implements System {
  constructor(canvas: HTMLCanvasElement)
  update(world: World, dt: number): void
  // Canvas 2D contextでSpriteComponent + PositionComponent描画
  // レイヤー順: 背景 → XPアイテム → 敵 → 弾丸 → 仲間 → プレイヤー → エフェクト
  initCanvas(): void
  // Canvas初期化: 論理解像度720x1280設定、devicePixelRatio適用
  handleResize(): void
  // リサイズ時: アスペクト比9:16維持、レターボックス（黒帯）描画、スケーリング係数再算出
  private isInViewport(pos: Position, margin: number): boolean
  // カリング判定: 画面外エンティティの描画スキップ
  private renderDebugOverlay(fps: number, entityCount: number): void
  // デバッグモード時: FPSカウンター、エンティティ数等を左上に表示
}
```

### S-12: EffectSystem
```typescript
class EffectSystem implements System {
  update(world: World, dt: number): void
  // EffectComponentのelapsedをdt加算し、duration超過でエンティティ破棄
  // アニメーションフレーム進行: elapsed / frameInterval でcurrentFrameを更新
  // 同時エフェクト上限（50個）チェック: 超過時は最古のエフェクトを破棄
  private getEffectCount(world: World): number
  private removeOldestEffect(world: World): void
}
```

---

## マネージャーメソッド

### M-01: GameStateManager
```typescript
class GameStateManager {
  getCurrentState(): GameState
  changeState(newState: GameState): void
  onStateChange(callback: (oldState, newState) => void): void
  // GameState: 'TITLE' | 'PLAYING' | 'LEVEL_UP' | 'GAME_OVER'
}
```

### M-02: WaveManager
```typescript
class WaveManager {
  update(elapsedTime: number): void
  getCurrentWave(): number
  getSpawnConfig(): SpawnConfig
  shouldSpawnBoss(): boolean
  // SpawnConfig: { interval, enemyTypes, hpMultiplier, damageMultiplier }
}
```

### M-03: SpawnManager
```typescript
class SpawnManager {
  update(world: World, dt: number): void
  // 敵数上限チェック（200体）後にスポーン実行。上限時はスキップ
  spawnEnemy(world: World, type: EnemyType): EntityId | null
  // 上限超過時はnullを返しスポーンを抑制
  getRandomSpawnPosition(): {x: number, y: number}
  private getEnemyCount(world: World): number
  // 現在の敵エンティティ数を取得
  static readonly MAX_ENEMIES = 200
}
```

### M-04: LevelUpManager
```typescript
class LevelUpManager {
  private generatedChoiceIds: Set<string> = new Set()
  // 直近のgenerateChoices()で生成した選択肢IDを保持（不正選択防止用）

  addXP(amount: number): void
  checkLevelUp(): boolean
  // レベルアップ判定後、レベルアップ成立時にHP回復処理を実行:
  //   - 通常レベルアップ: プレイヤーHP を最大HPの10%回復（FR-01）
  //   - 全強化取得済みの場合: プレイヤーHP を最大HPの30%回復（FR-03）
  //   - 回復後のHPは最大HPを超えない（Math.min適用）

  generateChoices(count: number): UpgradeChoice[]
  // 生成した選択肢のIDをgeneratedChoiceIdsに記録

  applyChoice(world: World, choice: UpgradeChoice): void
  // 選択肢の有効性検証（NFR-07）:
  //   1. choice.id が generatedChoiceIds に含まれるかチェック（不正IDの拒否）
  //   2. 対象スキル/武器の現在レベルが最大レベル未満かチェック（最大レベル超過防止）
  //   3. 検証失敗時はエラーログ出力し、選択を無視してレベルアップ画面を再表示
  // 検証通過後に強化を適用し、generatedChoiceIdsをクリア

  getCurrentLevel(): number
  getXPProgress(): { current: number, required: number }

  private healOnLevelUp(world: World): void
  // HP回復処理: 全強化取得済みフラグに応じて10%または30%回復
  private areAllUpgradesMaxed(): boolean
  // 全武器・全パッシブスキルが最大レベルに到達しているか判定
}
```

### M-05: UIManager
```typescript
class UIManager {
  updateHUD(state: HUDState): void
  showTitleScreen(): void
  showLevelUpScreen(choices: UpgradeChoice[]): Promise<UpgradeChoice>
  showGameOverScreen(score: ScoreData): void
  handleResize(): void
}
```

### M-06: AssetManager
```typescript
class AssetManager {
  loadAll(): Promise<void>
  getSprite(key: string): ImageBitmap | null
  getFont(key: string): string
}
```
