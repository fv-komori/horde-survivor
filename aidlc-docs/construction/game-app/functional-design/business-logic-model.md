# ビジネスロジックモデル

## 概要
ゲームの主要ビジネスロジック（ゲームループ、戦闘、成長、ウェーブ進行）を技術非依存で詳細設計する。

---

## 1. ゲームループロジック

### 1.1 メインループ（PLAYING状態時）
毎フレーム、以下の順序で処理を実行する:

```
1. 入力処理       → プレイヤー移動意図の取得
2. プレイヤー移動  → 位置更新（画面境界制限あり）
3. 敵・弾丸移動    → 全エンティティの位置更新
4. 仲間追従       → プレイヤー位置に追従
5. 武器発射       → オート射撃判定・弾丸生成
6. 衝突判定       → 弾丸-敵の命中判定
7. 防衛ライン判定  → 敵の防衛ライン到達チェック
8. HP管理        → 無敵時間・HP0判定
9. XP回収        → XPアイテムの自動回収
10. クリーンアップ  → 不要エンティティの破棄
11. 描画          → 全エンティティの描画
```

### 1.2 状態遷移ロジック
```
TITLE → [ゲーム開始ボタン押下] → PLAYING
  - ゲーム状態を初期化
  - プレイヤーエンティティを生成
  - ウェーブタイマーを0にリセット

PLAYING → [レベルアップ条件達成] → LEVEL_UP
  - ゲームループを一時停止（敵・弾丸の更新停止）
  - 強化選択肢を3つ生成
  - 選択画面を表示

LEVEL_UP → [強化選択完了] → PLAYING
  - 選択された強化を適用
  - HP 10%回復（最大HP上限あり）
  - ゲームループを再開

PLAYING → [HP ≤ 0] → GAME_OVER
  - ゲームループを停止
  - スコアデータを確定
  - ゲームオーバー画面を表示

GAME_OVER → [リトライボタン押下] → TITLE
  - 全エンティティを破棄
  - スコアをリセット
```

---

## 2. プレイヤー移動ロジック

### 2.1 移動計算
```
入力方向: direction = -1（左） / 0（停止） / +1（右）
実効速度: effectiveSpeed = baseSpeed × (1 + speedLevel × 0.10)
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
| パラメータ | Lv1 | Lv2 | Lv3 | Lv4 | Lv5 |
|-----------|-----|-----|-----|-----|-----|
| ダメージ | 10 | 13 | 17 | 22 | 30 |
| 発射間隔(秒) | 0.5 | 0.45 | 0.4 | 0.35 | 0.3 |
| 弾数/回 | 1 | 1 | 2 | 2 | 3 |
| 弾速(px/秒) | 600 | 600 | 600 | 650 | 700 |
| 貫通 | なし | なし | なし | なし | なし |

- 弾数2以上: 弾丸間を20px水平にオフセットして並列発射
- 射撃方向: 常に真上（-Y方向）に発射（敵のターゲティングは行わない）

#### 拡散射撃（SPREAD）- 広範囲型
| パラメータ | Lv1 | Lv2 | Lv3 | Lv4 | Lv5 |
|-----------|-----|-----|-----|-----|-----|
| ダメージ | 7 | 9 | 12 | 15 | 20 |
| 発射間隔(秒) | 0.7 | 0.65 | 0.6 | 0.55 | 0.5 |
| 弾数/回 | 3 | 3 | 5 | 5 | 7 |
| 拡散角度(度) | 60 | 70 | 80 | 90 | 120 |
| 弾速(px/秒) | 500 | 500 | 500 | 550 | 600 |
| 貫通 | なし | なし | なし | なし | なし |

- 弾丸は扇状に均等配置して発射
- 発射方向: 中央弾は真上方向、他は等角度分散
- 例: Lv1は3発を60度の扇内（-30度、0度、+30度）に発射

#### 貫通弾（PIERCING）- 高ダメージ型
| パラメータ | Lv1 | Lv2 | Lv3 | Lv4 | Lv5 |
|-----------|-----|-----|-----|-----|-----|
| ダメージ | 25 | 33 | 42 | 55 | 70 |
| 発射間隔(秒) | 1.2 | 1.1 | 1.0 | 0.9 | 0.8 |
| 弾数/回 | 1 | 1 | 1 | 2 | 2 |
| 弾速(px/秒) | 400 | 400 | 450 | 450 | 500 |
| 貫通 | あり | あり | あり | あり | あり |

- 貫通弾は敵を通過しても消滅せず、直進を続ける
- 同一敵に対して1発の弾丸が複数回ヒットしない（貫通済みリスト管理）
- 弾数2の場合: 20px水平オフセットで並列発射

#### 仲間の武器（固定）
- 前方射撃Lv1と同じパラメータ
- プレイヤーの武器強化・攻撃力UPパッシブは**適用されない**

### 4.2 攻撃力UPパッシブの適用
```
最終ダメージ = 武器基本ダメージ × (1 + attackLevel × 0.15)
```
- プレイヤーの全武器に適用
- 仲間の武器には適用されない

### 4.3 オート射撃アルゴリズム
```
毎フレーム、武器ごとに:
  1. 発射間隔チェック: currentTime - lastFiredAt >= fireInterval ?
  2. 弾丸数上限チェック: 現在の弾丸総数 < 100 ?
  3. 銃口位置の計算:
     - プレイヤー: (x + spriteHalf × 0.45, y - spriteHalf × 0.91)
     - 仲間:      (x + spriteHalf × 0.42, y - spriteHalf × 0.78)
  4. 弾丸生成:
     - 発射位置: 銃口座標（上記で計算した位置）
     - 速度ベクトル: 常に真上（vx=0, vy=-弾速）
     - 武器タイプに応じた弾数分を生成
  5. lastFiredAt を更新
  6. マズルフラッシュエフェクトを銃口位置に生成
