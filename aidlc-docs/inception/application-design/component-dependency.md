# コンポーネント依存関係

---

## 依存関係マトリクス

```
                    GameService
                        |
         +--------------+--------------+
         |              |              |
     World(ECS)   GameStateManager   UIManager
         |              |              |
    +----+----+         |         +----+----+
    |         |         |         |         |
 Systems  EntityFactory |    HUD描画   画面表示
    |         |         |
    +----+----+         |
         |              |
  WaveManager ←→ SpawnManager
         |
   LevelUpManager
         |
   ScoreService
```

## システムの依存関係

| システム | 読み取るコンポーネント | 書き込むコンポーネント | 外部依存 |
|---------|---------------------|---------------------|---------|
| InputSystem | PlayerComponent | PlayerComponent(移動意図) | ブラウザInput API |
| PlayerMovementSystem | PlayerComponent, PassiveSkillsComponent | PositionComponent | - |
| MovementSystem | VelocityComponent | PositionComponent | - |
| AllyFollowSystem | AllyComponent | PositionComponent | PlayerのPosition参照 |
| WeaponSystem | WeaponComponent, WeaponInventoryComponent, PositionComponent | - | EntityFactory(弾丸生成), BulletComponent(弾丸数上限チェック) |
| CollisionSystem | BulletComponent, EnemyComponent, ColliderComponent | HealthComponent(敵), EnemyComponent | EntityFactory(XPドロップ生成) |
| DefenseLineSystem | EnemyComponent, PositionComponent | HealthComponent(プレイヤー) | - |
| HealthSystem | HealthComponent, PlayerComponent | PlayerComponent(無敵) | GameStateManager(ゲームオーバー) |
| XPCollectionSystem | XPDropComponent, PositionComponent | - | LevelUpManager(XP加算) |
| RenderSystem | SpriteComponent, PositionComponent | - | Canvas 2D Context, devicePixelRatio, ResizeObserver |
| CleanupSystem | PositionComponent, HealthComponent | - | World(エンティティ破棄) |

## システム実行順序

```
1. InputSystem          — 入力読み取り
2. PlayerMovementSystem — プレイヤー移動
3. MovementSystem       — 敵・弾丸移動
4. AllyFollowSystem     — 仲間追従
5. WeaponSystem         — 射撃・弾丸生成
6. CollisionSystem      — 弾丸-敵 衝突判定
7. DefenseLineSystem    — 防衛ライン到達チェック
8. HealthSystem         — HP管理・ゲームオーバー判定
9. XPCollectionSystem   — XP回収
   ...
98. CleanupSystem       — 不要エンティティ破棄
99. RenderSystem        — 描画
```

## データフロー

```
[入力] → InputSystem → PlayerMovementSystem → [プレイヤー位置更新]
                                                      |
[時間経過] → WaveManager → SpawnManager → [敵生成] → MovementSystem → [敵位置更新]
                                                                          |
                                                                    DefenseLineSystem
                                                                     ↓ 防衛ライン到達
                                                               [プレイヤーHP減少]
                                                                          |
[プレイヤー位置] → WeaponSystem → [弾丸生成] → MovementSystem → CollisionSystem
                                                                     ↓ 命中
                                                              [敵HP減少 → 撃破]
                                                                     ↓
                                                              [XPドロップ生成]
                                                                     ↓
                                                           XPCollectionSystem
                                                                     ↓
                                                            LevelUpManager
                                                                     ↓ レベルアップ
                                                          [LEVEL_UP状態遷移]
                                                                     ↓
                                                         UIManager（選択画面表示）
                                                                     ↓ 選択
                                                         [強化適用 → PLAYING復帰]
```

## モジュール構成（ファイル構造）

```
src/
├── index.ts                    # エントリポイント
├── game/
│   ├── GameService.ts          # メインオーケストレーター
│   ├── GameStateManager.ts     # ゲーム状態管理
│   └── ScoreService.ts         # スコア集計
├── ecs/
│   ├── World.ts                # ECSコンテナ
│   ├── Entity.ts               # エンティティ型定義
│   ├── Component.ts            # コンポーネント基底
│   └── System.ts               # システムインターフェース
├── components/
│   ├── PositionComponent.ts
│   ├── VelocityComponent.ts
│   ├── SpriteComponent.ts
│   ├── HealthComponent.ts
│   ├── ColliderComponent.ts
│   ├── PlayerComponent.ts
│   ├── EnemyComponent.ts
│   ├── BulletComponent.ts
│   ├── WeaponComponent.ts
│   ├── WeaponInventoryComponent.ts
│   ├── AllyComponent.ts
│   ├── XPDropComponent.ts
│   └── PassiveSkillsComponent.ts
├── systems/
│   ├── InputSystem.ts
│   ├── PlayerMovementSystem.ts
│   ├── MovementSystem.ts
│   ├── AllyFollowSystem.ts
│   ├── WeaponSystem.ts
│   ├── CollisionSystem.ts
│   ├── DefenseLineSystem.ts
│   ├── HealthSystem.ts
│   ├── XPCollectionSystem.ts
│   ├── RenderSystem.ts
│   └── CleanupSystem.ts
├── managers/
│   ├── WaveManager.ts
│   ├── SpawnManager.ts
│   ├── LevelUpManager.ts
│   └── AssetManager.ts
├── factories/
│   └── EntityFactory.ts
├── ui/
│   ├── UIManager.ts
│   ├── HUD.ts
│   ├── TitleScreen.ts
│   ├── LevelUpScreen.ts
│   └── GameOverScreen.ts
├── input/
│   └── InputHandler.ts
├── config/
│   ├── gameConfig.ts           # ゲームバランスパラメータ
│   ├── enemyConfig.ts          # 敵タイプ定義
│   ├── weaponConfig.ts         # 武器定義
│   └── waveConfig.ts           # ウェーブ定義
└── types/
    └── index.ts                # 共通型定義
```
