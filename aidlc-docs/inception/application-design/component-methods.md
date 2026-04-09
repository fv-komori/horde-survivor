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

### S-01: InputSystem```typescript
class InputSystem implements System {
  update(world: World, dt: number): void
  private setupKeyboardListeners(): void
  private setupTouchListeners(canvas: HTMLCanvasElement): void
  private validateInput(value: number): number
  private isMobileDevice(): boolean
}
```

### S-02: MovementSystem```typescript
class MovementSystem implements System {
  update(world: World, dt: number): void
}
```

### S-03: PlayerMovementSystem```typescript
class PlayerMovementSystem implements System {
  update(world: World, dt: number): void
  // 入力方向 × 移動速度 × バフ補正(移動速度UP時1.5倍)で移動。画面境界制限
  // BuffComponentから移動速度UPバフを参照
}
```

### S-04: AllyFollowSystem```typescript
class AllyFollowSystem implements System {
  update(world: World, dt: number): void
  // プレイヤー位置からオフセットを動的計算し仲間位置を更新
  private calculateAllyOffset(allyIndex: number, totalAllies: number): number
  // 1〜4体: 110px固定、5体以上: min(110, 配置可能幅/仲間数)、最小40px
}
```

### S-05: WeaponSystem```typescript
class WeaponSystem implements System {
  update(world: World, dt: number): void
  // 単一WeaponComponentを処理（WeaponInventory廃止）
  // 常に真上方向へ発射（ターゲティング廃止）
  // BuffComponent参照: 発射速度UP→間隔0.5倍、弾幕モード→弾数3倍+拡散
  // 仲間のAllyComponent.fireRateBonus適用
  private getEffectiveFireInterval(baseInterval: number, buff: BuffComponent | null, ally: AllyComponent | null): number
  private getBulletCount(world: World): number
  // 弾丸上限200発チェック
  static readonly MAX_BULLETS = 200
}
```

### S-06: CollisionSystem```typescript
class CollisionSystem implements System {
  private spatialGrid: SpatialHashGrid  // 空間ハッシュグリッド（NFR-01最適化）
  private defeatedEnemies: Entity[]     // 撃破キュー（責務分離用）

  update(world: World, dt: number): void
  // 1. spatialGrid.clear() + 全コライダーを登録
  // 2. 弾丸ごとにグリッドセル近傍の敵のみ衝突判定
  // 3. 命中時: HitCountComponent.currentHits -= bullet.hitCountReduction
  //    - 貫通弾(piercing=true): 弾丸を破棄せず、hitEntitiesに命中敵IDを記録し重複ヒット防止
  //    - 通常弾: 命中後に弾丸を破棄
  // 4. currentHits <= 0 で撃破 → defeatedEnemiesキューに追加
  // 5. キュー消費: ItemDropManager.determineDrops() + AllyConversionSystem通知 + ScoreService.incrementKills()
  checkCircleCollision(a: {x,y,r}, b: {x,y,r}): boolean
  private onEnemyDefeated(world: World, enemyEntity: Entity): void
  private buildSpatialGrid(world: World): void
  private getNearbyEntities(x: number, y: number, radius: number): Entity[]
}

