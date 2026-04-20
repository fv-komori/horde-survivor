# Application Design v6 - アイテム刷新（Last War 風アイテム/ゲート導入）

## 設計方針

- **Iter5 アーキテクチャ（GLTF + ECS + AssetManager + AnimationSystem）を土台とし、差分で追加**
- **アイテム 2 系統の分離**: 武器アイテム（樽、撃破で取得） / ゲート（通過で発動、撃てない）
- **旧 `WeaponType` / `ItemType` / `ItemDropManager` / 旧 `itemSpawn` を全廃**、`WeaponGenre` / `BarrelItemType` / `GateType` に置換
- **CollisionSystem は拡張のみ**（新 System 乱立を避ける）、武器切替副作用のみ `WeaponSwitchSystem` で分離
- **HTMLOverlayManager を拡張**して数値ラベルのワールド→スクリーン変換を担当、30Hz スロットリング
- **dispose 責任を Iter5 の方針踏襲**（AssetManager 保持は不変、CleanupSystem が entity 所有物 dispose、cloned material 明示 dispose）
- **テスト決定論性**（PRNG シード固定、強制スポーン API）は debug-only で埋め込み、production では無効化

## アーキテクチャ全体図（v5 からの差分）

```
                        main.ts
                           │
                           ▼  (v5 の初期化フローはそのまま)
                  ┌─────────────────┐
                  │  AssetManager   │  (既存)
                  └────────┬────────┘
                           │ load() (Crate/AK/Shotgun/Pistol は Iter5 で配置済)
                           ▼
                  ┌─────────────────┐
                  │ GameStartScreen │ (既存)
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │   GameService   │ (起動シーケンス、軽微改修)
                  └────┬────────────┘
                       │
                       ▼
    ┌───────────────────────────────────────────────────────┐
    │                     World                             │
    │  ┌────────────────────────────────────────────────┐  │
    │  │  ECS Systems (priority 順、Iter6 追加分を明示)  │  │
    │  │  InputSystem                                   │  │
    │  │  ItemBarrelSpawner        🆕 武器樽スポーン    │  │
    │  │  GateSpawner              🆕 ゲートスポーン     │  │
    │  │  MovementSystem                                │  │
    │  │  CollisionSystem    ⚙️ 拡張（樽HP判定追加）    │  │
    │  │  GateTriggerSystem        🆕 プレイヤー通過判定 │  │
    │  │  WeaponSwitchSystem       🆕 武器切替副作用     │  │
    │  │  BuffSystem          ⚙️ 改修（重複=上書き）    │  │
    │  │  HealthSystem                                  │  │
    │  │  AnimationSystem                               │  │
    │  │  HTMLOverlayManager  ⚙️ 拡張（数値ラベル 30Hz）│  │
    │  │  ThreeJSRenderSystem                           │  │
    │  │  CleanupSystem       ⚙️ 拡張（樽/ゲート dispose）│ │
    │  └────────────────────────────────────────────────┘  │
    │  ┌────────────────────────────────────────────────┐  │
    │  │  Components                                    │  │
    │  │  BarrelItemComponent      🆕 樽HP/タイプ/ラベル│  │
    │  │  GateComponent            🆕 タイプ/効果量/consumed│ │
    │  │  PlayerWeaponComponent    🆕 現武器ジャンル     │  │
    │  │  ActiveBuffsComponent     ⚙️ 改修（複数同時可） │  │
    │  │  (旧 ItemDropComponent 削除)                   │  │
    │  └────────────────────────────────────────────────┘  │
    └───────────────────────────────────────────────────────┘
```

## コンポーネント一覧

### 🆕 新規追加

