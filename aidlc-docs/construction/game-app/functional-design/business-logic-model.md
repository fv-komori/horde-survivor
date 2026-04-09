# ビジネスロジックモデル

## 概要
ゲームの主要ビジネスロジック（Iteration 2）を技術非依存で詳細設計する。
ヒットカウント制、アイテムドロップ/バフシステム、仲間化システムの詳細ロジックを定義。

---

## 1. ゲームループロジック

### 1.1 メインループ（PLAYING状態時）
毎フレーム、以下の順序で処理を実行する:

```
 1. 入力処理           → プレイヤー移動意図の取得
 2. プレイヤー移動      → 位置更新（画面境界制限、バフ速度補正）
 3. 敵・弾丸・アイテム移動 → 全エンティティの位置更新
 4. 仲間追従           → プレイヤー位置に追従（動的間隔）
 5. 武器発射           → オート射撃判定・弾丸生成（バフ効果適用）
 6. 衝突判定           → 弾丸-敵の命中判定（ヒットカウント減算）。撃破時は撃破キュー(defeatedEnemies)に追加
 6b. 撃破キュー消費     → 撃破キューを順に消費し、各撃破敵に対して: (a)アイテムドロップ判定 (b)仲間化判定 (c)スコア加算 (d)敵エンティティ破棄。消費後キューをクリア
 7. 防衛ライン判定      → 敵の防衛ライン到達チェック
 8. HP管理            → HP0判定
 9. アイテム回収        → マグネット引き寄せ・回収・バフ適用・武器切替
10. バフ管理           → バフ時間減算・失効処理
11. 仲間化判定         → 撃破敵の仲間化判定・仲間エンティティ生成
12. 仲間連射速度更新    → 時間経過強化
13. エフェクト更新      → アニメーション進行
14. クリーンアップ      → 不要エンティティの破棄
15. 描画              → 全エンティティの描画
```

### 1.2 状態遷移ロジック
```
TITLE → [ゲーム開始ボタン押下] → PLAYING
  - ゲーム状態を初期化
  - プレイヤーエンティティを生成（武器: FORWARD、バフ: なし）
  - ウェーブタイマーを0にリセット

PLAYING → [HP ≤ 0] → GAME_OVER
  - ゲームループを停止
  - スコアデータを確定（生存時間、撃破数、仲間数）
  - ゲームオーバー画面を表示

GAME_OVER → [リトライボタン押下] → TITLE
  - 全エンティティを破棄
  - スコアをリセット
```

**Iteration 1からの変更**: LEVEL_UP状態を完全廃止。PLAYING→GAME_OVERのみ。

---

## 2. プレイヤー移動ロジック

### 2.1 移動計算
```
入力方向: direction = -1（左） / 0（停止） / +1（右）
バフ倍率: buffMultiplier = hasSpeedUpBuff ? 1.5 : 1.0
実効速度: effectiveSpeed = baseSpeed(200) × buffMultiplier
移動量:   dx = direction × effectiveSpeed × deltaTime
新位置X:  newX = clamp(position.x + dx, colliderRadius, 720 - colliderRadius)
```

### 2.2 画面境界制限
- 左端: `x >= colliderRadius`（72px）
- 右端: `x <= 720 - colliderRadius`（648px）
- Y座標は固定（1100px）

---

## 3. 敵移動ロジック

### 3.1 直進移動
全敵タイプ共通: 真下（+Y方向）に一定速度で移動。

```
newY = position.y + speed × deltaTime
```

### 3.2 スポーン位置
- X座標: 弾の到達範囲内でランダム（100px 〜 620px）
- Y座標: 画面上端外（-50 〜 -10px）

---

## 4. 武器・射撃ロジック

### 4.1 武器パラメータ定義

#### 前方射撃（FORWARD）- 初期装備
| パラメータ | 値 |
|-----------|-----|
| 発射間隔(秒) | 0.15 |
| 弾数/回 | 1 |
| 弾速(px/秒) | 600 |
| 拡散角度(度) | 0 |
| 貫通 | なし |

#### 拡散射撃（SPREAD）- 広範囲型
| パラメータ | 値 |
|-----------|-----|
| 発射間隔(秒) | 0.25 |
| 弾数/回 | 3 |
| 弾速(px/秒) | 500 |
| 拡散角度(度) | 60 |
| 貫通 | なし |