```

---

## 5. 衝突判定ロジック

### 5.1 弾丸-敵 衝突判定
```
円-円判定（距離二乗比較による最適化）:
  dx = bullet.x - enemy.x
  dy = bullet.y - enemy.y
  distanceSq = dx * dx + dy * dy
  radiusSum = bullet.colliderRadius + enemy.colliderRadius
  isHit = distanceSq < (radiusSum * radiusSum)
  // ※ sqrt を省略し距離の二乗で比較することで、最大20,000回/フレームの判定を高速化

命中時:
  1. 敵HP -= bullet.damage
  2. 敵HP <= 0 の場合:
     a. 敵撃破エフェクトを生成
     b. XPドロップを生成（敵位置に、xpDrop量）
     c. スコアの撃破数を+1
     d. 敵エンティティを破棄予約
  3. 弾丸処理:
     - 貫通弾: 貫通済みリストに敵IDを追加、弾丸は存続
     - 非貫通弾: 弾丸エンティティを破棄予約
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
    1. プレイヤーにダメージ適用（無敵中でなければ）:
       player.hp -= enemy.breachDamage
    2. 敵エンティティを破棄
```

### 6.2 無敵時間管理
```
ダメージ適用時:
  if not player.isInvincible:
    player.hp -= damage
    player.isInvincible = true
    player.invincibleTimer = 1.0  // 1秒間無敵

毎フレーム:
  if player.isInvincible:
    player.invincibleTimer -= deltaTime
    if player.invincibleTimer <= 0:
      player.isInvincible = false
      player.invincibleTimer = 0
