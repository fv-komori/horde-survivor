# ドメインエンティティ定義

## 概要
ラストウォー型ディフェンスシューティングゲームのドメインモデル（Iteration 2）。
技術非依存でゲームドメインのエンティティ・値オブジェクト・関係を定義する。

**Iteration 2 変更概要**: HP制→ヒットカウント制、XP/レベルアップ→アイテムドロップ/バフ、仲間化システム追加

---

## 1. エンティティ

### E-01: Player（プレイヤー）
ゲームの主人公。画面下部で左右移動し、オート射撃で敵を迎撃する。

| 属性 | 型 | 説明 | 初期値 |
|------|-----|------|--------|
| position | Position | 画面上の座標 | (360, 1100) 画面下部中央 |
| hp | number | 現在HP | 100 |
| maxHp | number | 最大HP | 100 |
| baseSpeed | number | 基本移動速度(px/秒) | 200 |
| moveDirection | number | 移動方向(-1/0/+1) | 0 |
| weapon | WeaponType | 現在装備中の武器タイプ | FORWARD |
| activeBuffs | Map\<BuffType, BuffState\> | アクティブなバフ一覧 | 空Map |
| allyCount | number | 現在の仲間数 | 0 |
| colliderRadius | number | 衝突判定半径(px) | 72 |

**Iteration 1からの変更**: level/xp/isInvincible/invincibleTimer/weaponInventory/passiveSkills を削除。weapon(単一WeaponType)とactiveBuffsを追加。

### E-02: Enemy（敵）
画面上方からスポーンし、真下に直進するゲームの敵。

| 属性 | 型 | 説明 |
|------|-----|------|
| position | Position | 画面上の座標 |
| enemyType | EnemyType | 敵タイプ(通常/高速/タンク/ボス) |
| hitCount | number | 残りヒットカウント |
| maxHitCount | number | 最大ヒットカウント |
| speed | number | 移動速度(px/秒) |
| breachDamage | number | 防衛ライン突破時のダメージ |
| itemDropRate | number | アイテムドロップ確率(0.0〜1.0) |
| weaponDropRate | number | 武器アイテムドロップ確率(0.0〜1.0) |
| conversionRate | number | 仲間化確率(0.0〜1.0) |
| colliderRadius | number | 衝突判定半径(px) |
| flashTimer | number | 被弾フラッシュ残り時間(秒)。0以上で赤点滅表示 |

**Iteration 1からの変更**: hp/maxHp/xpDrop を削除。hitCount/maxHitCount/itemDropRate/weaponDropRate/conversionRate/flashTimer を追加。

### E-03: Bullet（弾丸）
プレイヤーまたは仲間が発射する投射物。

| 属性 | 型 | 説明 |
|------|-----|------|
| position | Position | 現在座標 |
| velocity | Velocity | 移動速度・方向 |
| hitCountReduction | number | 1命中あたりのヒットカウント減算値（通常1、攻撃UPバフ時2） |
| isPiercing | boolean | 貫通フラグ |
| colliderRadius | number | 衝突判定半径(px)。固定値 8 |
| ownerId | EntityId | 発射元エンティティ |
| hitEntities | Set\<EntityId\> | 貫通弾の命中済み敵IDセット |

**Iteration 1からの変更**: damage を削除。hitCountReduction/hitEntities を追加。

### E-04: ItemDrop（ドロップアイテム）
敵撃破時にドロップするパワーアップアイテムまたは武器アイテム。マグネット範囲（1500px）内のアイテムはプレイヤーに向かって自動的に引き寄せられる。

| 属性 | 型 | 説明 | 初期値 |
|------|-----|------|--------|
| position | Position | ドロップ位置 | 敵撃破位置 |
| itemType | ItemType | アイテム種類 | ドロップ判定による |
| remainingTime | number | 残り生存時間(秒) | 10.0 |
| isBlinking | boolean | 消滅前点滅フラグ | false |

