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
    |         |         |   (HP/バフ/   (タイトル/
    +----+----+         |   仲間/武器)  ゲームオーバー)
         |              |
  WaveManager ←→ SpawnManager
         |
   ItemDropManager
         |
   ScoreService
```

## システムの依存関係

| システム | 読み取るコンポーネント | 書き込むコンポーネント | 外部依存 |
|---------|---------------------|---------------------|---------|
| InputSystem | PlayerComponent | PlayerComponent(移動意図) | ブラウザInput API |
| PlayerMovementSystem | PlayerComponent, **BuffComponent** | PositionComponent | - |
| MovementSystem | VelocityComponent | PositionComponent | - |
| AllyFollowSystem | AllyComponent | PositionComponent | PlayerのPosition参照 |
| WeaponSystem | WeaponComponent, **BuffComponent**, **AllyComponent**, PositionComponent | - | EntityFactory(弾丸生成) |
| CollisionSystem | BulletComponent, **HitCountComponent**, EnemyComponent, ColliderComponent | **HitCountComponent** | **ItemDropManager**, **AllyConversionSystem**, **ScoreService**, EntityFactory, SpatialHashGrid |
| DefenseLineSystem | EnemyComponent, PositionComponent | HealthComponent(プレイヤー) | - |
| HealthSystem | HealthComponent, PlayerComponent | - | GameStateManager(ゲームオーバー) |
| **ItemCollectionSystem** | **ItemDropComponent**, PositionComponent | **BuffComponent**, WeaponComponent | - |
| **BuffSystem** | **BuffComponent** | **BuffComponent** | - |
| **AllyConversionSystem** | EnemyComponent | - | EntityFactory(仲間生成) |
| **AllyFireRateSystem** | **AllyComponent** | **AllyComponent**(fireRateBonus) | - |
| EffectSystem | EffectComponent | EffectComponent | - |
| CleanupSystem | PositionComponent, **ItemDropComponent** | - | World(エンティティ破棄) |
| RenderSystem | SpriteComponent, PositionComponent, **HitCountComponent**, **BuffComponent**, **ItemDropComponent** | - | Canvas 2D Context |

## システム実行順序

```
 1. InputSystem              — 入力読み取り
 2. PlayerMovementSystem     — プレイヤー移動（バフ速度補正含む）
 3. MovementSystem           — 敵・弾丸・アイテム移動
 4. AllyFollowSystem         — 仲間追従（動的間隔）
 5. WeaponSystem             — 射撃・弾丸生成（バフ・仲間連射ボーナス適用）
 6. CollisionSystem          — 弾丸-敵 衝突 → ヒットカウント減算 → 撃破判定
 7. DefenseLineSystem        — 防衛ライン到達チェック
 8. HealthSystem             — プレイヤーHP管理・ゲームオーバー判定
 9. ItemCollectionSystem     — アイテムマグネット・回収・バフ/武器適用
10. BuffSystem               — バフ時間管理・失効処理
11. AllyConversionSystem     — 仲間化判定（CollisionSystemから通知）
12. AllyFireRateSystem       — 仲間の連射速度時間経過強化
    ...
97. EffectSystem             — エフェクトアニメーション
98. CleanupSystem            — 不要エンティティ破棄
99. RenderSystem             — 描画（ヒットカウント数字・バフHUD含む）
```

## データフロー

```
[入力] → InputSystem → PlayerMovementSystem → [プレイヤー位置更新]
                              ↑ バフ速度参照         |
                          BuffComponent              |
                                                     |
[時間経過] → WaveManager → SpawnManager → [敵生成(ヒットカウント付き)]
                                               ↓
                                         MovementSystem → [敵位置更新]
                                                              |
                                                        DefenseLineSystem
                                                         ↓ 防衛ライン到達
                                                   [プレイヤーHP減少]
                                                              |
