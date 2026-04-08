# Code Generation Plan - game-app

**ユニット**: game-app（単一ユニット）
**プロジェクトタイプ**: Greenfield
**言語**: TypeScript
**ビルドツール**: Vite
**アーキテクチャ**: ECS（Entity-Component-System）
**コード配置先**: `/Users/komori/fv-genai-specialforce/fv-game/src/`（ワークスペースルート配下）

---

## 実装方針

- 全コードは `src/` 配下に配置（aidlc-docs/ には配置しない）
- 設計ドキュメントの仕様に忠実に実装
- ゲームバランスパラメータは外部設定ファイル（config/）に分離（BR-CFG01）
- テストは `tests/` 配下に配置（Jest使用）
- ビルド設定はワークスペースルートに配置

---

## ストーリートレーサビリティ

| ステップ | 関連ストーリー |
|---------|--------------|
| Step 1 | - （基盤） |
| Step 2 | US-19 (パフォーマンス設定) |
| Step 3 | 全ストーリー（共通型定義） |
| Step 4 | 全ストーリー（ECS基盤） |
| Step 5 | US-03〜06, US-08, US-10〜12 |
| Step 6 | US-02, US-05, US-08, US-11 |
| Step 7 | US-02, US-15, US-16 |
| Step 8 | US-05, US-08, US-09, US-13, US-14 |
| Step 9 | US-03, US-17, US-18 |
| Step 10 | US-03, US-04, US-11 |
| Step 11 | US-04, US-05, US-06, US-14, US-19 |
| Step 12 | US-08, US-19 |
| Step 13 | US-05, US-17, US-18, US-19, US-20 |
| Step 14 | US-01, US-07, US-09, US-15, US-16, US-17 |
| Step 15 | US-02, US-09, US-13, US-15, US-16, US-20 |
| Step 16 | US-01, US-02 |
| Step 17 | US-19 (CI/CD) |
| Step 18 | US-19, US-20（品質保証） |
| Step 19 | US-04, US-06, US-09, US-13（ロジック検証） |
| Step 20 | US-05, US-08, US-09（マネージャー検証） |

---

## Step 1: プロジェクト構造セットアップ ✅
- [x] `package.json` 作成（Vite + TypeScript + Jest 依存関係）
- [x] `tsconfig.json` 作成（strict mode、ES2020ターゲット）
- [x] `vite.config.ts` 作成（CSPヘッダー、ビルド設定）
- [x] `.eslintrc.json` 作成（TypeScript ESLint設定）
- [x] `index.html` 作成（Canvas要素、CSPメタタグ、ビューポート設定）
- [x] ディレクトリ構造作成: `src/`, `src/game/`, `src/ecs/`, `src/components/`, `src/systems/`, `src/managers/`, `src/factories/`, `src/ui/`, `src/input/`, `src/config/`, `src/types/`, `tests/`

**成果物**: プロジェクト基盤ファイル一式

---

## Step 2: ゲーム設定ファイル（config/） ✅
- [x] `src/config/gameConfig.ts` - プレイヤー基本値、エンティティ上限、画面仕様、デバッグ設定
- [x] `src/config/enemyConfig.ts` - 敵タイプ別パラメータ（HP、速度、突破ダメージ、XPドロップ、半径）
- [x] `src/config/weaponConfig.ts` - 武器タイプ別・レベル別パラメータ（ダメージ、発射間隔、弾数、弾速）
- [x] `src/config/waveConfig.ts` - ウェーブ定義（時間範囲、敵タイプ、スポーン間隔、出現確率）、ボス設定、XPテーブル

**設計根拠**: BR-CFG01に基づき全数値パラメータを外部設定化

---

## Step 3: 共通型定義（types/）
- [x] `src/types/index.ts` - EntityId、ComponentType、GameState列挙、EnemyType列挙、WeaponType列挙、EffectType列挙、UpgradeCategory列挙、Position、Velocity、Weapon、WeaponState、PassiveSkills、ScoreData、UpgradeChoice、SpawnConfig、HUDState、System インターフェース

**設計根拠**: domain-entities.md の6エンティティ、6値オブジェクト、5列挙型を型定義

---

## Step 4: ECSコアフレームワーク（ecs/）
- [x] `src/ecs/Component.ts` - Component基底クラス/インターフェース
- [x] `src/ecs/Entity.ts` - Entity型定義（id + components Map）
- [x] `src/ecs/System.ts` - Systemインターフェース（update メソッド）
- [x] `src/ecs/World.ts` - Worldクラス（エンティティ管理、コンポーネントCRUD、クエリ、システム管理、update）

**設計根拠**: component-methods.md の World/Entity インターフェース定義に基づく

---