**蓄積制限**:
- 画面内アイテム上限: 50個。上限到達時は新規ドロップを抑制。
- 自動消滅: 生成から10秒経過で自動消滅（残り3秒で点滅警告）。

**Iteration 1からの変更**: XPDrop(E-04)を全面置換。xpAmount→itemType、lifetime 15秒→10秒、上限100→50。

### E-05: Ally（仲間）
敵撃破時に確率で仲間に転換され、プレイヤーの左右に配置されてオート射撃する仲間キャラクター。

| 属性 | 型 | 説明 |
|------|-----|------|
| position | Position | 現在座標 |
| followTarget | EntityId | 追従対象(プレイヤー) |
| allyIndex | number | 配置インデックス（動的間隔計算に使用） |
| weapon | WeaponType | 装備武器(FORWARD固定) |
| joinTime | number | 仲間化した時刻(ゲーム経過秒) |
| fireRateBonus | number | 連射速度ボーナス(%)。0〜100 |
| spriteHalfWidth | number | 描画半幅(px)。画面境界制限に使用。初期値 75 |

**ライフサイクル**: 仲間はゲームオーバーまで存続し、プレイ中の離脱・死亡は発生しない（HP概念なし、ダメージを受けない）。

**Iteration 1からの変更**: offsetX(固定値)→allyIndex(動的計算)に変更。joinTime/fireRateBonus を追加。最大4体→最大10体。

### E-06: Effect（エフェクト）
射撃・撃破・バフ・仲間化時の視覚演出。

| 属性 | 型 | 説明 |
|------|-----|------|
| position | Position | 表示座標 |
| effectType | EffectType | エフェクト種類 |
| duration | number | 表示時間(秒) |
| elapsed | number | 経過時間(秒) |
| currentFrame | number | 現在のアニメフレーム |
| color | string | エフェクト色（バフ演出で使用） |

---

## 2. 値オブジェクト

### VO-01: Position（座標）
| 属性 | 型 | 説明 |
|------|-----|------|
| x | number | X座標(px, 論理解像度) |
| y | number | Y座標(px, 論理解像度) |

### VO-02: Velocity（速度ベクトル）
| 属性 | 型 | 説明 |
|------|-----|------|
| vx | number | X方向速度(px/秒) |
| vy | number | Y方向速度(px/秒) |

### VO-03: Weapon（武器定義）
| 属性 | 型 | 説明 |
|------|-----|------|
| weaponType | WeaponType | 武器タイプ |
| fireInterval | number | 基本発射間隔(秒) |
| bulletCount | number | 1回の弾数 |
| bulletSpeed | number | 弾速(px/秒) |
| spreadAngle | number | 拡散角度(度)。0=直線 |
| isPiercing | boolean | 貫通フラグ |

**Iteration 1からの変更**: level(1-5)を削除。武器パラメータはタイプごとに固定値（レベルアップなし）。

### VO-04: BuffState（バフ状態）
| 属性 | 型 | 説明 |
|------|-----|------|
| buffType | BuffType | バフ種類 |
| remainingTime | number | 残り効果時間(秒) |

### VO-05: ScoreData（スコアデータ）
| 属性 | 型 | 説明 |
|------|-----|------|
| survivalTime | number | 生存時間(秒) |
| killCount | number | 撃破数 |
| allyCount | number | 最終仲間数 |

**Iteration 1からの変更**: level を削除、allyCount を追加。

---

## 3. 列挙型

### GameState（ゲーム状態）
```
TITLE      - タイトル画面
PLAYING    - ゲームプレイ中
GAME_OVER  - ゲームオーバー
```
**Iteration 1からの変更**: LEVEL_UP を廃止。

