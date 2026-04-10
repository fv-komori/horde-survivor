# Code Generation Plan — Iteration 2

## 概要
Iteration 1の既存コードをIteration 2仕様（ヒットカウント制、アイテムドロップ/バフ、仲間化システム）に改修する。
既存ファイルのin-place修正を基本とし、不要ファイルは削除、新規ファイルは追加する。

## 変更方針
- **Brownfield**: 既存src/配下のファイルをin-place修正
- **コードパス**: /Users/komori/fv-genai-specialforce/fv-game/src/
- **テスト**: /Users/komori/fv-genai-specialforce/fv-game/tests/
- **参照設計書**: aidlc-docs/construction/game-app/functional-design/ (domain-entities, business-rules, business-logic-model)

## ファイル変更一覧

### 削除するファイル（Iteration 1で不要になったもの）
- src/components/PassiveSkillsComponent.ts
- src/components/WeaponInventoryComponent.ts
- src/components/XPDropComponent.ts
- src/managers/LevelUpManager.ts
- src/systems/XPCollectionSystem.ts
- src/ui/LevelUpScreen.ts

### 新規作成するファイル
- src/components/HitCountComponent.ts
- src/components/ItemDropComponent.ts
- src/components/BuffComponent.ts
- src/systems/ItemCollectionSystem.ts
- src/systems/BuffSystem.ts
- src/systems/AllyConversionSystem.ts
- src/systems/AllyFireRateSystem.ts
- src/managers/ItemDropManager.ts
- src/config/itemConfig.ts

### 修正するファイル（主要変更）
- src/types/index.ts — 型定義全面更新
- src/config/gameConfig.ts — パラメータ更新
- src/config/enemyConfig.ts — ヒットカウント化
- src/config/weaponConfig.ts — レベル廃止、固定パラメータ
- src/config/waveConfig.ts — XPテーブル削除、Iteration 2ウェーブ定義
- src/components/EnemyComponent.ts — xpDrop→ドロップ確率/仲間化率
- src/components/BulletComponent.ts — damage→hitCountReduction
- src/components/AllyComponent.ts — joinTime/fireRateBonus追加
- src/components/WeaponComponent.ts — level削除
- src/factories/EntityFactory.ts — 全ファクトリメソッド更新
- src/systems/CollisionSystem.ts — ヒットカウント制+撃破キュー
- src/systems/WeaponSystem.ts — 単一武器+バフ効果
- src/systems/PlayerMovementSystem.ts — パッシブ→バフ参照
- src/systems/HealthSystem.ts — 無敵時間削除
- src/systems/DefenseLineSystem.ts — 無敵チェック削除
- src/systems/AllyFollowSystem.ts — 動的間隔
- src/systems/RenderSystem.ts — ヒットカウント描画+アイテム描画+Zオーダー
- src/systems/CleanupSystem.ts — アイテム対応
- src/managers/WaveManager.ts — Iteration 2ウェーブ定義
- src/managers/SpawnManager.ts — 300体上限+同時スポーン
- src/game/GameService.ts — LEVEL_UP廃止+新システム登録
- src/game/GameStateManager.ts — LEVEL_UP削除
- src/game/ScoreService.ts — level→allyCount
- src/ui/HUD.ts — バフ表示+仲間数+武器アイコン
- src/ui/UIManager.ts — LevelUpScreen削除
- src/ui/GameOverScreen.ts — スコア表示更新
- src/index.ts — 必要に応じて更新

---

## 実行ステップ

### Step 1: 型定義・設定ファイル更新
- [ ] src/types/index.ts — GameState(LEVEL_UP削除)、BuffType/ItemType追加、PassiveSkills/UpgradeChoice削除、ScoreData更新、HUDState更新
- [ ] src/config/gameConfig.ts — xpCollection/passiveSkills/levelUp/xpDrop削除、item/buff/ally設定追加、limits更新(300/200/50)、invincible削除
- [ ] src/config/enemyConfig.ts — hp→hitCount、xpDrop→itemDropRate/weaponDropRate/conversionRate
- [ ] src/config/weaponConfig.ts — レベル別パラメータ→固定パラメータ(FORWARD/SPREAD/PIERCING)
- [ ] src/config/waveConfig.ts — XP_TABLE削除、Iteration 2ウェーブ定義(短縮間隔/同時スポーン/ヒット数スケーリング)
- [ ] src/config/itemConfig.ts — 新規: アイテムドロップ確率、バフ効果、武器パラメータ

### Step 2: コンポーネント更新・新規作成
- [ ] src/components/HitCountComponent.ts — 新規: currentHits, maxHits, flashTimer
- [ ] src/components/ItemDropComponent.ts — 新規: itemType, remainingTime, isBlinking
- [ ] src/components/BuffComponent.ts — 新規: activeBuffs Map<BuffType, {remainingTime}>
- [ ] src/components/EnemyComponent.ts — xpDrop削除、itemDropRate/weaponDropRate/conversionRate追加
- [ ] src/components/BulletComponent.ts — damage→hitCountReduction、piercedEntities→hitEntities
- [ ] src/components/AllyComponent.ts — offsetX→allyIndex、joinTime/fireRateBonus追加
- [ ] src/components/WeaponComponent.ts — level削除
- [ ] 旧コンポーネント削除: PassiveSkillsComponent, WeaponInventoryComponent, XPDropComponent

### Step 3: EntityFactory更新
- [ ] src/factories/EntityFactory.ts — createPlayer(PassiveSkills/WeaponInventory削除、BuffComponent追加)、createEnemy(HitCountComponent追加)、createBullet(hitCountReduction)、createXPDrop→createItemDrop、createAlly(joinTime/fireRateBonus)

