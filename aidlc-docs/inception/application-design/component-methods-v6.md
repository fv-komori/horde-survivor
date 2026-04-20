# コンポーネントメソッド定義 - Iteration 6

（Iter6 で新規/変更されたコンポーネントのみ記載。v5 既存コンポーネントで変更のないものは components-v5 / component-methods-v5 参照）

---

## C6-01: BarrelItemComponent

```ts
class BarrelItemComponent extends Component {
  static readonly componentName = 'BarrelItemComponent';
  constructor(
    public type: BarrelItemType,
    public hp: number,
    public maxHp: number,
    public labelDomId: string | null = null,
    public isBonus: boolean = false,
    public weaponTransferred: boolean = false,  // WeaponSwitchSystem 成功時 true、CleanupSystem の分岐キー
  ) { super(); }
}
```

メソッドなし（値オブジェクト）。

---

## C6-02: GateComponent

```ts
class GateComponent extends Component {
  static readonly componentName = 'GateComponent';
  constructor(
    public type: GateType,
    public amount: number,
    public unit: 'percent' | 'flat' | 'count',
    public durationSec: number | null,
    public widthHalf: number = 1.5,    // X 幅（通過判定用、半値）
    public consumed: boolean = false,
    public labelDomId: string | null = null,
    public isBonus: boolean = false,
  ) { super(); }
}
```

---

## C6-03: PlayerWeaponComponent

```ts
class PlayerWeaponComponent extends Component {
  static readonly componentName = 'PlayerWeaponComponent';
  constructor(
    public genre: WeaponGenre,
    public switchedAt: number = 0,
    public currentWeaponMesh: Object3D | null = null,
    //  プレイヤーが現在装備している武器 Object3D 参照（B-NG-18）
    //  - transferred ルート: barrel 由来の Mesh を attach、樽 dispose 時に影響なし
    //  - cloned ルート:      AssetManager.cloneWeaponTemplate で新規 clone、次回切替時に dispose 要
    //  - WeaponSwitchSystem が切替成功のたびに 前 mesh を dispose し、新 mesh の参照に更新
    //  - newGame / teardown 時も dispose 対象
  ) { super(); }
}
```

---

## C6-03b: ActiveBuffsComponent（改修）

```ts
class ActiveBuffsComponent extends Component {
  static readonly componentName = 'ActiveBuffsComponent';
  // 同時複数バフ対応（GateType 単位で最大 1 エントリ、同種は上書き）
  public buffs: Map<GateType, { remaining: number; amount: number }>;

  constructor(buffs?: Map<GateType, { remaining: number; amount: number }>) {
    super();
    this.buffs = buffs ?? new Map();
  }
}
```

**ビジネスルール**:
- `BuffSystem.applyOrExtend(type, amount, durationSec)` が `buffs.set(type, { remaining: max(existing?.remaining ?? 0, durationSec), amount })`
- `BuffSystem.update(dt)` が各 `remaining -= dt`、0 以下で `buffs.delete(type)`
- `BuffSystem.getActiveBuffs()` は `[...buffs.entries()].map(...)` で `ActiveBuff[]` を返す
- 対象 GateType は `ATTACK_UP | SPEED_UP` のみ（HEAL/ALLY_ADD は即時効果で継続バフなし）

---

## C6-04: ItemBarrelSpawner

```ts
class ItemBarrelSpawner implements System {
  readonly priority: number;
  enabled: boolean = true;

  constructor(
    private entityFactory: EntityFactory,
    private waveState: WaveState,
    private rng: DeterministicRng,
    debugConfig: DebugConfig,
  );

  update(world: World, dt: number): void;           // スポーンロジック実行
  private nextInterval(): number;                    // [12, 15] 均等乱択
  private checkWaveBonus(world: World): void;       // 45/90/180s 到達検知
  private selectRandomType(): BarrelItemType;        // 重み付き乱択
  private randomSpawnPosition(): Position;
  reset(): void;                                     // GAME_OVER / 新ゲーム時
}
```

---

## C6-05: GateSpawner

```ts
class GateSpawner implements System {
  readonly priority: number;
  enabled: boolean = true;
  constructor(
    private entityFactory: EntityFactory,
    private waveState: WaveState,
    private rng: DeterministicRng,
    debugConfig: DebugConfig,
  );
  update(world: World, dt: number): void;
  private nextInterval(): number;                    // [8, 10]
  private checkWaveBonus(world: World): void;
  private selectRandomType(): GateType;
  private randomSpawnPosition(): Position;
  reset(): void;
}
```

---

## C6-06: GateTriggerSystem

