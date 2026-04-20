# コンポーネント依存関係 - Iteration 6（差分）

（Iter5 の依存関係は v5 ファイル参照、本ドキュメントは Iter6 新規/変更分の依存のみ記載）

## 全体依存グラフ（Iter6 追加分）

```
                      main.ts
                         │
                         │ init
                         ▼
                ┌────────────────┐
                │  AssetManager  │ (既存, v5)
                │  + restoreTextures 拡張
                └───────┬────────┘
                        │
                        │ cloneBarrelTemplate / cloneWeaponTemplate
                        ▼
                ┌───────────────────┐
                │   GameService     │ (改修)
                │  + DebugConfigLoader 初期化
                │  + DeterministicRng 初期化
                │  + ForceSpawnApi 初期化
                │  + EventLogger 初期化
                │  + GAME_OVER フック
                └────┬──────────────┘
                     │ 生成 / 配線
                     ▼
        ┌────────────────────────────────────────────────┐
        │                  World / Systems                │
        │                                                 │
        │  ┌─────────────────────┐                       │
        │  │ DeterministicRng    │◄────── Spawner系       │
        │  └─────────────────────┘                       │
        │                                                 │
        │  ┌─────────────────────┐    ┌──────────────┐    │
        │  │ ItemBarrelSpawner   │───►│EntityFactory │    │
        │  │ (新規 System)        │    │ (改修)       │    │
        │  └────┬────────────────┘    │ createBarrel │    │
        │       │                     │ createGate   │    │
        │       │                     └──┬───────────┘    │
        │  ┌────▼────────────────┐       │                │
        │  │ GateSpawner         │───────┤                │
        │  │ (新規 System)        │       │                │
        │  └─────────────────────┘       │                │
        │                                │                │
        │                                ▼                │
        │               ┌────────────────────────┐        │
        │               │ Entity (樽 / ゲート)     │        │
        │               │  BarrelItemComponent    │        │
        │               │  GateComponent          │        │
        │               │  MeshComponent          │        │
        │               │  Position / Velocity    │        │
        │               └──────┬─────────────────┘        │
        │                      │                           │
        │                      │ HTMLOverlayManager に     │
        │                      │ registerLabeledEntity     │
        │                      │                           │
        │  ┌───────────────────▼──────────────┐           │
        │  │    CollisionSystem (拡張)         │           │
        │  │    - 弾 x 樽: hp 減算             │           │
        │  │    - body x 樽: すり抜け          │           │
        │  └────┬───────────┬──────────────────┘           │
        │       │           │                              │
        │       │ (HP 0)    │                              │
        │       ▼           ▼                              │
        │  ┌─────────────┐  ┌──────────────────────────┐   │
        │  │ Weapon      │  │ GateTriggerSystem (新規)  │   │
        │  │ SwitchSystem│  │ - プレイヤー通過判定      │   │
        │  │ (新規)       │  │ - consumed フラグ更新     │   │
        │  │             │  │ - 効果発動                │   │
        │  └────┬────────┘  └────┬─────────────────────┘   │
        │       │                │                          │
        │       │                │                          │
        │       ▼                ▼                          │
        │  ┌─────────────────────────────┐                  │
        │  │ BuffSystem (改修)            │                  │
        │  │ + SpawnManager (ally 追加)   │                  │
        │  │ + HealthComponent 回復       │                  │
        │  └────┬────────────────────────┘                  │
        │       │                                           │
        │       ▼                                           │
        │  ┌──────────────────────────────┐                 │
        │  │  HTMLOverlayManager (拡張)    │                 │
        │  │  ┌───────────────────────┐   │                 │
        │  │  │ WorldToScreenLabel    │   │                 │
        │  │  │ (DOM プール 6 スロット)│   │                 │
        │  │  └───────────────────────┘   │                 │
        │  │  ┌───────────────────────┐   │                 │
        │  │  │ ActiveBuffIcon         │   │                 │
        │  │  └───────────────────────┘   │                 │
        │  │  ┌───────────────────────┐   │                 │
        │  │  │ WeaponHudPanel         │   │                 │
        │  │  └───────────────────────┘   │                 │
        │  │  ┌───────────────────────┐   │                 │
        │  │  │ ToastQueue (FIFO)      │   │                 │
        │  │  └───────────────────────┘   │                 │
        │  └──────────────────────────────┘                 │
        │                                                    │
        │  ┌──────────────────────────────┐                  │
        │  │   CleanupSystem (拡張)        │                  │
        │  │   - 樽 dispose / cloned mat.  │                  │
        │  │   - 武器 child 所有権移譲     │                  │
        │  │   - ゲート dispose            │                  │
        │  │   - ラベル DOM プール返却     │                  │
        │  └──────────────────────────────┘                  │
        │                                                    │
        │  ┌──────────────────────────────┐                  │
        │  │   EventLogger (info/error)    │◄─── 各System    │
        │  └──────────────────────────────┘                  │
        └────────────────────────────────────────────────────┘
```

## 依存マトリクス（Iter6 追加 System / Component）