- 弾丸は扇状に均等配置して発射
- 発射方向: 中央弾は真上方向、他は等角度分散
- 例: 3発を60度の扇内（-30度、0度、+30度）に発射

#### 貫通弾（PIERCING）- 高ダメージ型
| パラメータ | 値 |
|-----------|-----|
| 発射間隔(秒) | 0.4 |
| 弾数/回 | 1 |
| 弾速(px/秒) | 400 |
| 拡散角度(度) | 0 |
| 貫通 | あり |

- 貫通弾は敵を通過しても消滅せず、直進を続ける
- 同一敵に対して1発の弾丸が複数回ヒットしない（hitEntitiesで管理）

#### 仲間の武器（固定）
- FORWARD と同じパラメータ
- プレイヤーのバフは適用されない
- fireRateBonus による連射速度強化のみ適用

**Iteration 1からの変更**: 武器レベル(1-5)を全廃。各武器タイプは固定パラメータ。ダメージ値→不要（ヒットカウント制で1弾=1カウント固定）。

### 4.2 バフの武器への影響
```
実効発射間隔の計算:
  baseInterval = weapon.fireInterval
  
  // プレイヤーのバフ適用
  if hasFireRateUpBuff:
    interval = baseInterval × 0.5  // 2倍速
  else:
    interval = baseInterval
  
  // 仲間のfireRateBonus適用
  if isAlly:
    interval = baseInterval / (1 + fireRateBonus / 100)
  
  // バフ×仲間ボーナスの重複なし（仲間にバフは適用されない）

弾数の計算:
  baseBulletCount = weapon.bulletCount
  
  if hasBarrageBuff:
    actualBulletCount = baseBulletCount × 3
    // FORWARD: 1→3, SPREAD: 3→9, PIERCING: 1→3
  else:
    actualBulletCount = baseBulletCount

拡散角度の計算:
  if hasBarrageBuff:
    // FORWARD: 0→30度, SPREAD: 60→120度, PIERCING: 0→20度
    actualSpreadAngle = barrageSpreadAngle[weaponType]
  else:
    actualSpreadAngle = weapon.spreadAngle

ヒットカウント減算値の計算:
  if isPlayerBullet AND hasAttackUpBuff:
    hitCountReduction = 2
  else:
    hitCountReduction = 1
```

### 4.3 オート射撃アルゴリズム
```
毎フレーム、プレイヤーおよび各仲間に対して:
  1. 実効発射間隔を計算（バフ/仲間ボーナス適用）
  2. 発射間隔チェック: currentTime - lastFiredAt >= effectiveFireInterval ?
  3. 弾丸数上限チェック: 現在の弾丸総数 < 200 ?
  4. 銃口位置の計算:
     - プレイヤー: (x + spriteHalf × 0.45, y - spriteHalf × 0.91)
     - 仲間:      (x + spriteHalf × 0.42, y - spriteHalf × 0.78)
  5. 弾丸生成:
     - 発射位置: 銃口座標
     - 速度ベクトル: 真上基本（拡散時は等角度分散）
     - hitCountReduction: バフ適用後の値
     - 実効弾数分を生成
  6. lastFiredAt を更新
  7. マズルフラッシュエフェクトを銃口位置に生成
```

---

## 5. 衝突判定ロジック

### 5.1 弾丸-敵 衝突判定（ヒットカウント制）
```
空間ハッシュグリッドによる近傍探索:
  1. グリッドをクリア
  2. 全敵をグリッドに登録
  3. 弾丸ごとにグリッドセル近傍の敵のみ判定

円-円判定（距離二乗比較による最適化）:
  dx = bullet.x - enemy.x
  dy = bullet.y - enemy.y
  distanceSq = dx * dx + dy * dy
  radiusSum = bullet.colliderRadius + enemy.colliderRadius
  isHit = distanceSq < (radiusSum * radiusSum)

命中時:
  1. 貫通弾の重複チェック:
     if bullet.isPiercing AND enemy.id in bullet.hitEntities:
       skip（同一弾で同一敵に再ヒットしない）
  
  2. ヒットカウント減算:
     enemy.hitCount -= bullet.hitCountReduction
     enemy.flashTimer = 0.1  // 被弾フラッシュ
  
  3. 撃破判定:
     if enemy.hitCount <= 0:
       a. 撃破キュー（defeatedEnemies）に追加
       b. 敵撃破エフェクト生成
  
  4. 弾丸処理:
     - 貫通弾: hitEntitiesに敵IDを追加、弾丸は存続
     - 非貫通弾: 弾丸エンティティを破棄予約

撃破キュー消費（メインループ ステップ6bで実行。撃破された敵ごとに順次処理）:
  1. ItemDropManager.determineDrops(enemyType) → アイテムドロップ生成
  2. AllyConversionSystem.tryConvertToAlly() → 仲間化判定
     ※ アイテムドロップ判定と仲間化判定は独立して両方実行される（仲間化成功時もアイテムはドロップする）
  3. ScoreService.incrementKills() → スコア加算
  4. 敵エンティティを破棄
  5. キュー内の全エントリ処理後、撃破キューをクリア
```