```ts
class GateTriggerSystem implements System {
  readonly priority: number;
  enabled: boolean = true;

  // 前フレーム Y を entity 個別に保持（B-NG-1 / F-NG-7）
  private prevPlayerY: number;
  private prevGateY: Map<EntityId, number>;
  private initialized: Set<EntityId>;  // 作成直後の 1 フレームは判定スキップ

  constructor(
    private buffSystem: BuffSystem,
    private spawnManager: SpawnManager,
    private effectManager: EffectManager3D,
    private toastQueue: ToastQueue,
    private eventLogger: EventLogger,
  );

  // EntityFactory.createGate 完了時に呼ぶ
  onGateCreated(gateId: EntityId, initialY: number): void;
  // CleanupSystem.disposeGateEntity から呼ぶ（Map リーク防止）
  onGateDisposed(gateId: EntityId): void;

  update(world: World, dt: number): void;
  private trigger(world: World, gate: Entity): void;  // 効果発動
}
```

**ビジネスルール**:
- 発動条件: プレイヤー entity のみ、ゲート X 幅内、ゲート Y がプレイヤー Y を跨ぐ瞬間（前フレームとの相対符号変化）
- ゲート作成直後の 1 フレーム目は判定スキップ（`initialized` 未セット）
- `consumed=true` なら以降の通過を無視
- Map リーク防止: dispose 時に `onGateDisposed()` 必須
- ALLY_ADD 上限到達時は `added=0` で "ALLY MAX" toast、ゲート自身は消滅
- HEAL 満タン時は `actual=0` で "HP MAX" toast、ゲート自身は消滅
- ATTACK_UP / SPEED_UP: 既存 `BuffSystem.applyOrExtend()` へ委譲

---

## C6-07: WeaponSwitchSystem

```ts
class WeaponSwitchSystem implements System {
  readonly priority: number;
  enabled: boolean = true;

  private pendingSwitches: Array<{ barrelId: EntityId; type: BarrelItemType }>;

  constructor(
    private toastQueue: ToastQueue,
    private weaponHudPanel: WeaponHudPanel,
    private eventLogger: EventLogger,
    private boneAttachmentConfig: BoneAttachmentConfig,
    private assetManager: AssetManager,  // fallback clone 用
    private waveState: WaveState,         // elapsedTime 参照用
  );

  enqueueSwitch(barrelId: EntityId, type: BarrelItemType): void;
  update(world: World, dt: number): void;

  // 戻り値:
  //   'transferred' = 樽 child を player へ attach 成功（樽側 weaponTransferred=true）
  //   'cloned'      = attach 失敗 → AssetManager.cloneWeaponTemplate() で fallback 成功
  //                   （樽 child は CleanupSystem が通常 dispose、weaponTransferred=false）
  //   'failed'      = fallback も失敗 → 呼出側で genre/switchedAt を rollback
  private transferWeaponMesh(
    barrel: Entity,
    player: Entity,
    newGenre: WeaponGenre,
  ): 'transferred' | 'cloned' | 'failed';
}
```

**契約 (4 ステップ)**:
1. **detach**: barrel の weapon child Object3D を特定
2. **attach**: `Object3D.attach()` で world matrix を保持したまま player.handBone へ付け替え。`BoneAttachmentConfig[newGenre]` の offset/rotation を適用。直後に `matrixAutoUpdate=false` + `updateMatrix()` を 1 回呼ぶ
3. **成功確認**: player subtree に含まれかつ parent !== barrel
4. **null 化 + フラグ**: 成功時のみ `barrel.weaponChild = null` かつ `BarrelItemComponent.weaponTransferred = true`

失敗時は try/catch で `AssetManager.cloneWeaponTemplate(newGenre)` を試行し player に attach（'cloned'）。それも失敗で 'failed' を返す。'failed' 受領時に呼出 `update()` は `PlayerWeaponComponent.genre / switchedAt` を rollback する。EventLogger.error は fallback/失敗時に出力。

---

## C6-08: WorldToScreenLabel（HTMLOverlayManager 内部）