| ID | 名前 | 種別 | 責務 |
|---|---|---|---|
| C6-01 | **BarrelItemComponent** | ECS Component | 樽 entity の HP / タイプ / 残りラベル表示状態 |
| C6-02 | **GateComponent** | ECS Component | ゲート entity のタイプ / 効果量 / `consumed` フラグ |
| C6-03 | **PlayerWeaponComponent** | ECS Component | プレイヤーの現在武器ジャンル（`WeaponGenre`）、切替時刻 |
| C6-04 | **ItemBarrelSpawner** | ECS System | 武器樽のランダム + Wave境目確定スポーン |
| C6-05 | **GateSpawner** | ECS System | ゲートのランダム + Wave境目確定スポーン |
| C6-06 | **GateTriggerSystem** | ECS System | プレイヤーのゲート通過判定、consumed フラグ更新、効果発火 |
| C6-07 | **WeaponSwitchSystem** | ECS System | 樽撃破イベント受領 → `PlayerWeaponComponent` 更新 + HUD 更新 |
| C6-08 | **WorldToScreenLabel** | UI 機能（HTMLOverlayManager 内の部品） | 3D ワールド座標 → スクリーン座標 → DOM `translate3d` 更新（30Hz スロットリング、DOM プール） |
| C6-09 | **ActiveBuffIcon** | UI 機能（HTMLOverlayManager 内） | アクティブバフ列（アイコン + 残り秒数カウントダウン） |
| C6-10 | **WeaponHudPanel** | UI 機能（HTMLOverlayManager 内） | 画面左下の現武器ジャンル表示（アイコン + 名前、切替時 0.3 秒フラッシュ） |
| C6-11 | **BarrelConfig** | Constants | `BARREL_HP: Record<BarrelItemType, {baseHp; waveScale?}>` |
| C6-12 | **GateConfig** | Constants | `GATE_EFFECTS: Record<GateType, {amount; unit; durationSec?}>` |
| C6-13 | **WeaponConfig（再設計）** | Constants | `WEAPON_PARAMS: Record<WeaponGenre, {fireInterval; bulletCount; spread; damage; piercing}>` |
| C6-14 | **ToastQueue** | UI 機能（HTMLOverlayManager 内） | トースト FIFO キュー（上限 3、同時表示 1、0.8 秒順次、同種連続は延長のみ） |
| C6-15 | **I18nStrings** | Constants | toast / HUD 表示文字列辞書（`WeaponGenre → ラベル` 等） |
| C6-16 | **EventLogger** | Service | 主要イベントを `console.info` に JSON 1 行ログ（FR-09） |
| C6-17 | **DebugConfigLoader** | Service | URL query / `localStorage.debugConfig` から主要パラメータ上書き |
| C6-18 | **DeterministicRng** | Service | テスト用 PRNG シード固定（`window.__setRngSeed(n)`）、`Math.random` を内部で置換 |
| C6-19 | **ForceSpawnApi** | Service（debug-only） | `window.__SPAWN_FORCE_NEXT`, `window.__gameState` を public にする薄いブリッジ |

### ⚙️ 改修

| ID | 名前 | 種別 | 変更内容 |
|---|---|---|---|
| C6-20 | **CollisionSystem** | ECS System | 衝突レイヤ分離: `BULLET↔BARREL`（HP 減算） / `BULLET↔ENEMY`（既存） / `BODY↔BARREL`（なし、すり抜け） / `BODY↔GATE`（`GateTriggerSystem` が担当） |
| C6-21 | **BuffSystem** | ECS System | 同種バフ重複時は「残り時間の長い方で上書き」、GAME_OVER 時は発動停止、複数バフ同時アクティブ対応 |
| C6-22 | **CleanupSystem** | ECS System | 樽破壊時: 樽本体 mesh + cloned material + HUD DOM を dispose。武器 child は `BarrelItemComponent.weaponTransferred` フラグで分岐 — `true`（`WeaponSwitchSystem` が `'transferred'` を返し所有権移譲済）なら武器 child を dispose 対象から外し参照のみ null チェック、`false`（未撃破／`'cloned'`／`'failed'`）なら樽本体と合わせて通常 dispose。ゲート消滅時: プロシージャル geometry / material / HUD DOM を dispose、`GateTriggerSystem.onGateDisposed(id)` を呼び Map リーク防止 |
| C6-23 | **HTMLOverlayManager（Facade）** | UI Manager | **Facade 役**: 内包サブクラス（WorldToScreenLabel / ActiveBuffIcon / WeaponHudPanel / ToastQueue）を DI 保持し、`update(dt)` で 30Hz スロットリングを統括し各サブクラスの `update(dt)` を順次呼ぶ**スロットリング制御役のみ**。DOM プール管理は `WorldToScreenLabel` 内部に閉じる。各 System は必要なサブクラスを **直接 DI で受ける**（BuffSystem → ActiveBuffIcon、WeaponSwitchSystem → WeaponHudPanel + ToastQueue、GateTriggerSystem → ToastQueue）。HTMLOverlayManager への集中依存は禁止 |
| C6-24 | **SpawnManager** | Manager | **敵スポーン / 仲間スポーン（`spawnAlly`）責務は維持**。旧 `itemSpawnTimer` / 旧アイテム降下関連処理のみ削除（新 `ItemBarrelSpawner` / `GateSpawner` へ移行）。Iter6 では `spawnAlly(world)` の**呼出元は GateTriggerSystem.ALLY_ADD のみ**（AllyConversionSystem 削除に伴い、従来の変換経路は廃止）。`spawnAlly` API 自体は継続維持 |
| C6-25 | **EntityFactory** | Factory | `createBarrelItem(world, type, pos)` / `createGate(world, type, pos)` 追加、旧 `createItemDrop` 削除 |
| C6-26 | **GameService** | Service | 新 Systems 登録（priority 順）、`DeterministicRng` / `DebugConfigLoader` 初期化追加、GAME_OVER 遷移時に全 Spawner 停止 |
| C6-27 | **AssetManager** | Manager | `restoreTextures()` の対象に樽 + 武器モデル + ゲート用 material を含める（webglcontextrestored 復旧対応、FR-NFR-01） |
| C6-28 | **HealthComponent（参照のみ）** | ECS Component（既存） | HEAL ゲートの回復対象。プレイヤー entity が持つ既存 `HealthComponent { hp: number; maxHp: number }` を参照し、DefenseLineSystem が敵の跨ぎでこの `hp` を削る。Iter6 で新規追加・改修なし |
| C6-29 | **HealthSystem** | ECS System | GAME_OVER 遷移を検知して `GameService` へ通知（既存踏襲、軽微調整） |