### 5.2 弾丸の衝突判定半径
- 全弾丸共通: 半径 8px

---

## 6. 防衛ラインロジック

### 6.1 防衛ライン到達判定
```
防衛ラインY = 1248 (画面下端1280 - 32)

毎フレーム、全敵に対して:
  if enemy.position.y >= 防衛ラインY:
    1. プレイヤーにダメージ適用（無条件）:
       player.hp -= enemy.breachDamage
    2. 敵エンティティを破棄
```

**Iteration 1からの変更**: 無敵時間を完全削除。防衛ライン突破のたびに即座にダメージ。

---

## 7. アイテム回収・バフ・武器切替・仲間化ロジック

### 7.1 アイテムマグネット回収
```
毎フレーム、全アイテムに対して:
  // 消滅時間管理
  item.remainingTime -= deltaTime
  if item.remainingTime <= 3.0:
    item.isBlinking = true
  if item.remainingTime <= 0:
    destroy(item)
    continue

  distance = sqrt((item.x - player.x)^2 + (item.y - player.y)^2)

  // 即座回収
  if distance <= 80:  // 回収半径
    applyItemEffect(item)
    destroy(item)
    continue

  // マグネット引き寄せ
  if distance <= 1500:  // マグネット半径
    moveAmount = 500 × deltaTime  // 引き寄せ速度
    ratio = min(moveAmount / distance, 1)
    item.x -= (item.x - player.x) × ratio
    item.y -= (item.y - player.y) × ratio
```

### 7.2 アイテム効果適用
```
applyItemEffect(item):
  switch item.itemType:
    case ATTACK_UP, FIRE_RATE_UP, SPEED_UP, BARRAGE:
      // パワーアップバフ適用
      buffType = mapItemTypeToBuff(item.itemType)
      player.activeBuffs[buffType] = { remainingTime: 5.0 }
      // 同種バフ再取得: 残り時間を5秒にリセット
      // バフ発動エフェクト生成（バフ色のリング拡大、0.3秒）
      createEffect(BUFF_ACTIVATE, player.position, buffColor[buffType])
    
    case WEAPON_SPREAD:
      player.weapon = SPREAD
    
    case WEAPON_PIERCING:
      player.weapon = PIERCING
```

### 7.3 バフ時間管理
```
毎フレーム:
  for each [buffType, buffState] in player.activeBuffs:
    buffState.remainingTime -= deltaTime
    if buffState.remainingTime <= 0:
      player.activeBuffs.delete(buffType)
```

### 7.4 アイテムドロップ判定
```
determineDrops(enemyType):
  drops = []
  
  // アイテム上限チェック（ボスは上限チェックの例外: 100%ドロップ保証を優先）
  if currentItemCount >= 50 AND enemyType != BOSS:
    return drops  // ドロップ抑制
  
  // 武器アイテム判定（別枠5%）
  if random() < 0.05:
    weaponType = selectWeaponType()  // 現在装備以外からランダム
    drops.push({ type: weaponType })
  
  // パワーアップアイテム判定
  dropRate = enemyDropRates[enemyType]  // 通常30%, 高速35%, タンク50%, ボス100%
  if random() < dropRate:
    powerUpType = selectPowerUpByWeight()  // ウェイトランダム
    drops.push({ type: powerUpType })
  
  // ボスの追加ドロップ
  if enemyType == BOSS:
    extraCount = randomInt(1, 2)  // 追加1〜2個（合計2〜3個）
    for i in range(extraCount):
      drops.push({ type: selectPowerUpByWeight() })
  
  return drops
```