```ts
class WorldToScreenLabel {
  private pool: HTMLDivElement[];              // 6 要素固定
  private assigned: Map<EntityId, { el: HTMLDivElement; acquiredAt: number; priority: 'normal' | 'bonus' }>;

  // priority='bonus' は Wave 境目ボーナス樽/ゲート（ロールオーバー時に保護）
  acquire(entityId: EntityId, initialText: string, priority?: 'normal' | 'bonus'): HTMLDivElement | null;
  //   空きスロットがあれば通常割当
  //   枯渇時 + 新規が 'bonus': assigned のうち priority='normal' で acquiredAt が最古の
  //     エントリを release してロールオーバー（最古の非ボーナスラベルを犠牲に）
  //   枯渇時 + 新規が 'normal': 割当失敗（null 返し）、呼出側はラベル無しで継続（entity は生き残る）
  release(entityId: EntityId): void;
  setText(entityId: EntityId, text: string): void;

  // ドレイン型スロットリングで呼ばれる（毎フレームではなく 1/30 秒に 1 回）
  update(scene: Scene, camera: Camera): void;
  // 内部で各 labeled entity について camera.project で NDC 変換
  // NDC→px: x_px = (ndc.x * 0.5 + 0.5) * w_cache,  y_px = (1 - (ndc.y * 0.5 + 0.5)) * h_cache
  // ndc.z > 1 || ndc.z < -1 の場合 visibility:hidden（画面外/裏側）
  // w_cache / h_cache は ResizeObserver で canvas サイズ変更時に更新

  onResize(w: number, h: number): void;  // ResizeObserver コールバック
  resetAll(): void;                      // HTMLOverlayManager.resetAllLabels から呼出、全スロット visibility:hidden + assigned クリア
  dispose(): void;
}
```

**実装制約**:
- `innerHTML` 禁止、`textContent` のみ使用
- 画面外 entity は `visibility:hidden` でレンダリング除外（NDC z 範囲外 or xy が [0,1] 外）
- 30Hz スロットリングは HTMLOverlayManager Facade 側でドレイン制御
- プール固定サイズ 6（= 通常上限 5 + Wave 境目例外 1）
- ロールオーバー規則: bonus が normal を押し退ける（逆は不可）

---

## C6-09: ActiveBuffIcon

```ts
class ActiveBuffIcon {
  private slots: HTMLDivElement[];             // 3 スロット

  setBuffs(active: ActiveBuff[]): void;        // 現在アクティブなバフで再配置
  updateCountdowns(dt: number): void;          // 各スロットの残り秒数 textContent 更新
  dispose(): void;
}

type ActiveBuff = {
  type: GateType;                              // ATTACK_UP | SPEED_UP
  remaining: number;
};
```

---

## C6-10: WeaponHudPanel

```ts
class WeaponHudPanel {
  private root: HTMLDivElement;
  private iconEl: HTMLImageElement;
  private nameEl: HTMLSpanElement;
  private flashRemaining: number = 0;

  setGenre(genre: WeaponGenre): void;         // アイコン / 名前更新 + フラッシュトリガー
  updateFlash(dt: number): void;               // フラッシュ継続中の描画更新 (CSS class toggle)
  dispose(): void;
}
```

---

## C6-14: ToastQueue

```ts
class ToastQueue {
  private queue: ToastEntry[];                 // 上限 3
  private current: { entry: ToastEntry; remaining: number } | null;

  push(entry: ToastEntry): void;               // 同種連続は延長のみ、キュー超過は古い順に破棄
  tick(dt: number): void;                      // 現在 toast の remaining 減算、0 でキュー先頭を pop
  dispose(): void;
}

type ToastEntry = {
  kind: 'WEAPON' | 'GAIN' | 'BUFF' | 'MAX' | 'WAVE';
  text: string;                                // i18n 済みの最終文字列（Number.toString 済み）
  durationSec: number;                         // デフォルト 0.8
};
```

---

## C6-15: I18nStrings

```ts
export const I18nStrings = {
  weapon: {
    [WeaponGenre.RIFLE]: 'ライフル',
    [WeaponGenre.SHOTGUN]: 'ショットガン',
    [WeaponGenre.MACHINEGUN]: 'マシンガン',
  } as const,
  gate: {
    [GateType.ALLY_ADD]: '仲間追加',
    [GateType.ATTACK_UP]: '攻撃UP',
    [GateType.SPEED_UP]: '移動速UP',
    [GateType.HEAL]: '回復',
  } as const,
  max: {
    ally: 'ALLY MAX',
    heal: 'HP MAX',
  } as const,
  wave: {
    transition: (n: number) => `Wave ${n} クリア！ ボーナス出現！`,
  } as const,
};
```

---

## C6-16: EventLogger

```ts
class EventLogger {
  info(event: string, payload: Record<string, unknown>): void;  // console.info(JSON) 1 行
  error(event: string, payload: Record<string, unknown>): void; // console.error、本番も残す
}
```

---

## C6-17: DebugConfigLoader

