# コンポーネント定義

**アーキテクチャ**: ECS（Entity-Component-System）
**言語**: TypeScript
**ビルド**: Vite + TypeScript

---

## ECS コアフレームワーク

### 1. Entity
- **責務**: 一意のIDを持つゲームオブジェクトのコンテナ。コンポーネントの集合を管理
- **インターフェース**: エンティティの生成・破棄、コンポーネントの追加・削除・取得

### 2. Component（データのみ）
- **責務**: 純粋なデータコンテナ。ロジックを持たない

### 3. System（ロジックのみ）
- **責務**: 特定のコンポーネントの組み合わせを持つエンティティに対してロジックを実行

### 4. World
- **責務**: ECSのルートコンテナ。全エンティティ・コンポーネント・システムを管理し、ゲームループを駆動

---

## コンポーネント型（データ）

### C-01: PositionComponent
- **責務**: エンティティの2D座標（x, y）を保持
- **用途**: プレイヤー、敵、弾丸、アイテム、仲間

### C-02: VelocityComponent
- **責務**: エンティティの移動速度と方向（vx, vy）を保持
- **用途**: 敵、弾丸、アイテム（マグネット引き寄せ時）

### C-03: SpriteComponent
- **責務**: 描画に必要な情報（スプライトタイプ、幅、高さ、色、アニメーションフレーム）
- **用途**: 全可視エンティティ

### C-04: HealthComponent
- **責務**: プレイヤーのHP関連データ（現在HP、最大HP）
- **用途**: プレイヤーのみ

### C-05: ColliderComponent
- **責務**: 衝突判定データ（半径、判定タイプ: 弾丸/敵/防衛ライン/アイテム）
- **用途**: プレイヤー、敵、弾丸、アイテム

### C-06: PlayerComponent
- **責務**: プレイヤー固有データ（移動速度）
- **用途**: プレイヤーエンティティのみ

### C-07: EnemyComponent
- **責務**: 敵固有データ（敵タイプ、突破ダメージ、アイテムドロップ確率、武器ドロップ確率、仲間化率）
- **用途**: 敵エンティティ

### C-08: BulletComponent
- **責務**: 弾丸固有データ（ヒットカウント減算値、貫通フラグ、所有者ID、貫通弾ヒット済みセット）
- **用途**: 弾丸エンティティ
- **データ**: hitCountReduction: number, piercing: boolean, ownerId: EntityId, hitEntities: Set\<EntityId\>
- **備考**: hitCountReduction は通常1、攻撃UPバフ時2。貫通弾（piercing=true）はヒット後も存続し、hitEntitiesに記録済みの敵には再ヒットしない

### C-09: WeaponComponent
- **責務**: 武器データ（武器タイプ、発射間隔、前回発射時刻）
- **用途**: プレイヤーおよび仲間エンティティ
- **備考**: 単一武器のみ保持

### C-10: AllyComponent
- **責務**: 仲間固有データ（配置インデックス、追従対象エンティティID、参加時刻、連射速度ボーナス）
- **用途**: 仲間エンティティ

### C-11: HitCountComponent
- **責務**: 敵のヒットカウントデータ（残りヒット数、最大ヒット数、被弾フラッシュ状態）
- **用途**: 敵エンティティ
- **データ**: currentHits: number, maxHits: number, flashTimer: number
- **備考**: 弾丸命中で1減算、攻撃UPバフ時は2減算。0で撃破。命中時にflashTimer=0.1（秒）を設定し、RenderSystemが赤点滅描画。flashTimerは毎フレームdt減算、0以下で通常描画に復帰

### C-12: ItemDropComponent
- **責務**: ドロップアイテムデータ（アイテムタイプ、残存時間、点滅フラグ）
- **用途**: ドロップアイテムエンティティ
- **データ**: itemType: ItemType, remainingTime: number, isBlinking: boolean
- **ItemType**: 'attack_up' | 'fire_rate_up' | 'speed_up' | 'barrage' | 'weapon_spread' | 'weapon_piercing'

### C-13: BuffComponent
- **責務**: プレイヤーのアクティブバフ状態の管理
- **用途**: プレイヤーエンティティ
- **データ**: activeBuffs: Map<BuffType, { remainingTime: number }>
- **BuffType**: 'attack_up' | 'fire_rate_up' | 'speed_up' | 'barrage'

### C-14: EffectComponent
- **責務**: エフェクトデータ（エフェクトタイプ、残存時間、アニメーション状態）
- **用途**: エフェクトエンティティ
- **データ**: effectType: 'muzzle_flash' | 'enemy_destroy' | 'buff_activate' | 'ally_convert', duration: number, elapsed: number

---

## システム（ロジック）

### S-01: InputSystem
- **責務**: キーボード/タッチ入力を読み取り、プレイヤーの移動意図を生成
- **処理対象**: PlayerComponent
- **優先度**: 1（最初に実行）

### S-02: MovementSystem
- **責務**: VelocityComponentに基づきPositionComponentを更新。画面境界チェック
- **処理対象**: PositionComponent + VelocityComponent
- **優先度**: 2

### S-03: PlayerMovementSystem
- **責務**: 入力に基づくプレイヤーの左右移動。バフの速度補正適用
- **処理対象**: PlayerComponent + PositionComponent + BuffComponent
- **優先度**: 2