```

- 無敵中は防衛ライン突破ダメージを受けない
- 無敵中も敵はラインを通過すると消滅する（ダメージだけ無効化）
- 無敵中はプレイヤーが点滅表示（視覚フィードバック）

---

## 7. XP・レベルアップロジック

### 7.1 XP回収（マグネット方式）
```
毎フレーム、全XPドロップに対して:
  distance = sqrt((drop.x - player.x)^2 + (drop.y - player.y)^2)

  // 即座回収
  if distance <= 80:  // 回収半径
    actualXP = drop.xpAmount × (1 + xpGainLevel × 0.20)
    player.xp += actualXP
    XPドロップエンティティを破棄
    continue

  // マグネット引き寄せ
  if distance <= 1500:  // マグネット半径（画面全体カバー）
    moveAmount = 500 × deltaTime  // 引き寄せ速度 500px/秒
    ratio = min(moveAmount / distance, 1)
    drop.x -= (drop.x - player.x) × ratio
    drop.y -= (drop.y - player.y) × ratio
```

### 7.2 レベルアップ判定
XP必要量テーブル（緩やかな指数増加曲線）:

| レベル | 必要累積XP | 次レベルまでの差分 |
|--------|-----------|------------------|
| 1→2 | 30 | 30 |
| 2→3 | 70 | 40 |
| 3→4 | 125 | 55 |
| 4→5 | 200 | 75 |
| 5→6 | 300 | 100 |
| 6→7 | 430 | 130 |
| 7→8 | 600 | 170 |
| 8→9 | 820 | 220 |
| 9→10 | 1100 | 280 |
| 10→11 | 1450 | 350 |
| 11→12 | 1900 | 450 |
| 12→13 | 2450 | 550 |
| 13→14 | 3150 | 700 |
| 14→15 | 4000 | 850 |
| 15以降 | +1000ずつ増加 | 1000 |

**XP必要量の定義**:
- Lv1-14: **上記テーブルの値を正とする**（実装時はテーブル定数として定義すること）
- Lv15以降: 差分固定 1000XP
- 参考概算式: `差分 ≈ floor(30 × 1.3^(n-1))`（設計経緯の参考値であり、テーブル値とは厳密に一致しない）

```
レベルアップ判定:
  if player.xp >= xpRequiredForNextLevel(player.level):
    ゲーム状態を LEVEL_UP に遷移
```

**連続レベルアップ時の処理フロー**:
1フレームで複数レベル分のXPを獲得した場合でも、レベルアップは1回ずつ処理する。
```
LEVEL_UP → [強化選択完了] → PLAYING に復帰
→ 復帰後の次フレームで再度レベルアップ判定を実行
→ 累積XPが次レベルの必要XP以上であれば、再び LEVEL_UP に遷移
→ 必要XPに達しなくなるまで繰り返す
```

### 7.3 レベルアップ選択肢生成
```
generateChoices(count=3):
  candidates = []

  // 1. 未取得武器をcandidatesに追加
  for each weaponType in [SPREAD, PIERCING]:
    if weaponType not in player.weaponInventory AND weaponInventory.length < 3:
      candidates.push({ category: WEAPON, type: weaponType, currentLevel: 0, nextLevel: 1 })

  // 2. 強化可能な既存武器を追加
  for each weapon in player.weaponInventory:
    if weapon.level < 5:
      candidates.push({ category: WEAPON, type: weapon.type, currentLevel: weapon.level, nextLevel: weapon.level + 1 })

  // 3. 強化可能なパッシブスキルを追加
  for each skill in [speed, maxHp, attack, xpGain]:
    if skill.level < 5:
      candidates.push({ category: PASSIVE, type: skill.name, currentLevel: skill.level, nextLevel: skill.level + 1 })

  // 4. 仲間追加を追加（上限未達の場合）
  if player.allyCount < 4:
    candidates.push({ category: ALLY, type: 'ally', currentLevel: player.allyCount, nextLevel: player.allyCount + 1 })

  // 5. 候補が3未満の場合（全強化取得済み等）
  while candidates.length < count:
    candidates.push({ category: HEAL, type: 'heal', description: 'HP 30%回復' })

  // 6. ランダムに3つ選択（重複なし）
  choices = randomSample(candidates, min(count, candidates.length))

  // 7. 各選択肢にユニークIDを付与
  for each choice in choices:
    choice.id = generateUniqueId()

  return choices