### ❌ 削除

| ID | 名前 | 種別 | 削除理由 |
|---|---|---|---|
| C6-X1 | **ItemDropManager** | Manager | dead code（現状未使用、FR-01） |
| C6-X2 | **ItemCollectionSystem** | ECS System | 既に no-op、完全削除 |
| C6-X3 | **ItemDropComponent** | ECS Component | 旧ジェムアイテム描画用、FR-02 で置換 |
| C6-X4 | **旧 ItemType / ITEM_COLORS / itemTypeToBuff / itemTypeToWeapon** | Types | 全削除（FR-01/02） |
| C6-X5 | **旧 WeaponType enum (FORWARD/SPREAD/PIERCING/BARRAGE)** | Types | `WeaponGenre` に一本化（B-NG-1） |
| C6-X6 | **POWERUP_DROP_WEIGHTS / WEAPON_DROP_TYPES** | Constants | ドロップ機構廃止（FR-01） |
| C6-X7 | **EnemyConfig.itemDropRate / weaponDropRate** | Constants | 同上 |
| C6-X8 | **GAME_CONFIG.itemSpawn** | Constants | 上部降下機構廃止、新 Spawner が別 config 参照 |
| C6-X9 | **`GameService.createItemGeometry()`（SphereGeometry 0.08）** | Method | 旧ジェム描画廃止 |
| C6-X10 | **AllyConversionSystem** | ECS System | **Iter6 で削除**（仲間入手は ALLY_ADD ゲートに一本化、NFR-01 例外扱い） |
| C6-X11 | **CollisionSystem の敵→仲間変換ロジック** | Method | AllyConversionSystem 削除に伴う関連呼出を除去 |
| C6-X12 | **`EnemyConfig.convertChance`（仮称）相当のフィールド** | Constants | 敵撃破時の仲間変換確率、完全削除 |

## コンポーネント責務詳細

### C6-01: BarrelItemComponent

```ts
class BarrelItemComponent extends Component {
  static readonly componentName = 'BarrelItemComponent';
  constructor(
    public type: BarrelItemType,       // WEAPON_RIFLE / WEAPON_SHOTGUN / WEAPON_MACHINEGUN
    public hp: number,                  // 残りHP
    public maxHp: number,               // 初期HP（ラベル表示用）
    public labelDomId: string | null,   // WorldToScreenLabel が割当てる DOM プール ID
    public isBonus: boolean = false,    // Wave境目ボーナスか
    public weaponTransferred: boolean = false,
    //  true  = WeaponSwitchSystem が武器 child を player に移譲済
    //          → CleanupSystem.disposeBarrelEntity は武器 child を dispose しない
    //  false = 未移譲（まだ撃破前、または transferWeaponMesh が cloned fallback/failed）
    //          → CleanupSystem が樽本体と合わせて通常 dispose
  ) { super(); }
}
```