```ts
type DebugConfig = {
  rngSeed?: number;
  barrelIntervalMin?: number;
  barrelIntervalMax?: number;
  gateIntervalMin?: number;
  gateIntervalMax?: number;
  forceNextBarrel?: BarrelItemType;
  forceNextGate?: GateType;
};

class DebugConfigLoader {
  static load(): DebugConfig;    // 本番は空オブジェクトを返す
}
```

---

## C6-18: DeterministicRng

```ts
class DeterministicRng {
  private static seed: number | null;
  private static state: number;

  static init(seedFromDebugConfig?: number): void;
  static next(): number;                    // seed あり: LCG、なし: Math.random()
  // __setRngSeed(n) は init() 内で window に生やす（debug only）
}
```

---

## C6-19: ForceSpawnApi

```ts
class ForceSpawnApi {
  private static forcedBarrel: BarrelItemType | null = null;
  private static forcedGate: GateType | null = null;

  static init(): void {
    if (!import.meta.env.PROD) {
      (window as any).__SPAWN_FORCE_NEXT = {
        barrel: (type: BarrelItemType) => { this.forcedBarrel = type; },
        gate:   (type: GateType)       => { this.forcedGate = type; },
      };
      (window as any).__gameState = { /* ally_count, buff_state, current_weapon 等を getter で公開 */ };
    }
  }

  static consumeForcedBarrel(): BarrelItemType | null;
  static consumeForcedGate(): GateType | null;
}
```

---

## C6-20: CollisionSystem（拡張）

### 新規追加メソッド

```ts
class CollisionSystem implements System {
  // ... 既存メソッド

  // Iter6 追加
  private checkBulletBarrel(world: World, bullet: Entity, barrel: Entity): void;
  // 樽レイヤとのみ判定、HP 減算、HP<=0 で WeaponSwitchSystem へ enqueue
  // 敵レイヤとは別（レイヤマスク）
}
```

**追加ロジック**:
- 弾 x 樽: ダメージ = bullet.damage、barrel.hp -= damage、0 以下で `WeaponSwitchSystem.enqueueSwitch()` 呼び出し + `HTMLOverlayManager.hideLabel(barrel.id)`
- プレイヤー/仲間 x 樽: すり抜け（判定スキップ）
- プレイヤー/仲間 x ゲート: `GateTriggerSystem` 担当のためここでは処理しない

---

## C6-21: BuffSystem（改修）

### 既存 API 拡張

```ts
class BuffSystem implements System {
  applyOrExtend(type: GateType, amount: number, durationSec: number): void;
  // 既にアクティブな同種バフがあれば、残り時間の長い方で上書き
  // 新規の場合は ActiveBuffsComponent に追加

  getActiveBuffs(): ActiveBuff[];  // HTMLOverlayManager 向け getter
}
```

**ビジネスルール**:
- 同種連続: 残り時間 = `max(existing.remaining, durationSec)`（長い方で上書き）
- GAME_OVER 中は `applyOrExtend` を no-op に
- バフ期限切れ時、EventLogger に記録しない（頻度高いため）

---

## C6-22: CleanupSystem（拡張）

### 新規処理分岐

```ts
class CleanupSystem implements System {
  // ... 既存メソッド

  // Iter6 追加
  private disposeBarrelEntity(entity: Entity, world: World): void;
  // 樽本体 mesh dispose、cloned material dispose、
  // 武器 child は (player 所有権移譲済の場合) スキップ、
  // HTMLOverlayManager.release(label)

  private disposeGateEntity(entity: Entity, world: World): void;
  // procedural geometry / material dispose、HTMLOverlayManager.release(label)
}
```

---

## C6-23: HTMLOverlayManager（拡張）

### 新規 API

```ts
class HTMLOverlayManager {
  // ... Iter5 既存 API（HP/スコア/Wave/Allies）

  // Iter6: Facade としてサブクラスを公開（各 System は直接 DI 受けを推奨、こちらは getter 用途）
  readonly worldToScreenLabel: WorldToScreenLabel;
  readonly activeBuffIcon: ActiveBuffIcon;
  readonly weaponHudPanel: WeaponHudPanel;
  readonly toastQueue: ToastQueue;

  // Facade のスケジューリングのみ担当
  update(scene: Scene, camera: Camera, dt: number): void;  // 30Hz ドレインで各サブクラスを順次呼出

  // newGame / teardown で呼ばれるリセット API（F-NG-11）
  resetAllLabels(): void;       // worldToScreenLabel プール全スロット visibility:hidden + assigned クリア
  resetToastQueue(): void;      // toastQueue.queue / current を空に
  dispose(): void;              // 全サブクラスの dispose を順次呼出、HUD DOM は残置（GameService.teardown 時のみ）
}
```