```

### 7.4 強化適用
```
applyChoice(choice):
  // 状態ガード（LEVEL_UP状態でのみ実行可能）
  if gameState != LEVEL_UP:
    log WARN "[FV-GAME][WARN][LevelUpManager] applyChoice called outside LEVEL_UP state"
    return  // 何もしない（generatedChoiceIdsは維持）

  // 検証（不正選択防止）
  if choice.id not in generatedChoiceIds:
    log WARN "[FV-GAME][WARN][LevelUpManager] Invalid choice ID: {choice.id}"
    return  // 同じ選択肢セットを再表示（generatedChoiceIdsは維持、LEVEL_UP状態を継続）

  if choice at max level:
    log WARN "[FV-GAME][WARN][LevelUpManager] Choice already at max level: {choice.type}"
    return  // 同じ選択肢セットを再表示

  // --- 検証通過: 強化を適用 ---

  switch choice.category:
    case WEAPON:
      if choice.currentLevel == 0:
        // 新規武器追加
        player.weaponInventory.push(new Weapon(choice.type, level=1))
      else:
        // 既存武器レベルアップ
        weapon = findWeapon(choice.type)
        weapon.level += 1
        // 武器パラメータをレベルに応じて更新

    case PASSIVE:
      player.passiveSkills[choice.type] += 1
      // 最大HP UPの場合: maxHp += 20, hp += 20（現在HPも増加）

    case ALLY:
      player.allyCount += 1
      // 新しい仲間エンティティを生成
      // 配置: プレイヤーからの左右オフセット計算
      // 1体目: +110px, 2体目: -110px, 3体目: +220px, 4体目: -220px

    case HEAL:
      healAmount = floor(player.maxHp × 0.30)
      player.hp = min(player.hp + healAmount, player.maxHp)

  // 通常レベルアップ時のHP回復（HEAL選択時を除く）
  if choice.category != HEAL:
    healAmount = floor(player.maxHp × 0.10)
    player.hp = min(player.hp + healAmount, player.maxHp)

  // 選択肢IDをクリア（成功時のみ。reject時はクリアしない）
  generatedChoiceIds.clear()
  // PLAYING状態に復帰
  gameState = PLAYING
```

---

## 8. ウェーブ進行ロジック

### 8.1 ウェーブ定義

| ウェーブ | 時間範囲 | 出現敵タイプ | スポーン間隔 | 敵HP倍率 |
|---------|---------|------------|------------|---------|
| 1 | 0:00〜1:00 | NORMAL | 2.0秒 | ×1.0 |
| 2 | 1:00〜2:30 | NORMAL, FAST | 1.5秒 | ×1.0 |
| 3 | 2:30〜4:30 | NORMAL, FAST, TANK | 1.0秒 | ×1.0 |
| 4+ | 4:30以降 | NORMAL, FAST, TANK | 30秒ごとに-0.05秒(最小0.3秒) | 30秒ごとに+5% |

### 8.2 敵タイプ出現確率（ウェーブ3以降）
| 敵タイプ | 出現率 |
|---------|--------|
| NORMAL | 50% |
| FAST | 30% |
| TANK | 20% |

### 8.3 ボス出現ロジック（概念）
ゲーム開始から2分（120秒）経過後、以降2分間隔でボスが出現する。

ボスのスケーリング:
```
出現回数 = bossSpawnCount（ゲーム内カウンタ。ボス生成ごとに+1）
bossHp = 500 × (1 + (出現回数 - 1) × 0.5)  // 毎回+50%
bossDamage = 30 × (1 + (出現回数 - 1) × 0.3)  // 毎回+30%
bossXP = 200  // 固定
```

> **注記**: ボスHPはボス独自スケーリングのみ適用する。ウェーブ4以降の敵HP倍率（BR-E04）はボスには**適用しない**。
> ボスは独立した強化曲線（+50%/回）を持つため、ウェーブHP倍率との二重適用を避ける設計とする。

### 8.4 スポーン管理（実装仕様）
```
毎フレーム:
  // --- 通常敵スポーン ---
  spawnTimer -= deltaTime
  if spawnTimer <= 0:
    if currentEnemyCount < 200:  // 敵数上限
      enemyType = selectEnemyType(currentWave)
      spawnPosition = randomSpawnPosition()
      spawnEnemy(enemyType, spawnPosition, hpMultiplier)
    spawnTimer = currentSpawnInterval

  // --- ボススポーン（タイマー方式） ---
  // 初期値: bossTimer = 120（ゲーム開始から120秒後に最初のボス）
  bossTimer -= deltaTime
  if bossTimer <= 0 AND elapsedTime >= 120:
    bossSpawnCount += 1
    spawnBoss(bossSpawnCount)
    bossTimer = 120  // 次のボスまで2分