### 7.5 仲間化判定
```
tryConvertToAlly(enemyEntity, defeatPosition):
  // 上限チェック
  if currentAllyCount >= 10:
    return false  // 仲間化判定を行わない
  
  // 確率判定
  conversionRate = enemyEntity.conversionRate
  if random() >= conversionRate:
    return false  // 仲間化失敗
  
  // 仲間化成功
  // 演出: 色変化→0.2秒で縮小消滅→0.3秒で配置先に再出現
  createEffect(ALLY_CONVERT, defeatPosition)
  
  // 仲間エンティティ生成
  allyIndex = currentAllyCount  // 0-indexed
  newAlly = createAlly(playerEntityId, allyIndex)
  newAlly.joinTime = elapsedTime
  newAlly.fireRateBonus = 0
  
  currentAllyCount += 1
  return true
```

### 7.6 仲間連射速度強化
```
毎フレーム、各仲間に対して:
  timeSinceJoin = elapsedTime - ally.joinTime
  expectedBonus = min(floor(timeSinceJoin / 10) × 10, 100)
  // 10秒ごとに+10%、最大+100%
  
  if expectedBonus > ally.fireRateBonus:
    ally.fireRateBonus = expectedBonus
```

---

## 8. ウェーブ進行ロジック

### 8.1 ウェーブ定義

| ウェーブ | 時間範囲 | 出現敵タイプ | スポーン間隔 | 同時スポーン数 |
|---------|---------|------------|------------|-------------|
| 1 | 0:00〜0:45 | NORMAL | 1.0秒 | 1体/回 |
| 2 | 0:45〜1:30 | NORMAL, FAST | 0.7秒 | 1〜2体/回 |
| 3 | 1:30〜3:00 | NORMAL, FAST, TANK | 0.5秒 | 2〜3体/回 |
| 4+ | 3:00以降 | NORMAL, FAST, TANK | 30秒ごとに-0.05秒(最小0.15秒) | 最大5体/回 |

**Iteration 1からの変更**: ウェーブ時間範囲・スポーン間隔を大幅短縮。同時スポーン数を追加。

### 8.2 敵タイプ出現確率（ウェーブ2以降）
| 敵タイプ | ウェーブ2 | ウェーブ3以降 |
|---------|---------|------------|
| NORMAL | 60% | 50% |
| FAST | 40% | 30% |
| TANK | - | 20% |

### 8.3 ヒット数スケーリング
```
hitCountMultiplier = 1.0 + floor(elapsedTime / 30) × 0.1
// 30秒ごとに+10%

actualHitCount = ceil(baseHitCount × hitCountMultiplier)
// 全敵タイプに適用（ボス含む）
```

### 8.4 ボス出現ロジック
```
初回出現: ゲーム開始1分30秒（90秒）後
以降: 1分30秒（90秒）間隔

bossTimer初期値 = 90
毎フレーム:
  bossTimer -= deltaTime
  if bossTimer <= 0:
    spawnBoss(hitCountMultiplier)
    bossTimer = 90
```

### 8.5 スポーン管理（実装仕様）
```
毎フレーム:
  // --- 通常敵スポーン ---
  spawnTimer -= deltaTime
  if spawnTimer <= 0:
    if currentEnemyCount < 300:  // 敵数上限
      count = getSimultaneousSpawnCount(currentWave)  // ウェーブに応じた同時数
      count = min(count, 5)  // 同時スポーン上限
      for i in range(count):
        if currentEnemyCount >= 300: break
        enemyType = selectEnemyType(currentWave)
        spawnPosition = randomSpawnPosition()
        spawnEnemy(enemyType, spawnPosition, hitCountMultiplier)
    spawnTimer = currentSpawnInterval

  // --- ボススポーン ---
  bossTimer -= deltaTime
  if bossTimer <= 0:
    spawnBoss(hitCountMultiplier)
    bossTimer = 90
```

### 8.6 高負荷時のアダプティブ戦略
ウェーブ4以降（最小スポーン間隔0.15秒 × 最大5体/回 = 秒間最大33体）では描画負荷が高まる。以下の既存メカニズムにより30FPS維持を図る:

1. **エンティティ上限**: 敵300体上限(BR-E02)により、スポーンレートが高くても画面内エンティティ数は頭打ちになる
2. **描画オブジェクト上限**: 800個超過時にアイテム・エフェクトを優先スキップ(BR-S03)
3. **画面外描画省略**: ビューポート外の敵ヒットカウント数字は描画スキップ(BR-HC03)
4. **空間ハッシュグリッド**: 衝突判定をO(n+m)相当に削減

上記で不十分な場合のフォールバック: デバッグモード(13章)のシステム別処理時間計測で律速箇所を特定し、スポーン間隔の下限引き上げ等のパラメータ調整で対応する。

---

## 9. 仲間配置ロジック

### 9.1 動的間隔計算
```
calculateAllyOffset(allyIndex, totalAllies):
  // 間隔算出
  if totalAllies <= 4:
    spacing = 110  // 固定
  else:
    availableWidth = 500  // 概算: 720 - プレイヤー幅 - マージン
    spacing = max(40, min(110, availableWidth / totalAllies))
  
  // 交互配置（右→左→右→左...）
  side = (allyIndex % 2 == 0) ? +1 : -1  // 偶数=右、奇数=左
  distance = (floor(allyIndex / 2) + 1) × spacing
  
  return side × distance

毎フレーム:
  totalAllies = getAllyCount()
  for each ally:
    offset = calculateAllyOffset(ally.allyIndex, totalAllies)
    ally.position.x = player.position.x + offset
    ally.position.y = player.position.y
    // 画面境界制限を適用
    ally.position.x = clamp(ally.position.x, ally.spriteHalfWidth, 720 - ally.spriteHalfWidth)
```

### 9.2 仲間の射撃
- 仲間はプレイヤーと同じオート射撃アルゴリズムを使用
- 武器はFORWARD固定
- 発射間隔にfireRateBonusを適用: `interval = 0.15 / (1 + fireRateBonus / 100)`
- プレイヤーのバフは適用されない
- hitCountReduction = 1（固定）

---

## 10. クリーンアップロジック

### 10.1 破棄条件
```
毎フレーム、全エンティティに対して:
  // 弾丸: 画面外
  if bullet AND (position.y < -50 OR position.y > 1330 OR position.x < -50 OR position.x > 770):
    destroy(bullet)

  // 敵: 防衛ライン通過済み（DefenseLineSystemで処理済み）

  // アイテム: 消滅時間切れ（ItemCollectionSystemで処理済み）

  // エフェクト: 表示時間超過（EffectSystemで処理済み）
```

---

## 11. デルタタイムクランプ

```
rawDt = currentTimestamp - previousTimestamp
dt = max(0, min(rawDt / 1000, 0.1))  // 0〜100msにクランプ

dt == 0 の場合: フレームをスキップ
dt > 0.1 の場合: 0.1秒として処理（タブ復帰時の大ジャンプ防止）
```

---

## 12. ゲームバランスパラメータの外部設定化

### 12.1 設計方針
本ドキュメントで定義する数値パラメータは、実装時に外部設定ファイル（JSON）として分離し、コード変更なしでバランス調整を可能とする。

### 12.2 外部化対象パラメータ
| カテゴリ | パラメータ例 | 設定キー(例) |
|---------|------------|-------------|
| 武器 | 発射間隔、弾数、弾速、拡散角度（タイプ別） | `weapons.forward.fireInterval` |
| 敵 | ヒット数、速度、突破ダメージ、ドロップ率、仲間化率（タイプ別） | `enemies.normal.hitCount` |
| ウェーブ | スポーン間隔、同時スポーン数、出現確率、ヒット数スケーリング | `waves[n].spawnInterval` |
| ボス | 基本ヒット数、出現間隔 | `boss.baseHitCount`, `boss.spawnInterval` |
| アイテム | ドロップウェイト、バフ効果値、効果時間、消滅時間 | `items.buff.duration`, `items.dropWeights` |
| 仲間 | 最大数、連射ボーナス間隔、最大ボーナス | `allies.maxCount`, `allies.fireRateInterval` |
| プレイヤー | 基本HP、基本速度、回収半径、マグネット半径 | `player.baseHp`, `player.magnetRadius` |
| エンティティ上限 | 敵数上限、弾丸上限、アイテム上限 | `limits.maxEnemies` |