---

## C6-25: EntityFactory（拡張）

### 新規メソッド

```ts
class EntityFactory {
  // ... Iter5 既存

  // Iter6 追加
  createBarrelItem(world: World, type: BarrelItemType, pos: Position, isBonus: boolean = false): EntityId;
  // Crate.glb clone（material clone で tint）+ 武器モデル child（guns/*.glb clone）
  // BarrelItemComponent 付与、HP = BARREL_HP[type].baseHp × (isBonus ? 1.5 : 1)
  // HTMLOverlayManager.registerLabeledEntity() 呼び出し

  createGate(world: World, type: GateType, pos: Position, isBonus: boolean = false): EntityId;
  // アーチ型 procedural geometry（板 + 柱）
  // GateComponent 付与、amount = GATE_EFFECTS[type].amount × (isBonus ? 1.5 : 1)
  // HTMLOverlayManager.registerLabeledEntity()

  // 削除
  // createItemDrop()  ← 完全削除
}
```

---

## ビジネスルール一覧（Construction で Functional Design を詰める際の起点）

### BR-I6-01: 樽 HP 減算
- 弾命中ごとに `hp -= bullet.damage`
- 0 以下で破壊イベント発火

### BR-I6-02: 武器切替
- 最新取得で上書き（スタックしない）
- 既発射弾丸は発射時パラメータで継続（破棄しない）

### BR-I6-03: ゲート通過発動
- プレイヤーのみ発動条件成立
- 1 ゲート = 1 回発動（consumed フラグ）
- 仲間単独通過はスルー、ゲートは消滅しない

### BR-I6-04: ALLY_ADD 上限
- `min(gate.amount, GAME_CONFIG.ally.maxCount - current)` だけ追加
- 差が 0 なら no-op、"ALLY MAX" toast

### BR-I6-05: HEAL クランプ
- 対象はプレイヤー entity の既存 `HealthComponent { hp, maxHp }`（防衛ライン HP と同一）
- `health.hp = min(health.hp + amount, health.maxHp)`
- 差が 0 なら "HP MAX" toast、ゲートは通常通り consumed

### BR-I6-06: バフ重複（ATTACK_UP / SPEED_UP）
- 既存あり: 残り時間 = `max(existing.remaining, durationSec)` で上書き
- 新規: ActiveBuffsComponent に追加

### BR-I6-07: 出現タイマー
- 武器樽: 初回 12s、次回 [12, 15] 均等乱択
- ゲート: 初回 8s、次回 [8, 10] 均等乱択
- 独立タイマー、ポーズ/GAME_OVER で停止

### BR-I6-08: Wave 境目確定スポーン
- 45s / 90s / 180s で 1 回だけ確定発火
- ボーナス種別は交互 or 乱択（Construction で確定）
- 同時存在上限を +1 例外許容

### BR-I6-09: 衝突レイヤ分離
- BULLET ↔ BARREL（HP 減算）
- BULLET ↔ ENEMY（既存、ダメージ）
- BULLET ↔ GATE（なし）
- BODY (player/ally) ↔ BARREL（なし、すり抜け）
- BODY (player のみ) ↔ GATE（GateTriggerSystem、すり抜け判定のみ）

### BR-I6-10: GAME_OVER 時停止
- ItemBarrelSpawner / GateSpawner / GateTriggerSystem / WeaponSwitchSystem すべて `enabled = false`
- BuffSystem は新規 applyOrExtend を no-op、既存バフは満了まで継続

### BR-I6-11: 数値ラベル更新
- 通常: HTMLOverlayManager が 30Hz スロットリングで DOM translate3d 更新
- 破壊瞬間: `hideLabel()` で即非表示、toast 即発火（30Hz 例外）

### BR-I6-12: DOM プール
- 樽 3 + ゲート 2 = 5 + Wave 境目例外 +1 = 合計 6 スロット固定
- acquire/release で使い回し、動的 `createElement` / `removeChild` なし

### BR-I6-13: Runtime 値検証
- `GATE_EFFECTS` / `BARREL_HP` の `amount` / `baseHp` が `Number.isFinite(x) && x > 0 && x <= MAX` を満たすこと
- 検証失敗時はその効果を no-op、EventLogger.error

### BR-I6-14: 決定論モード
- `DeterministicRng.init(seed)` が seed ≠ null なら LCG、seed = null なら `Math.random`
- 本番ビルドでは `__setRngSeed` / `__SPAWN_FORCE_NEXT` は生成されない（`import.meta.env.PROD` ガード）