```

---

## 9. 仲間配置ロジック

### 9.1 オフセット計算
```
仲間の配置順序とオフセット:
  仲間1: offsetX = +32  (プレイヤーの右32px)
  仲間2: offsetX = -32  (プレイヤーの左32px)
  仲間3: offsetX = +64  (プレイヤーの右64px)
  仲間4: offsetX = -64  (プレイヤーの左64px)

毎フレーム:
  for each ally:
    ally.position.x = player.position.x + ally.offsetX
    ally.position.y = player.position.y
    // 画面境界制限を適用
    ally.position.x = clamp(ally.position.x, ally.spriteHalfWidth, 720 - ally.spriteHalfWidth)
```

### 9.2 仲間の射撃
- 仲間はプレイヤーと同じオート射撃アルゴリズムを使用
- 武器は前方射撃Lv1固定（強化不可）
- プレイヤーの攻撃力UPパッシブは適用されない

---

## 10. クリーンアップロジック

### 10.1 破棄条件
```
毎フレーム、全エンティティに対して:
  // 弾丸: 画面外
  if bullet AND (position.y < -50 OR position.y > 1330 OR position.x < -50 OR position.x > 770):
    destroy(bullet)

  // 敵: 防衛ライン通過済み（DefenseLineSystemで処理済み）

  // XPドロップ: 回収済み（XPCollectionSystemで処理済み）
  // XPドロップ: 自動消滅（lifetime経過）
  if xpDrop AND xpDrop.lifetime <= 0:
    destroy(xpDrop)
  // XPドロップ: 上限超過時に最古を消滅
  if xpDropCount > 100:
    destroy(oldestXPDrop)

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
本ドキュメントで定義する数値パラメータ（武器ダメージ、敵HP、スポーン間隔、XP必要量等）は、実装時に外部設定ファイル `gameConfig` として分離し、コード変更なしでバランス調整を可能とする。

### 12.2 外部化対象パラメータ
| カテゴリ | パラメータ例 | 設定キー(例) |
|---------|------------|-------------|
| 武器 | ダメージ、発射間隔、弾数、弾速（レベル別） | `weapons.forward.levels[n].damage` |
| 敵 | HP、速度、突破ダメージ、XPドロップ量（タイプ別） | `enemies.normal.hp` |
| ウェーブ | スポーン間隔、HP倍率増加率、出現確率 | `waves[n].spawnInterval` |
| ボス | 基本HP、スケーリング倍率、出現間隔 | `boss.baseHp`, `boss.hpScaling` |
| 成長 | XP必要量テーブル、パッシブ効果係数 | `leveling.xpTable`, `passives.speed.perLevel` |
| プレイヤー | 基本HP、基本速度、無敵時間、XP回収半径 | `player.baseHp`, `player.baseSpeed` |
| エンティティ上限 | 敵数上限、弾丸上限、XPDrop上限 | `limits.maxEnemies`, `limits.maxBullets` |

### 12.3 設定ファイル形式
- 形式: JSON（TypeScript型定義付き）
- 読み込み: ゲーム初期化時に1回ロード。ホットリロードは不要。
- バリデーション: 型定義による静的チェック + 起動時の値域チェック（負数、ゼロ除算等の防止）

---

## 13. デバッグ・プロファイリング機能