### C6-02: GateComponent

```ts
class GateComponent extends Component {
  static readonly componentName = 'GateComponent';
  constructor(
    public type: GateType,             // ALLY_ADD / ATTACK_UP / SPEED_UP / HEAL
    public amount: number,              // 効果量（unit は GATE_EFFECTS から引く）
    public unit: 'percent' | 'flat' | 'count',
    public durationSec: number | null,  // バフ系のみ有効
    public consumed: boolean = false,   // 発動済みフラグ
    public labelDomId: string | null,
    public isBonus: boolean = false,
  ) { super(); }
}
```

### C6-03: PlayerWeaponComponent

```ts
class PlayerWeaponComponent extends Component {
  static readonly componentName = 'PlayerWeaponComponent';
  constructor(
    public genre: WeaponGenre,          // RIFLE / SHOTGUN / MACHINEGUN
    public switchedAt: number = 0,      // 切替時刻（elapsedTime、HUD フラッシュ継続判定用）
  ) { super(); }
}
```

### C6-04: ItemBarrelSpawner（priority: Iter5 の SpawnManager 相当）

- 毎フレーム `elapsedTime` を進め、タイマー（初回オフセット 12s、次回 12〜15s 均等乱択）到達でスポーン
- GAME_OVER / ポーズ中は停止
- 同時存在上限 3（`world.query(BarrelItemComponent).length < 3`）
- Wave 境目（45s/90s/180s）到達時: 通常キューをスキップして**上位武器**（MACHINEGUN）を確定スポーン、上限 +1 例外許容、`isBonus=true` 付与
- 強制スポーン API（`window.__SPAWN_FORCE_NEXT`）があれば優先
- 生成は `EntityFactory.createBarrelItem()` に委譲

### C6-05: GateSpawner

- 上記 BarrelSpawner と同様の構造（独立タイマー、初回 8s、次回 8〜10s、上限 2）
- Wave 境目: 強化ゲート（効果量 +50%、見た目サイズアップ）を確定スポーン、`isBonus=true`

### C6-06: GateTriggerSystem（priority: CollisionSystem の直後）

- 毎フレーム:
  1. 全ゲート entity を走査
  2. ゲートとプレイヤーの Y 座標を前フレームと比較、**ゲート Y がプレイヤー Y を跨いだ**かつ **X 幅内**なら発動候補
  3. `consumed=true` なら skip（多重発火防止）
  4. 発動時: `GateType` に応じて効果適用（BuffSystem / SpawnManager ally 生成 / DefenseLineComponent 回復）
  5. `consumed=true` + toast 発火 + EventLogger
  6. 次フレーム CleanupSystem でゲート消滅
- **仲間 entity は判定対象外**（Y 跨ぎを検知しても無視）

### C6-07: WeaponSwitchSystem（priority: CollisionSystem の直後、GateTriggerSystem と並列）

- CollisionSystem から「樽破壊イベント」を受領（EntityId + BarrelItemType）
- `PlayerWeaponComponent.genre` を更新、`switchedAt` に `elapsedTime` 記録
- 樽上の武器モデル（child mesh）を**プレイヤー装備へ所有権移譲**（樽側は参照 null 化、CleanupSystem は dispose 対象から外す）
- toast 発火（i18n: 「RIFLE を取得！」）
- EventLogger: `weapon_switch`

### C6-08: WorldToScreenLabel（HTMLOverlayManager 内部、Facade のサブクラス）