| 呼出元 ↓ / 呼出先 → | AssetMgr | EntityFactory | CollisionSys | WeaponSwitch | GateTrigger | BuffSystem | SpawnMgr | HTMLOverlay | ToastQueue | EventLogger | DeterministicRng | DebugCfg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **GameService** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| **ItemBarrelSpawner** | — | ✓ | — | — | — | — | — | — | — | — | ✓ | — |
| **GateSpawner** | — | ✓ | — | — | — | — | — | — | — | — | ✓ | — |
| **CollisionSystem** | — | — | — | ✓ (enqueue) | — | — | — | ✓ (hideLabel) | — | — | — | — |
| **WeaponSwitchSystem** | — | — | — | — | — | — | — | ✓ (setGenre) | ✓ | ✓ | — | — |
| **GateTriggerSystem** | — | — | — | — | — | ✓ | ✓ (spawnAlly) | — | ✓ | ✓ | — | — |
| **BuffSystem** | — | — | — | — | — | — | — | ✓ (setActiveBuffs) | — | — | — | — |
| **HTMLOverlayManager** | — | — | — | — | — | — | — | — | — | — | — | — |
| **CleanupSystem** | — | — | — | — | — | — | — | ✓ (release) | — | — | — | — |
| **EntityFactory** | ✓ | — | — | — | — | — | — | ✓ (register) | — | — | — | — |

## 通信パターン

### 1. 直接呼出（同期）
- **CollisionSystem → WeaponSwitchSystem.enqueueSwitch()**: 弾命中で HP 0 到達時に pending キューへ追加（同一フレーム内の副作用を避け、次 System update で処理）
- **GateTriggerSystem → BuffSystem.applyOrExtend()**: ATTACK_UP / SPEED_UP 発動時
- **GateTriggerSystem → SpawnManager.spawnAlly()**: ALLY_ADD 発動時
- **Spawner → EntityFactory.createBarrelItem() / createGate()**: スポーンタイミング到達時
- **EntityFactory → HTMLOverlayManager.registerLabeledEntity()**: entity 生成時にラベル DOM プール確保
- **CleanupSystem → HTMLOverlayManager.hideLabel() / releaseLabel()**: 破棄時に DOM プール返却

### 2. Pull 型（getter 経由）
- **HTMLOverlayManager ← BuffSystem.getActiveBuffs()**: update 時に現在のバフ一覧を取得
- **ItemBarrelSpawner ← WaveState.elapsedTime**: Wave 境目判定

### 3. イベント（現状は直接呼出で十分、EventBus 導入は過剰）
- Iter6 では EventBus は導入しない。`enqueueSwitch` / `pendingSwitches` の配列スタイルで同期次 System 更新時に処理する
- `EventLogger.info()` は副作用ログのみで、他 System の入力にはならない

### 4. dispose 責任チェーン
```
CleanupSystem
  ├─ BarrelItemComponent 所有 entity:
  │    ├─ Mesh (geometry 共有) / cloned Material → dispose
  │    ├─ 武器 child：WeaponSwitchSystem 戻り値基準で分岐
  │    │    ├─ 'transferred' (weaponTransferred=true) → 参照 null 化のみ（player が所有）
  │    │    ├─ 'cloned'      (weaponTransferred=false) → 樽側 child を通常 dispose
  │    │    │                                            （player 側は別 clone なのでそのまま）
  │    │    └─ 'failed'      (weaponTransferred=false) → 樽側 child を通常 dispose
  │    └─ HTMLOverlayManager.release(labelId) → DOM プール返却
  ├─ GateComponent 所有 entity:
  │    ├─ procedural geometry / material → dispose
  │    ├─ GateTriggerSystem.onGateDisposed(id) → prevGateY/initialized Map エントリ削除
  │    └─ HTMLOverlayManager.release(labelId)
  └─ （既存）SkinnedMesh/mixer/action dispose
```

## 新 Systems の優先度順序（priority 数値は Construction で確定）

```
priority 1  : InputSystem
priority 2  : AISystem / EnemyAISystem
priority 3.0: SpawnManager (敵スポーン)       ← 既存
priority 3.1: ItemBarrelSpawner              ← 🆕
priority 3.2: GateSpawner                    ← 🆕
priority 4  : MovementSystem
priority 5  : CollisionSystem                ← ⚙️ 拡張
priority 6.0: GateTriggerSystem              ← 🆕
priority 6.1: WeaponSwitchSystem             ← 🆕
priority 7  : BuffSystem                     ← ⚙️ 改修
priority 8  : HealthSystem
priority 9  : AnimationSystem
priority 10 : HTMLOverlayManager.update      ← ⚙️ 拡張（Facade）
priority 11 : ThreeJSRenderSystem
priority 12 : CleanupSystem                  ← ⚙️ 拡張
```

## 初期化順序（GameService.init 内）