### 13.1 設計方針
デバッグモード有効時（`debugMode = true`）に、ECSシステム別の処理時間計測を行い、FPS低下の原因特定を支援する。

### 13.2 システム別処理時間計測
```
debugMode有効時、毎フレーム:
  for each system in [InputSystem, MovementSystem, WeaponSystem,
                       CollisionSystem, DefenseLineSystem, XPCollectionSystem,
                       CleanupSystem, RenderSystem]:
    startTime = performance.now()
    system.update(dt)
    endTime = performance.now()
    systemMetrics[system.name] = endTime - startTime

  // フレーム全体の処理時間
  frameTotalMs = sum(systemMetrics.values())
```

### 13.3 デバッグ情報の表示
デバッグモード時に画面左上に以下を表示:
- FPS（現在 / 平均）
- 各システムの処理時間(ms)
- エンティティ数（敵、弾丸、XPDrop、エフェクト）
- 現在ウェーブ / 経過時間

---

## 14. レスポンシブスケーリングロジック

### 14.1 レターボックス計算
論理解像度（720×1280）を実デバイス画面にフィットさせる。アスペクト比を維持し、余白部分はレターボックス（黒帯）で埋める。

```
論理幅 = 720, 論理高 = 1280
物理幅 = canvas.clientWidth, 物理高 = canvas.clientHeight

scaleX = 物理幅 / 論理幅
scaleY = 物理高 / 論理高
scale = min(scaleX, scaleY)  // アスペクト比維持

// レターボックスオフセット（中央配置）
offsetX = (物理幅 - 論理幅 × scale) / 2
offsetY = (物理高 - 論理高 × scale) / 2
```

### 14.2 論理座標 → 物理座標変換（描画時）
```
physicalX = logicalX × scale + offsetX
physicalY = logicalY × scale + offsetY
```

### 14.3 物理座標 → 論理座標変換（タッチ/クリック入力時）
```
logicalX = (touchX - offsetX) / scale
logicalY = (touchY - offsetY) / scale

// 論理座標が画面範囲外の場合はクランプまたは無視
if logicalX < 0 OR logicalX > 720 OR logicalY < 0 OR logicalY > 1280:
  入力を無効とする
```

### 14.4 描画コンテキストへの適用
```
ゲーム初期化時およびリサイズイベント時:
  canvas.width = 物理幅 × devicePixelRatio
  canvas.height = 物理高 × devicePixelRatio
  // スケーリング変換を設定
  ctx.setTransform(scale × devicePixelRatio, 0, 0, scale × devicePixelRatio,
                   offsetX × devicePixelRatio, offsetY × devicePixelRatio)

毎フレーム描画開始時:
  1. ctx.save()
  2. ctx.setTransform(1, 0, 0, 1, 0, 0)  // 変換をリセット
  3. ctx.fillStyle = '#000000'
  4. ctx.fillRect(0, 0, canvas.width, canvas.height)  // レターボックス含むCanvas全体を黒クリア
  5. ctx.restore()  // ゲーム用変換を復元
  6. ゲーム描画開始（論理座標系で描画）
```

---

## 15. UI描画ロジック