## Step 5: コンポーネント定義（components/）
- [x] `src/components/PositionComponent.ts` - C-01: x, y座標
- [x] `src/components/VelocityComponent.ts` - C-02: vx, vy速度
- [x] `src/components/SpriteComponent.ts` - C-03: 描画情報（タイプ、幅、高さ、色）
- [x] `src/components/HealthComponent.ts` - C-04: 現在HP、最大HP
- [x] `src/components/ColliderComponent.ts` - C-05: 半径、判定タイプ
- [x] `src/components/PlayerComponent.ts` - C-06: 移動速度、無敵状態
- [x] `src/components/EnemyComponent.ts` - C-07: 敵タイプ、突破ダメージ、XPドロップ量
- [x] `src/components/BulletComponent.ts` - C-08: ダメージ、貫通フラグ、所有者ID、貫通済みリスト
- [x] `src/components/WeaponComponent.ts` - C-09: 武器タイプ、レベル、発射間隔
- [x] `src/components/WeaponInventoryComponent.ts` - C-13: 武器スロット配列（最大3）
- [x] `src/components/AllyComponent.ts` - C-10: オフセット位置、追従対象ID
- [x] `src/components/XPDropComponent.ts` - C-11: XP量、生存時間
- [x] `src/components/EffectComponent.ts` - C-14: エフェクトタイプ、残存時間、アニメーション状態
- [x] `src/components/PassiveSkillsComponent.ts` - C-12: パッシブスキルレベル群

**設計根拠**: components.md の14コンポーネント型定義に基づく

---

## Step 6: エンティティファクトリ（factories/）
- [x] `src/factories/EntityFactory.ts` - createPlayer, createEnemy, createBullet, createXPDrop, createAlly, createEffect

**設計根拠**: services.md S-SVC-03 EntityFactory のメソッドシグネチャ

---

## Step 7: ゲーム状態管理・スコア（game/）
- [x] `src/game/GameStateManager.ts` - M-01: ゲーム状態遷移管理（TITLE/PLAYING/LEVEL_UP/GAME_OVER）、状態遷移制約（BR-ST01）
- [x] `src/game/ScoreService.ts` - S-SVC-02: 生存時間、撃破数、到達レベルの追跡

**設計根拠**: component-methods.md M-01, services.md S-SVC-02

---

## Step 8: マネージャー（managers/）
- [x] `src/managers/WaveManager.ts` - M-02: ウェーブ進行、スポーン設定取得、ボス出現判定
- [x] `src/managers/SpawnManager.ts` - M-03: 敵エンティティ生成、敵数上限管理（200体）
- [x] `src/managers/LevelUpManager.ts` - M-04: XP管理、レベルアップ判定、選択肢生成、選択検証・適用（BR-G01〜G06）
- [x] `src/managers/AssetManager.ts` - M-06: アセットロード（プレースホルダー実装、ドット絵はコード描画）

**設計根拠**: component-methods.md M-02〜M-06、business-logic-model.md セクション7-8

---

## Step 9: 入力ハンドラー（input/）
- [x] `src/input/InputHandler.ts` - キーボード入力（A/D、矢印キー）、タッチ入力（左右ボタン、水平スワイプ）、モバイル判定、入力バリデーション（BR-V01）

**設計根拠**: component-methods.md S-01 InputSystem、business-rules.md BR-V01

---

## Step 10: システム - 移動系（systems/）
- [x] `src/systems/InputSystem.ts` - S-01: InputHandlerからの入力をPlayerComponentに反映（優先度1）
- [x] `src/systems/PlayerMovementSystem.ts` - S-03: プレイヤー左右移動、パッシブ速度補正、画面境界制限（優先度2）
- [x] `src/systems/MovementSystem.ts` - S-02: Velocity×dtでPosition更新（敵・弾丸用）（優先度2）
- [x] `src/systems/AllyFollowSystem.ts` - S-04: 仲間のプレイヤー追従、画面境界制限（優先度3）

**設計根拠**: business-logic-model.md セクション2-3, 9

---

## Step 11: システム - 戦闘系（systems/）
- [x] `src/systems/WeaponSystem.ts` - S-05: オート射撃、ターゲティング、弾丸生成、弾丸数上限管理（優先度4）
- [x] `src/systems/CollisionSystem.ts` - S-06: 弾丸-敵衝突判定（距離二乗比較）、ダメージ適用、貫通弾管理（優先度5）
- [x] `src/systems/DefenseLineSystem.ts` - S-07: 防衛ライン到達判定、突破ダメージ適用（優先度6）
- [x] `src/systems/HealthSystem.ts` - S-08: 無敵時間カウントダウン、HP0判定→ゲームオーバー（優先度7）

**設計根拠**: business-logic-model.md セクション4-6

---

## Step 12: システム - 回収・クリーンアップ・エフェクト（systems/）
- [x] `src/systems/XPCollectionSystem.ts` - S-09: XPアイテム回収、パッシブ補正適用（優先度8）
- [x] `src/systems/EffectSystem.ts` - S-12: エフェクトライフサイクル管理、同時エフェクト上限（優先度97）
- [x] `src/systems/CleanupSystem.ts` - S-11: 画面外エンティティ破棄、XPDrop寿命・上限管理（優先度98）