### 12.3 設定ファイル形式
- 形式: JSON（TypeScript型定義付き）
- 読み込み: ゲーム初期化時に1回ロード。ホットリロードは不要。
- バリデーション: 型定義による静的チェック + 起動時の値域チェック
- フォールバック戦略:
  - 個別パラメータが値域違反の場合: 当該パラメータのみハードコードされたデフォルト値にフォールバックし、コンソールに警告ログを出力
  - JSONパースエラー（ファイル不在・構文エラー）の場合: 全パラメータをハードコードデフォルト値で起動し、コンソールにエラーログを出力
  - デフォルト値は本ドキュメントおよびbusiness-rulesで定義されている値を使用
- 値域チェック例:
  - 発射間隔: 0.01秒以上
  - ドロップ確率: 0.0〜1.0
  - エンティティ上限: 1以上の整数
  - ヒットカウント: 1以上の整数
  - 速度: 0以上

---

## 13. デバッグ・プロファイリング機能

### 13.1 設計方針
デバッグモード有効時に、ECSシステム別の処理時間計測を行い、FPS低下の原因特定を支援する。

### 13.2 システム別処理時間計測
```
debugMode有効時、毎フレーム:
  for each system in [InputSystem, PlayerMovementSystem, MovementSystem,
                       AllyFollowSystem, WeaponSystem, CollisionSystem,
                       DefenseLineSystem, HealthSystem, ItemCollectionSystem,
                       BuffSystem, AllyConversionSystem, AllyFireRateSystem,
                       EffectSystem, CleanupSystem, RenderSystem]:
    startTime = performance.now()
    system.update(dt)
    endTime = performance.now()
    systemMetrics[system.name] = endTime - startTime
```

### 13.3 デバッグ情報の表示
デバッグモード時に画面左上に以下を表示:
- FPS（現在 / 平均）
- 各システムの処理時間(ms)
- エンティティ数（敵、弾丸、アイテム、仲間、エフェクト）
- 現在ウェーブ / 経過時間
- アクティブバフ一覧

---

## 14. レスポンシブスケーリングロジック

### 14.1 レターボックス計算
論理解像度（720×1280）を実デバイス画面にフィットさせる。

```
論理幅 = 720, 論理高 = 1280
物理幅 = canvas.clientWidth, 物理高 = canvas.clientHeight

scaleX = 物理幅 / 論理幅
scaleY = 物理高 / 論理高
scale = min(scaleX, scaleY)

offsetX = (物理幅 - 論理幅 × scale) / 2
offsetY = (物理高 - 論理高 × scale) / 2
```

### 14.1.1 devicePixelRatio（DPR）対応
Retinaディスプレイ等の高DPRデバイスでぼやけを防止するため、Canvas描画バッファを物理ピクセル解像度に合わせる。

```
dpr = window.devicePixelRatio || 1

// Canvas描画バッファのサイズを物理ピクセル解像度に設定
canvas.width = canvas.clientWidth × dpr
canvas.height = canvas.clientHeight × dpr

// CSSサイズは論理ピクセルのまま（canvas.style.widthは変更しない）
// 描画コンテキストをDPRでスケーリング
ctx.scale(dpr, dpr)
```

レターボックス計算時の`物理幅`/`物理高`は`canvas.clientWidth`/`canvas.clientHeight`（CSSピクセル）を使用する。Canvas描画バッファサイズ（`canvas.width`/`canvas.height`）とは区別すること。

### 14.2 論理座標 → 物理座標変換（描画時）
```
physicalX = logicalX × scale + offsetX
physicalY = logicalY × scale + offsetY
```

### 14.3 物理座標 → 論理座標変換（タッチ/クリック入力時）
```
logicalX = (touchX - offsetX) / scale
logicalY = (touchY - offsetY) / scale

if logicalX < 0 OR logicalX > 720 OR logicalY < 0 OR logicalY > 1280:
  入力を無効とする
```

### 14.4 描画コンテキストへの適用
```
毎フレーム描画開始時:
  1. ctx.save()
  2. ctx.setTransform(1, 0, 0, 1, 0, 0)
  3. ctx.fillStyle = '#000000'
  4. ctx.fillRect(0, 0, canvas.width, canvas.height)
  5. ctx.restore()
  6. ゲーム描画開始（論理座標系で描画）
```

---

## 15. UI描画ロジック

### 15.0 描画レイヤー順序（Zオーダー）
描画は以下の順序で行う（先に描画されるものが背面）:

| レイヤー | 描画対象 | 備考 |
|---------|---------|------|
| 1 | 背景 | 単色背景 |
| 2 | アイテム（ItemDrop） | ドロップアイテム |
| 3 | 敵（Enemy） | ヒットカウント数字を含む |
| 4 | 仲間（Ally） | プレイヤー横の仲間キャラ |
| 5 | プレイヤー（Player） | 主人公 |
| 6 | 弾丸（Bullet） | プレイヤー・仲間の弾丸 |
| 7 | エフェクト（Effect） | 撃破・バフ・仲間化エフェクト |
| 8 | HUD | HPバー、バフ表示、ウェーブ表示等 |

### 15.1 HPバー
| 項目 | 仕様 |
|------|------|
| 位置 | 画面左上 (16, 16) |
| サイズ | 幅200px × 高さ16px |
| 背景色 | 暗い赤 (#400000) |
| バー色 | HP50%以上: 緑、HP25-50%: 黄、HP25%未満: 赤 |
| テキスト | バー右横に `{hp}/{maxHp}` を白文字14pxで表示 |

### 15.2 アクティブバフ表示
| 項目 | 仕様 |
|------|------|
| 位置 | HPバーの下 (16, 40) |
| レイアウト | バフアイコン横並び（間隔8px） |
| アイコンサイズ | 24px × 24px |
| アイコン色 | バフタイプ別（赤/黄/青/紫） |
| 残り時間バー | アイコン下に幅24px×高さ3pxのバー、残り時間に応じて減少 |
| 非アクティブ時 | 非表示 |

### 15.3 ウェーブ・タイマー表示
| 項目 | 仕様 |
|------|------|
| 位置 | 画面右上 (720 - 16, 16) 右寄せ |
| フォーマット | `Wave {n}  {分}:{秒(2桁ゼロ埋め)}` |
| フォント | 白文字、14px |

### 15.4 撃破数表示
| 項目 | 仕様 |
|------|------|
| 位置 | タイマー下 (720 - 16, 36) 右寄せ |
| フォーマット | `{killCount} kills` |
| フォント | 白文字、12px |

### 15.5 仲間数表示
| 項目 | 仕様 |
|------|------|
| 位置 | 撃破数の下 (720 - 16, 54) 右寄せ |
| フォーマット | `Allies: {current}/{max}` |
| フォント | 白文字、12px |

### 15.6 武器アイコン表示
| 項目 | 仕様 |
|------|------|
| 位置 | 画面左下 (16, 1220) |
| サイズ | 32px × 32px |
| 表示 | 現在装備中の武器のアイコン |
| 背景 | 半透明白枠 (rgba(255,255,255,0.3))、角丸4px |

### 15.7 ゲームオーバー画面（GAME_OVER状態時）
| 項目 | 仕様 |
|------|------|
| オーバーレイ | 画面全体に半透明黒 (rgba(0,0,0,0.7)) |
| タイトル | `GAME OVER` 赤、40px、ボールド、画面中央 |
| スコア表示 | 生存時間、撃破数、仲間数を縦並び（白、18px） |
| リトライボタン | 下部中央、幅200px × 高さ48px、白枠、`RETRY` |

### 15.8 モバイル操作UI（モバイルデバイス時のみ表示）
| 項目 | 仕様 |
|------|------|
| 表示条件 | `'ontouchstart' in window` が true の場合のみ |
| 左移動ボタン | (32, 1180)、80px×80px（タッチ領域96×96px） |
| 右移動ボタン | (608, 1180)、80px×80px（タッチ領域96×96px） |
| ボタン外観 | 半透明白、角丸12px、矢印アイコン |
| 長押し | 連続移動対応 |
| 水平スワイプ | Y>640で有効、deltaX>10pxで方向決定 |

### 15.9 ヒットカウント数字表示
| 項目 | 仕様 |
|------|------|
| 描画方式 | ビットマップフォント（事前レンダリング済み数字スプライト） |
| 通常表示 | 白文字+黒縁、フォントサイズ20px（ボス28px） |
| 被弾フラッシュ | flashTimer > 0の間、数字を赤色で表示 |
| 画面外省略 | ビューポート外の敵のヒット数は描画スキップ |

**Iteration 1からの変更**: XPバー(15.2)、レベル表示(15.3)、レベルアップ選択画面(15.6)を廃止。アクティブバフ表示、仲間数表示、武器アイコン表示、ヒットカウント数字表示を追加。