### 15.1 HPバー
| 項目 | 仕様 |
|------|------|
| 位置 | 画面左上 (16, 16) |
| サイズ | 幅200px × 高さ16px |
| 背景色 | 暗い赤 (#400000) |
| バー色 | HP50%以上: 緑 (#00FF00)、HP25-50%: 黄 (#FFFF00)、HP25%未満: 赤 (#FF0000) |
| 計算 | barWidth = 200 × (player.hp / player.maxHp) |
| テキスト | バー右横に `{hp}/{maxHp}` を白文字14pxで表示 |

### 15.2 XPバー
| 項目 | 仕様 |
|------|------|
| 位置 | 画面上部中央 (160, 8) |
| サイズ | 幅400px × 高さ8px |
| 背景色 | 暗い青 (#000040) |
| バー色 | シアン (#00FFFF) |
| 計算 | currentXP = player.xp - xpRequired(player.level - 1), nextXP = xpRequired(player.level) - xpRequired(player.level - 1), barWidth = 400 × (currentXP / nextXP) |

### 15.3 レベル表示
| 項目 | 仕様 |
|------|------|
| 位置 | HPバー下 (16, 40) |
| フォーマット | `Lv.{level}` |
| フォント | 白文字、16px、ボールド |

### 15.4 ウェーブ・タイマー表示
| 項目 | 仕様 |
|------|------|
| 位置 | 画面右上 (720 - 16, 16) 右寄せ |
| フォーマット | `{分}:{秒(2桁ゼロ埋め)}` |
| フォント | 白文字、14px |

### 15.5 撃破数表示
| 項目 | 仕様 |
|------|------|
| 位置 | タイマー下 (720 - 16, 36) 右寄せ |
| フォーマット | `{killCount} kills` |
| フォント | 白文字、12px |

### 15.6 レベルアップ選択画面（LEVEL_UP状態時）
| 項目 | 仕様 |
|------|------|
| オーバーレイ | 画面全体に半透明黒 (rgba(0,0,0,0.6)) |
| タイトル | 画面中央上部 `LEVEL UP!` 黄色、32px、ボールド |
| 選択肢カード | 3枚横並び。各カード: 幅180px × 高さ240px、中央配置、間隔20px |
| カード背景 | 暗い青 (rgba(0,0,80,0.9))、角丸8px、白枠線1px |
| カード内容 | 上部: アイコン領域(48×48px)、中部: 名称(白、16px)、下部: 説明文(灰、12px)、レベル表示(黄、14px) |
| タップ領域 | 各カード全体がタップ対象 |

### 15.7 ゲームオーバー画面（GAME_OVER状態時）
| 項目 | 仕様 |
|------|------|
| オーバーレイ | 画面全体に半透明黒 (rgba(0,0,0,0.7)) |
| タイトル | `GAME OVER` 赤、40px、ボールド、画面中央 |
| スコア表示 | 中央下に生存時間、撃破数、到達レベルを縦並び（白、18px） |
| リトライボタン | 下部中央、幅200px × 高さ48px、白枠、`RETRY` テキスト中央揃え |

### 15.8 モバイル操作UI（モバイルデバイス時のみ表示）
| 項目 | 仕様 |
|------|------|
| 表示条件 | `'ontouchstart' in window` が true の場合のみ表示。PC時は非表示 |
| 左移動ボタン | 位置: (32, 1180)、サイズ: 80px × 80px（タッチ領域は96×96px、Apple HIG 44pt以上確保） |
| 右移動ボタン | 位置: (608, 1180)、サイズ: 80px × 80px（タッチ領域は96×96px） |
| ボタン外観 | 半透明白 (rgba(255,255,255,0.3))、角丸12px、矢印アイコン（◀ / ▶）白色 |
| 押下時外観 | 半透明白 (rgba(255,255,255,0.5)) に変化（視覚フィードバック） |
| タップ長押し | 長押し中は連続移動（touchstart→移動開始、touchend→移動停止） |
| 水平スワイプ | 画面下半分（Y > 640）の任意位置でtouchstart→touchmoveのdeltaXに応じて移動方向を決定 |
| スワイプ閾値 | deltaX > 10pxで移動開始。deltaX符号で方向決定（正=右、負=左） |
| 描画レイヤー | HUDの最前面（エフェクトより上、レベルアップ画面より下） |

### 15.9 プレイヤー無敵時点滅表示
| 項目 | 仕様 |
|------|------|
| 条件 | player.isInvincible == true の場合 |
| 方式 | globalAlpha を周期的に変更 |
| 点滅周期 | 100ms ON / 100ms OFF（5Hz） |
| alpha値 | ON時: 1.0、OFF時: 0.3 |
| 計算 | `alpha = (Math.floor(invincibleTimer / 0.1) % 2 == 0) ? 1.0 : 0.3` |