**設計根拠**: business-logic-model.md セクション10, components.md S-12

---

## Step 13: システム - 描画（systems/）
- [x] `src/systems/RenderSystem.ts` - S-10: Canvas 2D描画、レイヤー順描画、レターボックス、devicePixelRatio対応、カリング、デバッグオーバーレイ、プレイヤー無敵時点滅（優先度99）

**設計根拠**: component-methods.md S-10、business-logic-model.md セクション14-15

---

## Step 14: UI（ui/）
- [x] `src/ui/UIManager.ts` - M-05: UI全体の統括、各画面の表示切替
- [x] `src/ui/HUD.ts` - HPバー、XPバー、レベル表示、タイマー、撃破数表示（business-logic-model.md 15.1-15.5）
- [x] `src/ui/TitleScreen.ts` - タイトル画面、ゲーム開始ボタン（FR-06）
- [x] `src/ui/LevelUpScreen.ts` - レベルアップ選択画面、3択カード表示（business-logic-model.md 15.6）
- [x] `src/ui/GameOverScreen.ts` - ゲームオーバー画面、スコア表示、リトライボタン（business-logic-model.md 15.7）

**設計根拠**: business-logic-model.md セクション15、component-methods.md M-05

---

## Step 15: ゲームサービス（game/）
- [x] `src/game/GameService.ts` - S-SVC-01: メインオーケストレーター、ゲームループ（requestAnimationFrame）、deltaTimeクランプ、状態遷移に応じた処理分岐、エラーハンドリング、デバッグオーバーレイ

**設計根拠**: services.md S-SVC-01、business-logic-model.md セクション1, 11

---

## Step 16: エントリポイント
- [x] `src/index.ts` - Canvas取得、GameService初期化・起動
- [x] `index.html` 最終調整（Step 1で作成済みの更新）

---

## Step 17: ビルド・CI/CD設定
- [x] `vite.config.ts` 最終調整
- [x] `.github/workflows/ci.yml` - GitHub Actions（Lint → Build → Test → Security）
- [x] `jest.config.ts` - Jest設定（TypeScript対応）

**設計根拠**: services.md CI/CDパイプライン設計（NFR-09）

---

## Step 18: ユニットテスト - ECSコア・設定
- [x] `tests/ecs/World.test.ts` - World のエンティティ/コンポーネント/システム管理テスト
- [x] `tests/config/gameConfig.test.ts` - 設定値の妥当性テスト（負数、ゼロ除算防止）

---

## Step 19: ユニットテスト - システム
- [x] `tests/systems/CollisionSystem.test.ts` - 弾丸-敵衝突判定、貫通弾、命中時処理
- [x] `tests/systems/DefenseLineSystem.test.ts` - 防衛ライン到達、ダメージ適用、無敵時挙動
- [x] `tests/systems/WeaponSystem.test.ts` - 発射間隔、弾丸数上限、ターゲティング
- [x] `tests/systems/PlayerMovementSystem.test.ts` - 移動計算、画面境界制限、パッシブ補正

---

## Step 20: ユニットテスト - マネージャー
- [x] `tests/managers/WaveManager.test.ts` - ウェーブ進行、敵タイプ選択、ボス出現判定
- [x] `tests/managers/LevelUpManager.test.ts` - XP判定、選択肢生成ルール、選択検証、HP回復
- [x] `tests/managers/SpawnManager.test.ts` - 敵数上限管理、スポーン位置ランダム化

---

## Step 21: ドキュメント生成
- [x] `aidlc-docs/construction/game-app/code/code-generation-summary.md` - 実装サマリー（作成ファイル一覧、テストカバレッジ）

---

## 依存関係

```
Step 1 (基盤)
  ↓
Step 2 (設定) ← Step 3 (型定義)
  ↓
Step 4 (ECSコア)
  ↓
Step 5 (コンポーネント)
  ↓
Step 6 (ファクトリ)
  ↓
Step 7 (状態管理) + Step 8 (マネージャー) + Step 9 (入力)
  ↓
Step 10〜13 (システム群) ← 並列実装可能
  ↓
Step 14 (UI)
  ↓
Step 15 (GameService統合)
  ↓
Step 16 (エントリポイント)
  ↓
Step 17 (CI/CD)
  ↓
Step 18〜20 (テスト) ← 並列実装可能
  ↓
Step 21 (ドキュメント)
```

## 見積

- **総ステップ数**: 21ステップ
- **生成ファイル数**: 約50ファイル（ソース約35 + テスト約8 + 設定約7）
- **テスト対象**: ECSコア、主要システム（Collision, Defense, Weapon, Movement）、マネージャー（Wave, LevelUp, Spawn）