// 空間ハッシュグリッド（衝突判定最適化）
class SpatialHashGrid {
  constructor(cellSize: number)  // cellSize = 最大コライダー径 × 2
  clear(): void
  insert(entity: Entity, x: number, y: number, radius: number): void
  query(x: number, y: number, radius: number): Entity[]
}
```

### S-07: DefenseLineSystem```typescript
class DefenseLineSystem implements System {
  update(world: World, dt: number): void
}
```

### S-08: HealthSystem```typescript
class HealthSystem implements System {
  update(world: World, dt: number): void
  // プレイヤーHP0判定→ゲームオーバーイベント発火
  // 無敵時間を削除
}
```

### S-09: ItemCollectionSystem```typescript
class ItemCollectionSystem implements System {
  update(world: World, dt: number): void
  // 1. マグネット引き寄せ: 半径1500px内のアイテムをプレイヤー方向に速度500px/秒で移動
  // 2. 回収判定: 半径80px内で回収
  // 3. 効果適用: パワーアップ→BuffComponentに追加、武器→WeaponComponent差替
  // 4. 消滅管理: 残存時間減算、10秒で消滅、残り3秒で点滅
  private applyItemEffect(world: World, playerEntity: Entity, item: ItemDropComponent): void
  private applyBuff(buff: BuffComponent, buffType: BuffType): void
  // 同種バフは残り時間を5秒にリセット
  private switchWeapon(world: World, playerEntity: Entity, weaponType: WeaponType): void
}
```

### S-10: BuffSystem```typescript
class BuffSystem implements System {
  update(world: World, dt: number): void
  // 全アクティブバフのremainingTimeをdt減算
  // remainingTime <= 0 のバフを削除
  // バフの効果はWeaponSystem/PlayerMovementSystemが各自参照
}
```

### S-11: AllyConversionSystem```typescript
class AllyConversionSystem implements System {
  // CollisionSystemの撃破イベントから呼び出される
  tryConvertToAlly(world: World, enemyEntity: Entity, defeatPosition: Position): boolean
  // 1. 現在の仲間数チェック（10体上限）
  // 2. 仲間化率に基づき判定（Math.random() < conversionRate）
  // 3. 成功時: 仲間エンティティ生成 + 演出エフェクト
  private getAllyCount(world: World): number
  static readonly MAX_ALLIES = 10
}
```

### S-12: AllyFireRateSystem```typescript
class AllyFireRateSystem implements System {
  update(world: World, dt: number): void
  // 各仲間のjoinTimeからの経過時間を計算
  // 10秒ごとにfireRateBonus += 10（最大100）
}
```

### S-13: EffectSystem```typescript
class EffectSystem implements System {
  update(world: World, dt: number): void
}
```

### S-14: CleanupSystem```typescript
class CleanupSystem implements System {
  update(world: World, dt: number): void
  // 画面外弾丸、消滅アイテム（残存時間切れ）の破棄
}
```

### S-15: RenderSystem```typescript
class RenderSystem implements System {
  constructor(canvas: HTMLCanvasElement)
  update(world: World, dt: number): void
  // レイヤー順: 背景 → アイテム → 敵(+ヒットカウント数字) → 弾丸 → 仲間 → プレイヤー → エフェクト → HUD
  initCanvas(): void
  handleResize(): void
  private isInViewport(pos: Position, margin: number): boolean
  private renderHitCount(ctx: CanvasRenderingContext2D, pos: Position, hitCount: number, isBoss: boolean): void
  // ビットマップフォント使用。画面外の敵は描画スキップ
  private renderBuffIcons(ctx: CanvasRenderingContext2D, buffs: BuffComponent): void
  // HPバー下にバフアイコン+残り時間バーを表示
  private renderDebugOverlay(fps: number, entityCount: number): void
}
```

---

## マネージャーメソッド

### M-01: GameStateManager```typescript
class GameStateManager {
  getCurrentState(): GameState
  changeState(newState: GameState): void
  onStateChange(callback: (oldState, newState) => void): void
  // GameState: 'TITLE' | 'PLAYING' | 'GAME_OVER'（LEVEL_UP廃止）
}
```

### M-02: WaveManager```typescript
class WaveManager {
  update(elapsedTime: number): void
  getCurrentWave(): number
  getSpawnConfig(): SpawnConfig
  shouldSpawnBoss(): boolean
  getHitCountMultiplier(): number
  // 30秒ごとに+10%（ベース値比率）。端数切り上げ
  // SpawnConfig: { interval, enemyTypes, simultaneousCount, hitCountMultiplier }
}
```

### M-03: SpawnManager```typescript
class SpawnManager {
  update(world: World, dt: number): void
  spawnEnemies(world: World, count: number): EntityId[]
  // 複数体同時スポーン対応
  getRandomSpawnPosition(): {x: number, y: number}
  // X: 100〜620px範囲
  private getEnemyCount(world: World): number
  static readonly MAX_ENEMIES = 300
  static readonly MAX_SIMULTANEOUS_SPAWN = 5
}
```

### M-04: ItemDropManager```typescript
class ItemDropManager {
  determineDrops(enemyType: EnemyType): ItemDrop[]
  // 1. 現在のアイテム数がMAX_ITEMSに達している場合はドロップ抑制
  // 2. 武器アイテム判定（5%）
  // 3. パワーアップアイテム判定（通常30%, 高速35%, タンク50%, ボス100%×2〜3個）
  // 両方成立時は両方ドロップ
  private selectPowerUpType(): ItemType
  // ドロップウェイト: 攻撃UP 30%, 発射速度UP 30%, 移動速度UP 20%, 弾幕 20%
  private selectWeaponType(): WeaponType
  // 現在装備以外からランダム選択
  private getItemCount(world: World): number
  static readonly MAX_ITEMS = 50  // NFR-01: アイテム同時表示上限
}
```

### M-05: UIManager
```typescript
class UIManager {
  updateHUD(state: HUDState): void
  // HUDState: { hp, maxHp, activeBuffs, wave, elapsedTime, allyCount, maxAllies, weaponType }
  showTitleScreen(): void
  showGameOverScreen(score: ScoreData): void
  // ScoreData: { survivalTime, killCount, allyCount }（level削除）
  handleResize(): void
}
```

### M-06: AssetManager```typescript
class AssetManager {
  loadAll(): Promise<void>
  getSprite(key: string): ImageBitmap | null
  getFont(key: string): string
}
```
