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
| level | number | 現在レベル | 1 |
| xp | number | 現在の累積XP | 0 |
| isInvincible | boolean | 無敵状態フラグ | false |
| invincibleTimer | number | 無敵残り時間(秒) | 0 |
| moveDirection | number | 移動方向(-1/0/+1) | 0 |
| weaponInventory | Weapon[] | 装備中の武器リスト | [前方射撃Lv1] |
| passiveSkills | PassiveSkills | パッシブスキルレベル群 | 全てLv0 |
| allyCount | number | 現在の仲間数 | 0 |
| colliderRadius | number | 衝突判定半径(px) | 72 |

### E-02: Enemy（敵）
画面上方からスポーンし、真下に直進するゲームの敵。

| 属性 | 型 | 説明 |
|------|-----|------|
| position | Position | 画面上の座標 |
| enemyType | EnemyType | 敵タイプ(通常/高速/タンク/ボス) |
| hp | number | 現在HP |
| maxHp | number | 最大HP |
| speed | number | 移動速度(px/秒) |
| breachDamage | number | 防衛ライン突破時のダメージ |
| xpDrop | number | 撃破時のXPドロップ量 |
| colliderRadius | number | 衝突判定半径(px) |

### E-03: Bullet（弾丸）
プレイヤーまたは仲間が発射する投射物。

| 属性 | 型 | 説明 |
|------|-----|------|
| position | Position | 現在座標 |
| velocity | Velocity | 移動速度・方向 |
| damage | number | ダメージ値 |
| isPiercing | boolean | 貫通フラグ |
| colliderRadius | number | 衝突判定半径(px)。固定値 8 |
| ownerId | EntityId | 発射元エンティティ |

### E-04: XPDrop（経験値アイテム）
敵撃破時にドロップする経験値宝石。マグネット範囲（1500px）内のXPはプレイヤーに向かって自動的に引き寄せられる。

| 属性 | 型 | 説明 | 初期値 |
|------|-----|------|--------|
| position | Position | ドロップ位置 | 敵撃破位置 |
| xpAmount | number | XP量 | 敵タイプ依存 |
| lifetime | number | 残り生存時間(秒) | 15.0 |

**蓄積制限**:
- 画面内XPDrop上限: 100個。上限到達時は最古のXPDropを消滅させてから新規生成する。
- 自動消滅: 生成から15秒経過で自動消滅する（回収されなかった場合のメモリリーク防止）。

### E-05: Ally（仲間）
プレイヤーの左右に配置され、追従移動しオート射撃する仲間キャラクター。

| 属性 | 型 | 説明 |
|------|-----|------|
| position | Position | 現在座標 |
| followTarget | EntityId | 追従対象(プレイヤー) |
| offsetX | number | プレイヤーからのX方向オフセット(px) |
| weapon | Weapon | 装備武器(前方射撃固定) |
| spriteHalfWidth | number | 描画半幅(px)。画面境界制限に使用。初期値 75 |

### E-06: Effect（エフェクト）
射撃・撃破時の視覚演出。

| 属性 | 型 | 説明 |
|------|-----|------|
| position | Position | 表示座標 |
| effectType | EffectType | エフェクト種類 |
| duration | number | 表示時間(秒) |
| elapsed | number | 経過時間(秒) |
| currentFrame | number | 現在のアニメフレーム |

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
| level | number | 現在レベル(1-5) |
| fireInterval | number | 発射間隔(秒) |

**注記**: 値オブジェクトとして不変性を保つため、動的な発射状態（前回発射時刻）は含まない。

### VO-03b: WeaponState（武器発射状態）
| 属性 | 型 | 説明 |
|------|-----|------|
| weaponType | WeaponType | 対応する武器タイプ（Weaponとの紐付けキー） |
| lastFiredAt | number | 前回発射時刻(秒) |

**注記**: WeaponSystemが管理するミュータブルな発射タイマー。武器ごとに1つ存在し、Weapon(VO-03)とweaponTypeで紐付ける。

### VO-04: PassiveSkills（パッシブスキル群）
| 属性 | 型 | 説明 | 最大レベル |
|------|-----|------|-----------|
| speedLevel | number | 移動速度UPレベル | 5 |
| maxHpLevel | number | 最大HP UPレベル | 5 |
| attackLevel | number | 攻撃力UPレベル | 5 |
| xpGainLevel | number | XP獲得量UPレベル | 5 |

### VO-05: ScoreData（スコアデータ）
| 属性 | 型 | 説明 |
|------|-----|------|
| survivalTime | number | 生存時間(秒) |
| killCount | number | 撃破数 |
| level | number | 到達レベル |

### VO-06: UpgradeChoice（強化選択肢）
| 属性 | 型 | 説明 |
|------|-----|------|
| id | string | 一意識別子 |
| category | UpgradeCategory | カテゴリ(weapon/passive/ally/heal) |
| upgradeType | string | 具体的な強化タイプ |
| currentLevel | number | 現在レベル(新規取得時は0) |
| nextLevel | number | 強化後レベル |
| description | string | 表示用説明文 |

---

## 3. 列挙型

### GameState（ゲーム状態）
```
TITLE      - タイトル画面
PLAYING    - ゲームプレイ中
LEVEL_UP   - レベルアップ選択中（一時停止）
GAME_OVER  - ゲームオーバー
```

### EnemyType（敵タイプ）
| タイプ | HP | 速度(px/秒) | 突破ダメージ | XPドロップ | 半径(px) |
|--------|-----|------------|-------------|-----------|---------|
| NORMAL | 20 | 80 | 10 | 10 | 60 |
| FAST | 10 | 160 | 8 | 15 | 60 |
| TANK | 60 | 40 | 15 | 25 | 80 |
| BOSS | 500+ | 30 | 30 | 200 | 110 |

### WeaponType（武器タイプ）
```
FORWARD    - 前方射撃（初期装備）
SPREAD     - 拡散射撃
PIERCING   - 貫通弾
```

### EffectType（エフェクトタイプ）
```
MUZZLE_FLASH    - 射撃エフェクト
ENEMY_DESTROY   - 敵撃破エフェクト
```

### UpgradeCategory（強化カテゴリ）
```
WEAPON   - 武器追加/強化
PASSIVE  - パッシブスキル強化
ALLY     - 仲間追加
HEAL     - HP回復（全強化取得済み時の代替）
```

---

## 4. エンティティ関係図

```
Player (1) ----< (0..3) Weapon         [装備]
Player (1) ----< (0..4) Ally           [仲間]
Player (1) ---- (1) PassiveSkills      [所有]
Player (1) ---- (1) ScoreData          [成績追跡]

Ally   (1) ---- (1) Weapon             [固定武器: FORWARD]

Enemy  (*) ---- (1) EnemyType          [タイプ定義]
Enemy  (*) ---> (*) XPDrop             [撃破時生成]

Bullet (*) ---> (0..1) Enemy           [命中判定]
Bullet (*) ---- (1) Weapon             [発射元武器]

XPDrop (*) ---> (1) Player             [回収]
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
| XP回収半径 | 80px | プレイヤー中心からの即座回収距離 |
| XPマグネット半径 | 1500px | 引き寄せ開始距離（画面全体カバー） |
| XPマグネット速度 | 500px/秒 | 引き寄せ移動速度 |