```ts
class WorldToScreenLabel {
  private pool: HTMLDivElement[] = [];      // 固定プール 6 スロット
  private assigned: Map<EntityId, { el: HTMLDivElement; acquiredAt: number; priority: 'normal' | 'bonus' }> = new Map();
  private w_cache: number;                  // canvas width（ResizeObserver で更新）
  private h_cache: number;                  // canvas height

  acquire(entityId: EntityId, initialText: string, priority: 'normal' | 'bonus' = 'normal'): HTMLDivElement | null {
    // 空きスロットがあれば通常割当
    // 枯渇時 + 新規が 'bonus': assigned のうち priority='normal' で acquiredAt が最古の
    //                          エントリを release してロールオーバー（最古の非ボーナスラベルを犠牲に）
    // 枯渇時 + 新規が 'normal': null を返し、呼出側はラベル無しで継続（entity は生き残る）
  }
  release(entityId: EntityId): void { /* visibility:hidden で戻す */ }

  update(scene: Scene, camera: Camera): void {
    // HTMLOverlayManager Facade がドレイン型 30Hz で呼ぶ
    const v = new THREE.Vector3();
    for (const [entityId, slot] of this.assigned) {
      const worldPos = getWorldPos(entityId);       // 登録時に渡された getter
      v.copy(worldPos).project(camera);             // NDC [-1, 1]
      if (v.z > 1 || v.z < -1) {
        slot.el.style.visibility = 'hidden';        // 画面裏 or near/far clip 外
        continue;
      }
      const x_px = (v.x * 0.5 + 0.5) * this.w_cache;
      const y_px = (1 - (v.y * 0.5 + 0.5)) * this.h_cache;  // Y 反転
      if (x_px < 0 || x_px > this.w_cache || y_px < 0 || y_px > this.h_cache) {
        slot.el.style.visibility = 'hidden';        // 画面外
      } else {
        slot.el.style.visibility = 'visible';
        slot.el.style.transform = `translate3d(${x_px}px, ${y_px}px, 0)`;
      }
    }
  }

  onResize(w: number, h: number): void { this.w_cache = w; this.h_cache = h; }  // ResizeObserver コールバック
  resetAll(): void;                     // HTMLOverlayManager.resetAllLabels から呼出、全スロット visibility:hidden + assigned クリア
  dispose(): void;
}
```

**実装制約**:
- ResizeObserver は HTMLOverlayManager.init で canvas を観測、変更時 `worldToScreenLabel.onResize(width, height)` を呼ぶ（毎フレーム `canvas.clientWidth` を読まず layout thrashing 回避）
- プール固定サイズ 6（= 通常上限 5 + Wave 境目例外 1）
- ロールオーバー規則: bonus が normal を押し退ける（逆は不可）

### C6-14: ToastQueue

- FIFO、上限 3、表示中 1 件、0.8 秒で次へ
- 同種連続時は current の remaining を 0.8 秒にリセット、新規push しない
- 「MAX」代替 toast は通常 toast と同じキューを共有

## 削除対象の詳細 grep チェックリスト（AC-01 で自動検証）

| パターン | 期待 grep 結果 |
|---|---|
| `ItemDropManager` | 0 件 |
| `determineDrops` | 0 件 |
| `POWERUP_DROP_WEIGHTS` | 0 件 |
| `WEAPON_DROP_TYPES` | 0 件 |
| `ItemType\.` / `enum ItemType` | 0 件 |
| `ITEM_COLORS` | 0 件 |
| `itemTypeToBuff` / `itemTypeToWeapon` | 0 件 |
| `enum WeaponType\s*\{` | 0 件（`WeaponGenre` に置換済） |
| `SphereGeometry\(0\.08` | 0 件（旧ジェム描画） |
| `itemDropRate` / `weaponDropRate` | 0 件 |
| `GAME_CONFIG\.itemSpawn` | 0 件 |
| `ItemDropComponent` | 0 件 |
| `ItemCollectionSystem` | 0 件 |

## Wave 境目ボーナス仕様（詳細）

| 時刻 | 通常枠 | ボーナス確定種別（交互固定、A-NG-8 確定） |
|---|---|---|
| 45s  | 継続 | **MACHINEGUN 樽**（HP +50% ≒ 75、`isBonus=true`） |
| 90s  | 継続 | **強化ゲート**（効果量 +50%、サイズアップ、`isBonus=true`） |
| 180s | 継続 | **MACHINEGUN 樽**（HP +50% ≒ 75、`isBonus=true`） |

- ボーナス種別は **45s=樽 / 90s=ゲート / 180s=樽 の交互固定**（実装・AC 明確化のため乱択は採用しない）
- 同時存在上限を +1 例外許容（DOM プール 6 スロットの余剰 1 枠で吸収）
- 強調装飾: リング発光（`MeshToonMaterial.emissive = 0xffcc00`）+ ラベル上部に "BONUS" 文字列（i18n 辞書）
- 画面上部トースト: `WAVE` kind で `I18nStrings.wave.transition(n)` 文言
- 重複発火防止: `WaveState.bonusFiredAt: Set<number>` で各境目 1 回限り（B-NG-3）