### S-04: AllyFollowSystem
- **責務**: 仲間がプレイヤーに追従移動する（動的間隔配置）
- **処理対象**: AllyComponent + PositionComponent
- **優先度**: 3

### S-05: WeaponSystem
- **責務**: 発射間隔に基づき弾丸エンティティを生成。常に真上方向へ発射
- **処理対象**: WeaponComponent + PositionComponent + BuffComponent(プレイヤーのみ)
- **優先度**: 4
- **弾丸数上限管理（NFR-01）**: 弾丸同時表示上限200発

### S-06: CollisionSystem
- **責務**: 弾丸-敵の衝突判定。命中時にヒットカウントを減算。0で撃破→撃破キューに追加
- **処理対象**: ColliderComponent + PositionComponent + HitCountComponent + BulletComponent
- **優先度**: 5
- **空間最適化（NFR-01）**: 空間ハッシュグリッドによる衝突候補の絞り込み。セルサイズは最大コライダー径×2。弾丸200×敵300のO(n×m)全探索を回避し、グリッドセル単位の近傍探索でO(n+m)相当に削減
- **責務分離方針**: 撃破時の後続処理（アイテムドロップ、仲間化判定、スコア加算）は撃破キュー（defeatedEnemies: Entity[]）を介して間接通知する。CollisionSystemはキューへの追加のみ行い、ItemDropManager・AllyConversionSystem・ScoreServiceはキューを消費する形で疎結合を維持する

### S-07: DefenseLineSystem
- **責務**: 敵が防衛ライン（画面下端-32px）に到達したかチェック。到達時にプレイヤーへダメージ、敵を破棄
- **処理対象**: EnemyComponent + PositionComponent
- **優先度**: 6

### S-08: HealthSystem
- **責務**: プレイヤーHP変動の処理、HP0判定→ゲームオーバー
- **処理対象**: HealthComponent + PlayerComponent
- **優先度**: 7

### S-09: ItemCollectionSystem
- **責務**: アイテムのマグネット引き寄せ、回収判定、効果適用
- **処理対象**: ItemDropComponent + PositionComponent
- **優先度**: 8
- **詳細**: マグネット半径1500px内のアイテムをプレイヤーに引き寄せ（速度500px/秒）。回収半径80px内で回収→バフ適用or武器切替。消滅時間（10秒）管理と点滅警告（残り3秒）

### S-10: BuffSystem
- **責務**: アクティブバフの時間管理、効果の適用/失効
- **処理対象**: BuffComponent
- **優先度**: 9
- **詳細**: 各バフの残り時間をdt分減算。0以下になったバフを削除。同種バフ再取得時は5秒にリセット

### S-11: AllyConversionSystem
- **責務**: 敵撃破時の仲間化判定と仲間エンティティ生成
- **処理対象**: CollisionSystemから撃破イベントを受信
- **優先度**: 10
- **詳細**: 撃破された敵の仲間化率に基づき判定。最大10体チェック。仲間化時は敵の色変化→プレイヤー側移動の演出

### S-12: AllyFireRateSystem
- **責務**: 仲間の連射速度の時間経過強化
- **処理対象**: AllyComponent
- **優先度**: 11
- **詳細**: 各仲間のjoinTimeから10秒ごとにfireRateBonus+10%（最大+100%）

### S-13: EffectSystem
- **責務**: エフェクトのライフサイクル管理とアニメーション更新
- **処理対象**: EffectComponent + PositionComponent + SpriteComponent
- **優先度**: 97

### S-14: CleanupSystem
- **責務**: 画面外弾丸・消滅敵・消滅アイテムの破棄
- **処理対象**: 全エンティティ
- **優先度**: 98

### S-15: RenderSystem
- **責務**: Canvas 2D描画。全可視エンティティ＋HUD
- **処理対象**: SpriteComponent + PositionComponent
- **優先度**: 99（最後に実行）
- **描画内容**: ヒットカウント数字（ビットマップフォント、画面外省略）、アイテムアイコン、バフアイコン+残り時間バー、仲間数表示

---

## マネージャー（ECS外のゲーム管理）

### M-01: GameStateManager
- **責務**: ゲーム状態（TITLE/PLAYING/GAME_OVER）の管理と遷移

### M-02: WaveManager
- **責務**: ウェーブ進行管理、敵スポーンスケジュール、ボス出現タイミング、ヒット数スケーリング（+10%/30秒）

### M-03: SpawnManager
- **責務**: WaveManagerの指示に従い敵エンティティを生成。同時敵数上限300体、同時スポーン最大5体/回

### M-04: ItemDropManager
- **責務**: 敵撃破時のアイテムドロップ判定、アイテムタイプの決定、アイテム同時表示上限管理
- **インターフェース**: determineDrops(enemyType) → ItemDrop[]
- **アイテム数上限管理（NFR-01）**: アイテム同時表示上限50個。上限到達時は新規ドロップを抑制（既存アイテムの消滅を待つ）
- **詳細**: パワーアップアイテムと武器アイテムを別枠で判定。ボスは2〜3個同時ドロップ

### M-05: UIManager
- **責務**: HUD描画（HPバー、バフ表示、ウェーブ表示、仲間数、武器アイコン）、タイトル画面、ゲームオーバー画面

### M-06: AssetManager
- **責務**: アセット読み込みとキャッシュ

### M-07: AudioManager（将来拡張用スタブ）
- **責務**: サウンド/BGM管理（スコープ外だがインターフェースのみ定義）
