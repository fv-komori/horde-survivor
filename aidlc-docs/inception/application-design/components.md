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
- **種類**: 以下のコンポーネント型を定義

### 3. System（ロジックのみ）
- **責務**: 特定のコンポーネントの組み合わせを持つエンティティに対してロジックを実行
- **種類**: 以下のシステムを定義

### 4. World
- **責務**: ECSのルートコンテナ。全エンティティ・コンポーネント・システムを管理し、ゲームループを駆動

---

## コンポーネント型（データ）

### C-01: PositionComponent
- **責務**: エンティティの2D座標（x, y）を保持
- **用途**: プレイヤー、敵、弾丸、XPアイテム、仲間

### C-02: VelocityComponent
- **責務**: エンティティの移動速度と方向（vx, vy）を保持
- **用途**: 敵、弾丸

### C-03: SpriteComponent
- **責務**: 描画に必要な情報（スプライトタイプ、幅、高さ、色、アニメーションフレーム）
- **用途**: 全可視エンティティ

### C-04: HealthComponent
- **責務**: HP関連データ（現在HP、最大HP）
- **用途**: プレイヤー、敵

### C-05: ColliderComponent
- **責務**: 衝突判定データ（半径、判定タイプ: 弾丸/敵/防衛ライン）
- **用途**: プレイヤー、敵、弾丸

### C-06: PlayerComponent
- **責務**: プレイヤー固有データ（移動速度、無敵状態、無敵残り時間）
- **用途**: プレイヤーエンティティのみ

### C-07: EnemyComponent
- **責務**: 敵固有データ（敵タイプ、突破ダメージ、XPドロップ量）。HP関連はHealthComponentに分離
- **用途**: 敵エンティティ

### C-08: BulletComponent
- **責務**: 弾丸固有データ（ダメージ、貫通フラグ、所有者ID）
- **用途**: 弾丸エンティティ

### C-09: WeaponComponent
- **責務**: 武器データ（武器タイプ、レベル、発射間隔、前回発射時刻）
- **用途**: プレイヤーおよび仲間エンティティ
- **備考**: 単一の武器データを保持。プレイヤーは複数武器を装備するためWeaponInventoryComponentで管理

### C-13: WeaponInventoryComponent
- **責務**: 武器インベントリ管理（装備中の武器リスト、同時装備上限: 3種）
- **用途**: プレイヤーエンティティ
- **データ**: weaponSlots: WeaponComponent[]（最大3）、activeWeaponCount: number

### C-10: AllyComponent
- **責務**: 仲間固有データ（オフセット位置、追従対象のエンティティID）
- **用途**: 仲間エンティティ

### C-11: XPDropComponent
- **責務**: XPアイテムデータ（XP量）
- **用途**: XPドロップエンティティ

### C-14: EffectComponent
- **責務**: エフェクトデータ（エフェクトタイプ、残存時間、アニメーション状態）
- **用途**: エフェクトエンティティ（射撃エフェクト、敵撃破エフェクト）
- **データ**: effectType: 'muzzle_flash' | 'enemy_destroy', duration: number, elapsed: number, currentFrame: number, totalFrames: number, frameInterval: number

### C-12: PassiveSkillsComponent
- **責務**: パッシブスキルレベルの集合（移動速度、最大HP、攻撃力、XP獲得量）
- **用途**: プレイヤーエンティティ

---

## システム（ロジック）

### S-01: InputSystem
- **責務**: キーボード/タッチ入力を読み取り、プレイヤーの移動意図を生成
- **処理対象**: PlayerComponent
- **優先度**: 1（最初に実行）
- **モバイルタッチUI設計**:
  - 左右移動ボタン: 画面下部左右に配置（最低44x44ptのタッチ領域確保）
  - 水平スワイプ: 画面下半分の任意位置でスワイプ操作対応（touchstart/touchmove/touchend）
  - タップ長押しで連続移動に対応
  - デバイスタイプ自動判定（'ontouchstart' in window）でUI表示切替
- **入力バリデーション（NFR-07）**:
  - 入力値の範囲チェック: 移動方向は -1, 0, +1 に正規化
  - フレームあたり最大移動量制限: maxSpeed × dt を超える移動を制限
  - 不正な入力値（NaN、Infinity等）は無視して前回値を維持

### S-02: MovementSystem
- **責務**: VelocityComponentに基づきPositionComponentを更新。画面境界チェック
- **処理対象**: PositionComponent + VelocityComponent
- **優先度**: 2

### S-03: PlayerMovementSystem
- **責務**: 入力に基づくプレイヤーの左右移動。パッシブスキルの速度補正適用
- **処理対象**: PlayerComponent + PositionComponent
- **優先度**: 2

### S-04: AllyFollowSystem
- **責務**: 仲間がプレイヤーに追従移動する（等間隔配置）
- **処理対象**: AllyComponent + PositionComponent
- **優先度**: 3

