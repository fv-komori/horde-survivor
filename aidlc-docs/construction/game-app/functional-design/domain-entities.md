# ドメインエンティティ定義

## 概要
ラストウォー型ディフェンスシューティングゲームのドメインモデル。
技術非依存でゲームドメインのエンティティ・値オブジェクト・関係を定義する。

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

### E-04: ItemDrop（スポーンアイテム）
画面上部から一定間隔でスポーンし、下方向に移動するパワーアップアイテムまたは武器アイテム。プレイヤーが弾丸を当てて破壊することで効果を得る。敵からのドロップではなく、独立したスポーンシステムにより生成される。

| 属性 | 型 | 説明 | 初期値 |
|------|-----|------|--------|
| position | Position | 現在座標 | 画面上部のランダムX位置 |
| velocity | Velocity | 移動速度（下方向） | (0, 70) |
| itemType | ItemType | アイテム種類 | ランダム選択 |
| hitCount | number | 残りヒットカウント | 8 |
| maxHitCount | number | 最大ヒットカウント | 8 |
| colliderRadius | number | 衝突判定半径(px) | 20 |

**蓄積制限**:
- 画面内アイテム上限: 50個。上限到達時は新規スポーンを抑制。

**ライフサイクル**: アイテムは画面上部からスポーンし、下方向に70px/秒で移動する。弾丸を8発命中させると破壊され、バフまたは武器が適用される。防衛ラインを通過した場合はダメージなしで消滅する。

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

---

## 3. 列挙型

### GameState（ゲーム状態）
```
TITLE      - タイトル画面
PLAYING    - ゲームプレイ中
GAME_OVER  - ゲームオーバー
```

### EnemyType（敵タイプ）
| タイプ | ヒット数 | 速度(px/秒) | 突破ダメージ | アイテムドロップ率 | 武器ドロップ率 | 仲間化率 | 半径(px) |
|--------|---------|------------|-------------|-----------------|--------------|---------|---------|
| NORMAL | 20 | 100 | 10 | 30% | 5% | 10% | 60 |
| FAST | 10 | 200 | 8 | 35% | 5% | 8% | 60 |
| TANK | 60 | 50 | 15 | 50% | 5% | 5% | 80 |
| BOSS | 500+ | 30 | 30 | 100%(2〜3個) | 5% | 0% | 110 |

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
ItemDrop (*) ---- (1) ItemType          [アイテム種類]
Enemy  (*) ---> (0..1) Ally            [撃破時仲間化]

Bullet (*) ---> (0..1) Enemy           [命中判定: ヒットカウント減算]
Bullet (*) ---> (0..1) ItemDrop        [命中判定: アイテムヒットカウント減算]
Bullet (*) ---- (1) WeaponType         [発射元武器タイプ]

ItemDrop (*) ---> (1) Player           [破壊時→バフ適用/武器切替]
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
| 敵スポーン領域 | Y = -50〜-10, X = 160〜560 | 画面上部外（左右マージン160px） |
| アイテムスポーン間隔 | 15秒 | 画面上部からのアイテム出現間隔 |
| アイテム移動速度 | 70px/秒 | アイテムの下方向移動速度 |
| アイテム破壊ヒット数 | 8 | アイテム破壊に必要な弾丸命中数 |