[プレイヤー位置] → WeaponSystem → [弾丸生成(真上方向)]
        ↑ バフ参照(発射速度/弾幕)         ↓
    BuffComponent              CollisionSystem
                                    ↓ 命中: ヒットカウント減算
                               [ヒットカウント0 → 撃破]
                                    ↓
                    +---------------+---------------+
                    |               |               |
             ItemDropManager   ScoreService  AllyConversionSystem
                    ↓          (killCount+1)        ↓
            [アイテムドロップ生成]           [仲間化判定 → 仲間生成]
                    ↓                               ↓
          ItemCollectionSystem              AllyFireRateSystem
                    ↓ 回収                     ↓ 10秒ごと
            +-------+-------+           [連射速度+10%]
            |               |
     [バフ適用]      [武器切替]
     BuffComponent  WeaponComponent
            ↓
       BuffSystem
       ↓ 5秒経過で失効
```

## モジュール構成（ファイル構造）

```
src/
├── index.ts                    # エントリポイント
├── game/
│   ├── GameService.ts          # メインオーケストレーター
│   ├── GameStateManager.ts     # ゲーム状態管理（TITLE/PLAYING/GAME_OVER）
│   └── ScoreService.ts         # スコア集計（生存時間/撃破数/仲間数）
├── ecs/
│   ├── World.ts
│   ├── Entity.ts
│   ├── Component.ts
│   └── System.ts
├── components/
│   ├── PositionComponent.ts
│   ├── VelocityComponent.ts
│   ├── SpriteComponent.ts
│   ├── HealthComponent.ts       # プレイヤー専用
│   ├── ColliderComponent.ts
│   ├── PlayerComponent.ts
│   ├── EnemyComponent.ts        # 仲間化率追加
│   ├── BulletComponent.ts       # hitCountReduction
│   ├── WeaponComponent.ts       # 単一武器制
│   ├── AllyComponent.ts         # joinTime/fireRateBonus追加
│   ├── HitCountComponent.ts    敵のヒットカウント
│   ├── ItemDropComponent.ts    ドロップアイテム
│   ├── BuffComponent.ts        バフ状態
│   └── EffectComponent.ts
├── systems/
│   ├── InputSystem.ts
│   ├── PlayerMovementSystem.ts  # バフ速度参照
│   ├── MovementSystem.ts
│   ├── AllyFollowSystem.ts      # 動的間隔
│   ├── WeaponSystem.ts          # 単一武器・真上発射・バフ適用
│   ├── CollisionSystem.ts       # ヒットカウント減算
│   ├── DefenseLineSystem.ts
│   ├── HealthSystem.ts          # プレイヤー専用
│   ├── ItemCollectionSystem.ts
│   ├── BuffSystem.ts           バフ管理
│   ├── AllyConversionSystem.ts
│   ├── AllyFireRateSystem.ts
│   ├── EffectSystem.ts
│   ├── CleanupSystem.ts
│   └── RenderSystem.ts          # ヒットカウント描画追加
├── managers/
│   ├── WaveManager.ts
│   ├── SpawnManager.ts          # 300体上限・同時スポーン
│   ├── ItemDropManager.ts      アイテムドロップ管理
│   └── AssetManager.ts
├── factories/
│   └── EntityFactory.ts
├── ui/
│   ├── UIManager.ts
│   ├── HUD.ts
│   ├── TitleScreen.ts
│   └── GameOverScreen.ts
├── input/
│   └── InputHandler.ts
├── config/                        # NFR-03: バランスパラメータJSON外部設定化
│   ├── gameConfig.json          # ゲーム全般パラメータ（FPS目標、dt上限等）
│   ├── enemyConfig.json         # 敵ステータス・ドロップ確率・仲間化率
│   ├── weaponConfig.json        # 武器パラメータ（発射間隔、弾速等）
│   ├── waveConfig.json          # ウェーブ定義（スポーン間隔、敵構成等）
│   ├── itemConfig.json          # アイテム・バフ効果値（持続時間、倍率等）
│   ├── gameConfig.ts            # 型定義(interface) + JSONローダー + バリデーション
│   ├── enemyConfig.ts           # 型定義(interface) + JSONローダー + バリデーション
│   ├── weaponConfig.ts          # 型定義(interface) + JSONローダー + バリデーション
│   ├── waveConfig.ts            # 型定義(interface) + JSONローダー + バリデーション
│   └── itemConfig.ts            # 型定義(interface) + JSONローダー + バリデーション
│   # 設計方針: JSONファイルにバランス値を定義、TSファイルは型安全なローダー兼バリデーター
│   # Viteのimport構文でJSONをビルド時バンドル（fetchは不要）
└── types/
    └── index.ts
```