### EnemyType（敵タイプ）
| タイプ | ヒット数 | 速度(px/秒) | 突破ダメージ | アイテムドロップ率 | 武器ドロップ率 | 仲間化率 | 半径(px) |
|--------|---------|------------|-------------|-----------------|--------------|---------|---------|
| NORMAL | 5 | 100 | 10 | 30% | 5% | 10% | 60 |
| FAST | 2 | 200 | 8 | 35% | 5% | 8% | 60 |
| TANK | 15 | 50 | 15 | 50% | 5% | 5% | 80 |
| BOSS | 100+ | 30 | 30 | 100%(2〜3個) | 5% | 0% | 110 |

**Iteration 1からの変更**: HP→ヒット数。XPドロップ量→アイテムドロップ率/武器ドロップ率/仲間化率に置換。

### WeaponType（武器タイプ）
```
FORWARD    - 前方射撃（初期装備）: 連射速度 高（間隔0.15秒）
SPREAD     - 拡散射撃: 連射速度 中（間隔0.25秒）、扇状3発
PIERCING   - 貫通弾: 連射速度 低（間隔0.4秒）、敵を貫通
```

### BuffType（バフタイプ）
| バフ | 効果 | アイコン色 |
|------|------|----------|
| ATTACK_UP | 1弾で2カウント減算（通常は1） | 赤 |
| FIRE_RATE_UP | 発射間隔0.5倍（2倍速射撃） | 黄 |
| SPEED_UP | 移動速度1.5倍 | 青 |
| BARRAGE | 弾数3倍+拡散角度拡大 | 紫 |

### ItemType（アイテムタイプ）
```
パワーアップアイテム:
  ATTACK_UP      - 攻撃力UPバフ
  FIRE_RATE_UP   - 発射速度UPバフ
  SPEED_UP       - 移動速度UPバフ
  BARRAGE        - 弾幕モードバフ

武器アイテム:
  WEAPON_SPREAD  - 拡散射撃
  WEAPON_PIERCING - 貫通弾
```

### EffectType（エフェクトタイプ）
```
MUZZLE_FLASH    - 射撃エフェクト
ENEMY_DESTROY   - 敵撃破エフェクト
BUFF_ACTIVATE   - バフ発動エフェクト（バフ色リング拡大、0.3秒）
ALLY_CONVERT    - 仲間化エフェクト（色変化→縮小消滅→再出現、0.5秒）
```

---

## 4. エンティティ関係図

```
Player (1) ---- (1) WeaponType         [現在装備（単一）]
Player (1) ---- (0..*) BuffState       [アクティブバフ]
Player (1) ----< (0..10) Ally          [仲間]
Player (1) ---- (1) ScoreData          [成績追跡]

Ally   (1) ---- (1) WeaponType         [固定武器: FORWARD]

Enemy  (*) ---- (1) EnemyType          [タイプ定義]
Enemy  (*) ---> (*) ItemDrop           [撃破時ドロップ]
Enemy  (*) ---> (0..1) Ally            [撃破時仲間化]

Bullet (*) ---> (0..1) Enemy           [命中判定: ヒットカウント減算]
Bullet (*) ---- (1) WeaponType         [発射元武器タイプ]

ItemDrop (*) ---> (1) Player           [回収→バフ適用/武器切替]
```

---

## 5. ゲーム空間定義

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| 論理幅 | 720px | ゲーム空間の幅 |
| 論理高さ | 1280px | ゲーム空間の高さ |
| アスペクト比 | 9:16（縦型） | モバイルファースト |
| プレイヤー初期位置 | (360, 1100) | 画面下部中央 |
| 防衛ライン位置 | Y = 1248 | 画面下端から32px上 |
| 敵スポーン領域 | Y = -50〜-10, X = 100〜620 | 画面上部外（左右マージン100px） |
| アイテム回収半径 | 80px | プレイヤー中心からの即座回収距離 |
| アイテムマグネット半径 | 1500px | 引き寄せ開始距離（画面全体カバー） |
| アイテムマグネット速度 | 500px/秒 | 引き寄せ移動速度 |
| アイテム生存時間 | 10秒 | 未回収時の自動消滅時間 |
| アイテム点滅開始 | 残り3秒 | 消滅前の点滅警告 |