### S-05: WeaponSystem
- **責務**: 発射間隔に基づき弾丸エンティティを生成。ターゲティング（最近接敵 or 正面）
- **処理対象**: WeaponComponent + PositionComponent（プレイヤーはWeaponInventoryComponentの全武器を処理）
- **優先度**: 4
- **弾丸数上限管理（NFR-01）**: 弾丸同時表示上限100発。上限到達時は新規弾丸生成をスキップ

### S-06: CollisionSystem
- **責務**: 弾丸-敵の衝突判定。命中時にダメージ適用
- **処理対象**: ColliderComponent + PositionComponent
- **優先度**: 5

### S-07: DefenseLineSystem
- **責務**: 敵が防衛ライン（画面下端-32px）に到達したかチェック。到達時にプレイヤーへダメージ、敵を破棄
- **処理対象**: EnemyComponent + PositionComponent
- **優先度**: 6

### S-08: HealthSystem
- **責務**: HP変動の処理、無敵時間のカウントダウン、HP0判定
- **処理対象**: HealthComponent + PlayerComponent
- **優先度**: 7

### S-09: XPCollectionSystem
- **責務**: XPアイテムとプレイヤーの距離判定、回収処理、XPバー更新
- **処理対象**: XPDropComponent + PositionComponent
- **優先度**: 8

### S-10: RenderSystem
- **責務**: Canvas 2D描画。全SpriteComponentを持つエンティティを描画
- **処理対象**: SpriteComponent + PositionComponent
- **優先度**: 99（最後に実行）
- **Canvas初期化・スケーリング設計（NFR-05）**:
  - 論理解像度: 720x1280（縦型）で描画
  - devicePixelRatio対応: canvas.width/height = 論理解像度 × devicePixelRatio、CSS幅は論理解像度で設定
  - レターボックス: 基準アスペクト比9:16を維持し、余白は黒帯で描画
  - ブラウザリサイズ時: ResizeObserverでCanvas再計算、スケーリング係数を再算出
- **カリング設計（NFR-01）**:
  - 描画前に画面外エンティティをスキップ（表示領域 + マージン判定）
  - 同時描画オブジェクト上限: 500個。超過時は優先度の低いエンティティ（XPアイテム等）をスキップ

### S-12: EffectSystem
- **責務**: 射撃エフェクト（マズルフラッシュ）、敵撃破エフェクト（爆発パーティクル）のライフサイクル管理とアニメーション更新
- **処理対象**: EffectComponent + PositionComponent + SpriteComponent
- **優先度**: 97（RenderSystemの直前）
- **エフェクト管理（NFR-04）**:
  - エフェクトの残存時間（duration）をフレームごとに減算し、0以下で自動破棄
  - 同時エフェクト上限: 50個。超過時は古いエフェクトから破棄
  - アニメーションフレームの進行管理（currentFrame, frameInterval）

### S-11: CleanupSystem
- **責務**: 画面外に出た弾丸・消滅した敵・回収済みXPの破棄
- **処理対象**: 全エンティティ
- **優先度**: 98

---

## マネージャー（ECS外のゲーム管理）

### M-01: GameStateManager
- **責務**: ゲーム状態（TITLE/PLAYING/LEVEL_UP/GAME_OVER）の管理と遷移
- **インターフェース**: 状態変更、現在状態の取得、状態遷移イベントの発火

### M-02: WaveManager
- **責務**: ウェーブ進行管理、敵スポーンスケジュール、ボス出現タイミング
- **インターフェース**: ウェーブ開始、現在ウェーブ取得、スポーン設定の取得

### M-03: SpawnManager
- **責務**: WaveManagerの指示に従い敵エンティティを生成。スポーン位置のランダム化
- **インターフェース**: 敵の生成、スポーン間隔の制御
- **エンティティ上限管理（NFR-01）**:
  - 同時敵数上限: 200体。上限到達時はスポーンを抑制
  - 上限超過時の挙動: 新規スポーンをスキップし、次のスポーンタイミングまで待機
  - 現在の敵数はWorld.query(EnemyComponent)のカウントで判定

### M-04: LevelUpManager
- **責務**: XP管理、レベルアップ判定、強化選択肢の生成、選択結果の適用
- **インターフェース**: XP追加、レベルアップチェック、選択肢取得、選択適用

### M-05: UIManager
- **責務**: HUD描画（HP/XPバー、ウェーブ表示）、タイトル画面、レベルアップ画面、ゲームオーバー画面の管理
- **インターフェース**: HUD更新、画面表示/非表示、ボタンイベント

### M-06: AssetManager
- **責務**: スプライト画像・フォント等のアセット読み込みとキャッシュ
- **インターフェース**: アセットロード、アセット取得

### M-07: AudioManager（将来拡張用スタブ）
- **責務**: サウンド/BGM管理（スコープ外だがインターフェースのみ定義）
- **インターフェース**: 再生、停止、音量設定
