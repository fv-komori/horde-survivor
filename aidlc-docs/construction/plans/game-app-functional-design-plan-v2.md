# Functional Design Plan — Iteration 2

## 概要
Iteration 1の機能設計をIteration 2の仕様に全面更新する。
主な変更: HP制→ヒットカウント制、XP/レベルアップ→アイテムドロップ/バフ、仲間化システム追加

## Q&A結果
- 無敵時間: 削除（防衛ライン突破のたびにダメージ）
- バフ演出: シンプル（バフ色リング拡大、0.3秒）
- 仲間化演出: 色変化→縮小消滅→プレイヤー横に再出現

## 更新計画

### Step 1: domain-entities.md 更新
- [x] E-01 Player: level/xp/invincible/passiveSkills/weaponInventory削除、weapon(単一)/activeBuffs追加
- [x] E-02 Enemy: hp/maxHp/xpDrop削除 → hitCount/maxHitCount/itemDropRate/weaponDropRate/conversionRate追加
- [x] E-03 Bullet: damage削除 → hitCountReduction/piercing/hitEntities追加
- [x] E-04 XPDrop → ItemDrop: 全面置換（itemType/remainingTime/isBlinking）
- [x] E-05 Ally: joinTime/fireRateBonus追加、動的間隔配置
- [x] E-06 Effect: buff_activate/ally_convert追加
- [x] 値オブジェクト: PassiveSkills/UpgradeChoice廃止、BuffState追加
- [x] 列挙型: LEVEL_UP/UpgradeCategory廃止、BuffType/ItemType追加
- [x] エンティティ関係図・ゲーム空間: Iteration 2用に更新

### Step 2: business-rules.md 更新
- [x] BR-P03(無敵): 削除
- [x] BR-P03(速度計算): パッシブ→バフ参照に変更
- [x] BR-W01〜W03(武器): 単一武器制に全面改訂
- [x] BR-W04(弾丸上限): 200発に引き上げ
- [x] BR-W07(ヒットカウント減算): 新規追加
- [x] BR-HC01〜HC04(ヒットカウント): 新規セクション追加
- [x] BR-ID01〜ID06(アイテムドロップ): 新規セクション追加
- [x] BR-BF01〜BF06(バフ): 新規セクション追加
- [x] BR-AL01〜AL05(仲間化): 全面改訂
- [x] BR-E02〜E04(敵): 300体上限、ヒットカウントスケーリング
- [x] BR-S03(エンティティ上限): 全数値更新
- [x] BR-ST01(状態遷移): LEVEL_UP廃止
- [x] BR-SC01(スコア): level→allyCount

### Step 3: business-logic-model.md 更新
- [x] セクション1(ゲームループ): 15ステップに更新
- [x] セクション1.2(状態遷移): LEVEL_UP廃止
- [x] セクション2(プレイヤー移動): バフ速度補正
- [x] セクション4(武器): 単一武器・固定パラメータ・バフ効果
- [x] セクション5(衝突判定): ヒットカウント制+撃破キュー
- [x] セクション6(防衛ライン): 無敵削除
- [x] セクション7(成長ロジック): XP/レベルアップ→アイテム回収/バフ/武器切替/仲間化に全面置換
- [x] セクション8(ウェーブ): Iteration 2定義に更新
- [x] セクション9(仲間配置): 動的間隔+連射速度強化
- [x] セクション10(クリーンアップ): アイテム消滅対応
- [x] セクション15(UI): HUD全面更新（バフ/仲間数/武器アイコン/ヒットカウント）