### Step 4: 新規システム作成
- [ ] src/systems/ItemCollectionSystem.ts — マグネット引き寄せ、回収判定、バフ適用/武器切替
- [ ] src/systems/BuffSystem.ts — バフ時間管理、失効処理
- [ ] src/systems/AllyConversionSystem.ts — 撃破時仲間化判定、仲間エンティティ生成
- [ ] src/systems/AllyFireRateSystem.ts — 仲間の連射速度時間経過強化

### Step 5: 新規マネージャー作成
- [ ] src/managers/ItemDropManager.ts — アイテムドロップ判定、タイプ選択、上限管理

### Step 6: 既存システム改修（コア戦闘）
- [ ] src/systems/CollisionSystem.ts — HP→ヒットカウント減算、撃破キュー(defeatedEnemies)導入、ItemDropManager/AllyConversionSystem/ScoreService連携
- [ ] src/systems/WeaponSystem.ts — WeaponInventory→単一WeaponComponent、パッシブ→バフ参照、仲間のfireRateBonus適用、弾丸上限200

### Step 7: 既存システム改修（その他）
- [ ] src/systems/PlayerMovementSystem.ts — PassiveSkills→BuffComponent(SPEED_UP)参照
- [ ] src/systems/HealthSystem.ts — 無敵時間(invincibleTimer)削除
- [ ] src/systems/DefenseLineSystem.ts — 無敵チェック削除
- [ ] src/systems/AllyFollowSystem.ts — 固定offset→動的間隔(allyIndex)
- [ ] src/systems/CleanupSystem.ts — XPDrop→ItemDrop対応
- [ ] src/systems/EffectSystem.ts — 新エフェクトタイプ対応(BUFF_ACTIVATE, ALLY_CONVERT)

### Step 8: マネージャー改修
- [ ] src/managers/WaveManager.ts — Iteration 2ウェーブ定義、ヒット数スケーリング(+10%/30秒)、ボス出現90秒間隔、同時スポーン数
- [ ] src/managers/SpawnManager.ts — 敵上限300体、同時スポーン最大5体/回、HitCountComponent付与

### Step 9: 描画システム改修
- [ ] src/systems/RenderSystem.ts — Zオーダー(8レイヤー)、ヒットカウント数字描画(ビットマップフォント)、アイテム描画、仲間化エフェクト、バフエフェクト、DPR対応

### Step 10: UI改修
- [ ] src/ui/HUD.ts — XPバー/レベル削除、バフアイコン+残り時間バー、仲間数表示、武器アイコン
- [ ] src/ui/UIManager.ts — LevelUpScreen削除
- [ ] src/ui/GameOverScreen.ts — level→allyCount

### Step 11: ゲームオーケストレーター改修
- [ ] src/game/GameStateManager.ts — LEVEL_UP状態削除
- [ ] src/game/ScoreService.ts — level→allyCount
- [ ] src/game/GameService.ts — LEVEL_UP処理削除、新システム登録(ItemCollection/Buff/AllyConversion/AllyFireRate)、LevelUpManager→ItemDropManager

### Step 12: 旧ファイル削除・エントリポイント更新
- [ ] 旧ファイル削除: LevelUpManager.ts, LevelUpScreen.ts, PassiveSkillsComponent.ts, WeaponInventoryComponent.ts, XPDropComponent.ts, XPCollectionSystem.ts
- [ ] src/index.ts — 必要に応じてimport更新

### Step 13: テスト更新
- [ ] 既存テストの更新（XP/レベルアップ関連テスト削除・書き換え）
- [ ] 新規テスト追加: HitCountComponent, ItemDropComponent, BuffComponent, CollisionSystem(ヒットカウント制), ItemCollectionSystem, BuffSystem, AllyConversionSystem, AllyFireRateSystem, ItemDropManager, WeaponSystem(バフ適用)

### Step 14: ビルド・型チェック確認
- [ ] TypeScript型チェック（tsc --noEmit）
- [ ] ESLint
- [ ] テスト実行（jest）
- [ ] 本番ビルド（vite build）

### Step 15: コード生成サマリー
- [ ] aidlc-docs/construction/game-app/code/code-generation-summary-v2.md に変更サマリーを出力

---

## ストーリーマッピング

| ステップ | 関連US |
|---------|--------|
| Step 1-2 | 基盤（全US共通） |
| Step 3 | US-02(初期化), US-05(敵生成), US-09(アイテム), US-12(仲間化) |
| Step 4 | US-09(アイテム回収), US-10(バフ), US-12(仲間化), US-13(仲間強化) |
| Step 5 | US-09(ドロップ判定) |
| Step 6 | US-04(射撃), US-07(ヒットカウント), US-09(撃破→ドロップ) |
| Step 7 | US-03(移動), US-06(防衛ライン), US-05(敵出現) |
| Step 8 | US-05(敵出現), US-14(ウェーブ), US-15(ボス) |
| Step 9 | US-07(ヒットカウント表示), US-08(HUD), US-09(アイテム描画) |
| Step 10 | US-08(HUD), US-16(ゲームオーバー) |
| Step 11 | US-02(ゲーム開始), US-16(ゲームオーバー), US-17(リトライ) |
| Step 13 | US-20(パフォーマンス), US-21(エラー復旧), US-22(バランス調整) |

## 見積もり
- 修正対象: 約35ファイル（削除6 + 新規9 + 修正約20）
- テスト: 約10スイート
- 総ステップ数: 15