```
1. DebugConfigLoader.load()                       ← 上書き値の確定
2. DeterministicRng.init(cfg.rngSeed)             ← seed ありなら決定論モード
3. ForceSpawnApi.init()                           ← __SPAWN_FORCE_NEXT / __gameState 公開（debug only）
4. EventLogger (new)
5. SceneManager / QualityManager / PostFXManager  ← v5 既存
6. EntityFactory(new, AssetManager DI)
7. SceneManager.setupEnvironment()
8. World / Systems 登録
   - 新 System は上記 priority 順で登録
9. Player 初期 entity + PlayerWeaponComponent(初期 genre=RIFLE)
10. HTMLOverlayManager.init()                     ← DOM プール 6 スロット作成、WeaponHudPanel 初期表示
11. AudioManager.init()
12. GameLoop 開始
```

## 破棄時のシーケンス（GAME_OVER → 新ゲーム / ページ遷移）

```
onGameOver():
  1. ItemBarrelSpawner.enabled = false
  2. GateSpawner.enabled = false
  3. GateTriggerSystem.enabled = false
  4. WeaponSwitchSystem.enabled = false
  5. BuffSystem: 新規 applyOrExtend を no-op 化（既存バフは継続）
  6. 在空 entity は CleanupSystem の通常処理で dispose

newGame() / teardown():
  7. world.clear() 前に CleanupSystem.forceDisposeAll()
  8. HTMLOverlayManager.resetAllLabels() / resetToastQueue()
  9. ItemBarrelSpawner.reset() / GateSpawner.reset()（timer を初回オフセットに戻す）
  10. BuffSystem.clearAll()
  11. PlayerWeaponComponent.genre = RIFLE（初期値復帰）
  12. PlayerWeaponComponent.currentWeaponMesh を dispose して null（B-NG-18）
  13. WaveState.bonusFiredAt.clear()（Wave 境目再発火を許可、B-NG-3 / O-NG-11）
  14. GateTriggerSystem: prevGateY.clear() / initialized.clear() / prevPlayerY=0 / playerInitialized=false
  15. WeaponSwitchSystem.pendingSwitches = []（未処理キューをクリア、O-NG-11）
  16. DeterministicRng: seed 指定時は state を seed 値に再セット、未指定時は no-op
  17. ForceSpawnApi.forcedBarrel = null / forcedGate = null（debug only、O-NG-11）
```

## Iter5 既存コンポーネントへの影響範囲

| v5 コンポーネント | Iter6 での変更 |
|---|---|
| GameService | 新 Systems 登録、init 順序に DebugConfig/Rng/EventLogger 追加、GAME_OVER フック |
| AssetManager | `restoreTextures` の対象拡大、`cloneBarrelTemplate` / `cloneWeaponTemplate` 新設 |
| EntityFactory | `createBarrelItem` / `createGate` 追加、`createItemDrop` 削除 |
| CollisionSystem | 弾 x 樽判定追加、レイヤマスク分離 |
| CleanupSystem | 樽/ゲート dispose 分岐追加 |
| HTMLOverlayManager | 大幅拡張（WorldToScreenLabel / ActiveBuffIcon / WeaponHudPanel / ToastQueue） |
| HealthSystem | GAME_OVER 遷移通知を GameService.onGameOver() へ |
| SpawnManager | 敵スポーンは維持、旧 `itemSpawn` 処理削除（新 Spawner へ移行） |
| BuffSystem | `applyOrExtend` API、`getActiveBuffs()` getter、GAME_OVER 対応 |
| HealthComponent | 既存 `hp` / `maxHp` をそのまま使用（Iter6 で改修なし、HEAL ゲート回復対象として参照） |
| MeshComponent | 変更なし |
| AnimationSystem / AnimationStateComponent | 変更なし（樽/ゲートはスケルトンなし、animation 非対象） |
| SceneManager | 変更なし |

## リスクと緩和策

| リスク | 緩和策 |
|---|---|
| 旧 `WeaponType` 依存コードの取りこぼしによるビルド失敗 | AC-01 の grep 検証、tsc clean で検出 |
| DOM プール不足で Wave 境目例外時にラベル表示が欠落 | 固定 6 スロット（= 5 上限 + 1 例外）で対応、不足時は最優先（直近生成）にロールオーバー |
| 樽 material clone の shader 再コンパイル発生 | `material.color` のみ変更、`onBeforeCompile` 追加禁止、`renderer.info.programs.length` AC で検証 |
| 決定論モードが production に漏れて `__setRngSeed` が悪用される | `import.meta.env.PROD` ガード、Vite dead-code elimination で確認 |
| ゲート通過検知の符号変化判定がフレーム落ち時に誤動作 | `prevGateY` / `prevPlayerY` を entity 個別に保持、dt 依存の累積ではなく前フレーム絶対値で判定 |
| 武器所有権移譲失敗（樽破壊時に武器モデルが消える） | `WeaponSwitchSystem.transferWeaponMesh` 内で detach → attach を try/catch、失敗時は新規 clone でフォールバック |
| MetricsProbe が +10MB 超過 | CleanupSystem の dispose 漏れ検出テスト、cloned material 数の実測を Jest で |
| bundle +20KB 超過 | 新規 import の tree-shake 確認、`size-limit` CI で fail |
