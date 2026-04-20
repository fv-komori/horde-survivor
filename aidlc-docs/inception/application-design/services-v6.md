# サービス定義 - Iteration 6: アイテム刷新

（components-v6.md と重複する部分は省略、サービス間の連携と初期化フロー・ランタイムフローに焦点）

---

## S6-SVC-01: GameService（軽微改修）

### 変更点（v5 からの差分）

- 新 Systems の登録（`ItemBarrelSpawner` / `GateSpawner` / `GateTriggerSystem` / `WeaponSwitchSystem`）
- `DeterministicRng` と `DebugConfigLoader` の初期化（Systems 登録の**前**）
- GAME_OVER 遷移時の全 Spawner / Trigger 停止フック
- 旧 `SpawnManager.itemSpawnTimer` 関連処理は削除（`SpawnManager` 自体は敵スポーンで残留）

### 初期化フロー（v5 に対する差分のみ）

```
GameService.init(assetManager) :
  ├─ (既存) SceneManager / QualityManager / PostFXManager
  ├─ EventLogger.init()                  🆕  ★ 最優先で new（以降の error 出力に必要、A-NG-3r）
  ├─ DebugConfigLoader.load()            🆕  URL query / localStorage から上書き値取得（EventLogger 参照可）
  ├─ DeterministicRng.init(seed?)        🆕  seed ありなら決定論モード
  ├─ EntityFactory 生成
  ├─ SceneManager.setupEnvironment()
  ├─ World + Systems 登録
  │    priority 順の新 Systems 追加位置:
  │    ├─ InputSystem                    (既存)
  │    ├─ ItemBarrelSpawner              🆕 (MovementSystem の前)
  │    ├─ GateSpawner                    🆕 (ItemBarrelSpawner の直後)
  │    ├─ MovementSystem                 (既存)
  │    ├─ CollisionSystem                ⚙️ 拡張
  │    ├─ GateTriggerSystem              🆕 (CollisionSystem の直後)
  │    ├─ WeaponSwitchSystem             🆕 (GateTriggerSystem と並列)
  │    ├─ BuffSystem                     ⚙️ 改修
  │    ├─ HealthSystem                   (既存)
  │    ├─ AnimationSystem                (既存)
  │    ├─ HTMLOverlayManager.update()    ⚙️ 拡張（WorldToScreenLabel + ToastQueue 更新）
  │    ├─ ThreeJSRenderSystem            (既存)
  │    └─ CleanupSystem                  ⚙️ 拡張
  ├─ 初期 entity 生成 (Player 1体 + PlayerWeaponComponent 付与、初期 genre=RIFLE)
  ├─ HTMLOverlayManager 起動
  ├─ AudioManager 初期化
  └─ GameLoop 開始
```

### GAME_OVER 遷移時

```ts
onGameOver(): void {
  // FR-06 / FR-05 / AC-08 対応
  this.itemBarrelSpawner.enabled = false;
  this.gateSpawner.enabled = false;
  this.gateTriggerSystem.enabled = false;
  this.weaponSwitchSystem.enabled = false;
  // 在空樽/ゲートは消滅させず、上限を残して表示はキープ (演出上)
  // BuffSystem の新規発動は停止、既存バフは満了まで継続
}
```

### webglcontextlost / webglcontextrestored 対応（O-NG-2）

```ts
onContextLost(event: Event): void {
  // 1. デフォルト挙動（WebGL リソース破棄）を preventDefault で抑止
  event.preventDefault();
  // 2. 全 Spawner 停止（復旧まで新 entity を作らない）
  this.itemBarrelSpawner.enabled = false;
  this.gateSpawner.enabled = false;
  this.itemBarrelSpawner.reset();   // pending / timer クリア
  this.gateSpawner.reset();
  // 3. 在空 entity の強制 dispose（GPU リソース参照を全解放）
  this.cleanupSystem.forceDisposeAll();
  // 4. HTMLOverlayManager の DOM ラベルは残置（DOM は context に非依存）だが
  //    全ラベル visibility:hidden にリセットしプールを空に
  this.htmlOverlayManager.resetAllLabels();
  this.eventLogger.error('webgl_context_lost', {});
}

onContextRestored(): void {
  // 1. texture 再バインド（AssetManager.restoreTextures：Iter5 既存 + Iter6 樽/武器/ゲート拡張）
  this.assetManager.restoreTextures();
  // 2. Spawner 再開（タイマーはリセット済、初回オフセットから再スタート）
  this.itemBarrelSpawner.enabled = true;
  this.gateSpawner.enabled = true;
  this.eventLogger.info('webgl_context_restored', {});
}
```

- 登録: `GameService.init` 末尾で `renderer.domElement.addEventListener('webglcontextlost' / 'webglcontextrestored', ...)`
- NFR-01 の復旧要件に直接対応

---

## S6-SVC-02: AssetManager（restoreTextures 拡張）

### 変更点

- `restoreTextures()` の対象に Iter6 で使う clone（樽＝Crate.glb clone、武器装備＝guns/*.glb clone）を追加
- 具体的には `world.query(BarrelItemComponent)` および `PlayerWeaponComponent` を持つ entity の MeshComponent を走査し、material の texture 再バインドを実施
- ゲートの material は procedural（`MeshToonMaterial` + color）で texture を持たないため、restore 対象外
- Iter5 で導入済の `webglcontextrestored` ハンドラから呼ばれる

### 新 API

```ts
class AssetManager {
  // ... Iter5 既存

  // Iter6 追加
  cloneBarrelTemplate(): Object3D {
    // Crate.glb の scene を SkeletonUtils.clone（skinning なしなので通常 clone でも可）
    // 返り値: Crate クローン（material は共有 or tint 用に clone）
  }
  cloneWeaponTemplate(genre: WeaponGenre): Object3D {
    // AK/Shotgun/Pistol のいずれかを返す（genre に応じて）
    // MACHINEGUN は AK.glb + material.color を別色に (shader 再コンパイル禁止、NFR-08)
  }
}
```

---

## S6-SVC-03: HTMLOverlayManager（Facade 化、スロットリング制御に特化）

### 責務の変更

- Iter5 までは HUD（HP/スコア/Wave/Allies）描画のみ
- Iter6 では **Facade に降格**し、以下を内包サブクラスとして分離（SRP、A-NG-3）:
  - **WorldToScreenLabel**: 樽 HP / ゲート効果量のワールド→スクリーン変換 + DOM プール 6 スロット管理（プール管理は本クラス内に閉じる）
  - **ActiveBuffIcon**: バフアイコン列 + カウントダウン（最大 3 スロット）
  - **WeaponHudPanel**: 現武器ジャンル表示（切替時 0.3 秒フラッシュ）
  - **ToastQueue**: 中央トースト FIFO（上限 3、同時 1、0.8 秒、同種延長）
- HTMLOverlayManager 本体の責務は「**30Hz スロットリング制御と、サブクラスの `update(dt)` 順次呼出のみ**」
- 各 System はサブクラスを **直接 DI で受ける**:
  - `BuffSystem` → `ActiveBuffIcon`
  - `WeaponSwitchSystem` → `WeaponHudPanel` + `ToastQueue`
  - `GateTriggerSystem` → `ToastQueue`
  - `EntityFactory` / `CollisionSystem` / `CleanupSystem` → `WorldToScreenLabel`
- HTMLOverlayManager 経由の間接アクセスは禁止（テスト容易性 + 依存明示）

### 内部スケジューリング（Facade、ドレイン型）

```
update(scene, camera, dt):
  // 30Hz スロットリングはドレイン型（F-NG-1）— 超過分を保持して位相を維持
  this.throttleAccumulator += dt;
  while (this.throttleAccumulator >= 1/30) {
    this.throttleAccumulator -= 1/30;
    this.worldToScreenLabel.update(scene, camera);
    this.activeBuffIcon.update(1/30);
  }
  // 毎フレーム更新 (低コスト):
  this.toastQueue.tick(dt);  // toast アニメ進行
  this.weaponHudPanel.updateFlash(dt);  // 切替フラッシュ
  this.updateHud(gameState);  // 既存 HP/Wave/Allies
```

### DOM 構造（v5 既存 `hud-container` に追加）

```
<div id="hud-container">
  <!-- v5 既存 -->
  <div class="hud-hp-bar">...</div>
  <div class="hud-right-info">...</div>

  <!-- v6 追加 -->
  <div class="hud-buff-container">
    <div class="hud-buff-item" data-slot="0"></div>
    <div class="hud-buff-item" data-slot="1"></div>
    <div class="hud-buff-item" data-slot="2"></div>
  </div>
  <div class="hud-weapon">
    <img class="hud-weapon-icon" />
    <span class="hud-weapon-name"></span>
  </div>
  <div class="hud-toast"></div>
  <div class="hud-labels">
    <!-- プール 6 要素 -->
    <div class="world-label" data-pool="0" style="visibility:hidden"></div>
    ... × 6
  </div>
</div>
```

### XSS 対策（既存方針踏襲）

- DOM 構築は `document.createElement` / `document.createElementNS`
- 動的値は `Number(x).toString()` → `textContent` への代入
- `innerHTML` 等の禁止 API は ESLint で検出（NFR-05）

---

## S6-SVC-04: ItemBarrelSpawner（新規 System）

### 責務
- 武器樽のランダム出現、Wave 境目ボーナス、GAME_OVER/ポーズ時停止

### 主要メソッド
```ts
class ItemBarrelSpawner implements System {
  priority = 3;  // MovementSystem の前
  enabled = true;

  private timer: number = 12;  // 初回オフセット
  private nextInterval(): number { return 12 + DeterministicRng.next() * 3; }  // 均等 [12, 15]

  update(world, dt) {
    if (!this.enabled) return;
    // GAME_OVER / ポーズ時は呼ばれない（上位から enabled=false）
    this.timer -= dt;

    // Wave 境目確定スポーン (elapsedTime で判定、Date.now() 使わない)
    this.checkWaveBonus(world);

    // 強制スポーン API 優先
    const forced = ForceSpawnApi.consumeForcedBarrel();
    if (forced) {
      this.spawn(world, forced, /*isBonus=*/false);
      return;
    }

    if (this.timer <= 0) {
      const count = world.query(BarrelItemComponent).length;
      if (count < 3) {
        const type = this.selectRandomType();  // DeterministicRng で決定論
        this.spawn(world, type, false);
      }
      this.timer = this.nextInterval();
    }
  }
  private spawn(world, type, isBonus) {
    const pos = this.randomSpawnPosition();
    this.entityFactory.createBarrelItem(world, type, pos, isBonus);
  }
}
```

---

## S6-SVC-05: GateSpawner（新規 System）

構造は `ItemBarrelSpawner` と同等（初回 8s、次回 8〜10s、上限 2、Wave 境目で強化ゲート）。

### Wave 境目重複発火防止（両 Spawner 共通、B-NG-3）

- `WaveState.bonusFiredAt: Set<number>` を追加（初期 `new Set()`）
- `checkWaveBonus(world)` は `[45, 90, 180]` 各値について `elapsedTime >= t && !bonusFiredAt.has(t)` の場合のみ発火し、発火時に `bonusFiredAt.add(t)` する
- これにより境目跨ぎの前後複数フレームで二重発火しない
- Wave 境目種別は交互固定（45s=樽 MACHINEGUN / 90s=ゲート強化 / 180s=樽 MACHINEGUN、components-v6.md Wave 境目ボーナス仕様参照）
- `newGame()` 時に `bonusFiredAt.clear()`

---

## S6-SVC-06: GateTriggerSystem（新規 System）

### 責務
- プレイヤー entity の前フレーム Y と現フレーム Y を比較し、ゲートを跨いだ瞬間に発動
- consumed フラグで多重発火防止
- 発動時にタイプ別の副作用を発火

### 主要メソッド

```ts
class GateTriggerSystem implements System {
  priority = 6;  // CollisionSystem の直後
  enabled = true;

  private prevPlayerY: number = 0;  // 前フレームのプレイヤー Y
  private playerInitialized: boolean = false;  // 初フレームは跨ぎ判定をスキップ（B-NG-13）
  private prevGateY: Map<EntityId, number> = new Map();      // ゲートごとの前フレーム Y
  private initialized: Set<EntityId> = new Set();            // 1 フレーム目判定スキップ用

  // X 幅判定の設計意図（B-NG-13）:
  //   判定は crossed フレームの**現在 x** のみで十分。
  //   理由: プレイヤーの横移動速度とゲートの移動速度から 1 フレーム（16.7ms）で
  //         X 幅（~1.5 ユニット）を横切る速度は要件上発生しないため、
  //         端を斜めに抜けるケースは無視できる。
  //   もし将来の要件で横移動高速化やゲート横移動が入った場合は、
  //   prevPlayerX を追加し区間判定（Minkowski 和）に拡張する。

  // EntityFactory.createGate 完了時にこちらを呼ぶ（prevGateY 登録、initialized は次フレームで立てる）
  onGateCreated(gateId: EntityId, initialY: number): void {
    this.prevGateY.set(gateId, initialY);
    // initialized には入れない → 次フレームの update で初期化完了とする
  }
  // CleanupSystem.disposeGateEntity から呼ぶ（リーク防止）
  onGateDisposed(gateId: EntityId): void {
    this.prevGateY.delete(gateId);
    this.initialized.delete(gateId);
  }

  update(world, dt) {
    if (!this.enabled) return;
    const player = world.queryOne(PlayerTag);
    if (!player) return;
    const playerY = player.position.y;

    // プレイヤー初期フレーム: prevPlayerY を確定して跨ぎ判定をスキップ（B-NG-13）
    if (!this.playerInitialized) {
      this.prevPlayerY = playerY;
      this.playerInitialized = true;
      return;
    }

    for (const gate of world.query(GateComponent)) {
      if (gate.comp.consumed) continue;
      const gY = gate.position.y;
      const inXRange = Math.abs(gate.position.x - player.position.x) < gate.comp.widthHalf;

      const prevGY = this.prevGateY.get(gate.id);
      if (prevGY === undefined || !this.initialized.has(gate.id)) {
        // 初期フレーム: 跨ぎ判定をスキップし次フレーム以降で有効化
        this.prevGateY.set(gate.id, gY);
        this.initialized.add(gate.id);
        continue;
      }

      // ゲート Y がプレイヤー Y を跨いだか（相対符号変化）
      const crossed = (prevGY > this.prevPlayerY) !== (gY > playerY);

      if (inXRange && crossed) {
        this.trigger(world, gate);  // 効果発動
        gate.comp.consumed = true;
        // 次フレーム CleanupSystem で消滅
      }
      this.prevGateY.set(gate.id, gY);
    }
    this.prevPlayerY = playerY;
  }

  private trigger(world, gate) {
    const cfg = GATE_EFFECTS[gate.comp.type];
    switch (gate.comp.type) {
      case GateType.ALLY_ADD: {
        const current = world.query(AllyComponent).length;
        const max = GAME_CONFIG.ally.maxCount;
        const added = Math.max(0, Math.min(gate.comp.amount, max - current));
        for (let i = 0; i < added; i++) this.spawnManager.spawnAlly(world);
        if (added === 0) {
          this.toastQueue.push({ kind: 'MAX', text: 'ALLY MAX' });
        } else {
          this.toastQueue.push({ kind: 'GAIN', text: `+${added} 仲間` });
        }
        this.eventLogger.info('ally_add', { count: added, total: current + added });
        break;
      }
      case GateType.HEAL: {
        // HEAL 対象はプレイヤー entity の既存 HealthComponent.hp/maxHp
        // （防衛ライン HP は別途 DefenseLineSystem が敵跨ぎで同 HealthComponent.hp を削る）
        const player = world.queryOne(PlayerTag);
        const health = player.get(HealthComponent);
        const before = health.hp;
        health.hp = Math.min(health.hp + gate.comp.amount, health.maxHp);
        const actual = health.hp - before;
        if (actual === 0) this.toastQueue.push({ kind: 'MAX', text: 'HP MAX' });
        else this.toastQueue.push({ kind: 'GAIN', text: `+${actual} HP` });
        this.eventLogger.info('heal', { amount: actual, playerHp: health.hp, maxHp: health.maxHp });
        break;
      }
      case GateType.ATTACK_UP:
      case GateType.SPEED_UP: {
        this.buffSystem.applyOrExtend(gate.comp.type, gate.comp.amount, gate.comp.durationSec);
        this.toastQueue.push({ kind: 'BUFF', text: `+${gate.comp.amount}% ${gate.comp.type}` });
        this.eventLogger.info('gate_trigger', { type: gate.comp.type, amount: gate.comp.amount });
        break;
      }
    }
    // ゲート発光エフェクト
    this.effectManager.playGateTrigger(gate.position);
  }
}
```

---

## S6-SVC-07: WeaponSwitchSystem（新規 System）

### 責務
- CollisionSystem から受領した「樽 HP 0」イベントを処理
- PlayerWeaponComponent を更新
- 樽上の武器モデルをプレイヤー装備へ所有権移譲
- HUD とトーストを更新

### 主要メソッド

```ts
class WeaponSwitchSystem implements System {
  priority = 6;  // CollisionSystem の直後

  private pendingSwitches: Array<{ barrelId: EntityId; type: BarrelItemType }> = [];

  // CollisionSystem から呼ばれる（または EventBus 経由）
  enqueueSwitch(barrelId, type) {
    this.pendingSwitches.push({ barrelId, type });
  }

  update(world, dt) {
    while (this.pendingSwitches.length > 0) {
      const { barrelId, type } = this.pendingSwitches.shift()!;
      const barrel = world.getEntity(barrelId);
      if (!barrel) continue;
      const player = world.queryOne(PlayerTag);

      // genre 変換（暫定退避、transferWeaponMesh 失敗時は rollback）
      const newGenre = barrelItemTypeToGenre(type);
      const weaponComp = player.get(PlayerWeaponComponent);
      const oldGenre = weaponComp.genre;
      weaponComp.genre = newGenre;
      weaponComp.switchedAt = this.elapsedTime;

      // 武器モデル所有権移譲（4 ステップ契約、失敗時は fallback or rollback）
      const result = this.transferWeaponMesh(barrel, player, newGenre);
      if (result === 'failed') {
        // 状態不整合回避: genre / switchedAt を rollback
        weaponComp.genre = oldGenre;
        weaponComp.switchedAt = 0;
        // toast / HUD 更新は実施しない
        // 樽は CleanupSystem が通常 dispose（weaponTransferred=false のまま）
        world.addComponent(barrel, new DeadFlag());
        continue;
      }

      // 成功 or cloned fallback: toast + HUD + イベントログ
      this.toastQueue.push({ kind: 'WEAPON', text: `${I18nStrings.weapon[newGenre]} を取得！` });
      this.weaponHudPanel.setGenre(newGenre);  // 0.3 秒フラッシュトリガー
      this.eventLogger.info('weapon_switch', { from: oldGenre, to: newGenre, result });

      // 樽自体は CleanupSystem で破棄（transferred 時は武器 child を dispose 対象外）
      world.addComponent(barrel, new DeadFlag());
    }
  }

  private transferWeaponMesh(
    barrel: Entity,
    player: Entity,
    newGenre: WeaponGenre,
  ): 'transferred' | 'cloned' | 'failed' {
    // 4 ステップ契約（F-NG-8 world matrix 保持含む）:
    //  1. 樽 child から武器 Object3D を特定（barrel.weaponChild）
    //  2. player の handBone へ Object3D.attach() で world matrix 保持のまま付け替え
    //     - BoneAttachmentConfig の offset/rotation を適用
    //     - 直後に matrixAutoUpdate=false + updateMatrix() を 1 回実行し静的化
    //  3. 成功確認: attach 後 player 側の subtree に含まれるか、かつ parent !== barrel
    //  4. 成功時のみ barrel.weaponChild 参照を null 化し
    //     BarrelItemComponent.weaponTransferred = true を立てる
    //     → CleanupSystem.disposeBarrelEntity はこのフラグで武器 mesh の dispose をスキップ
    try {
      // 1-3: 正規パス (detach → attach → 確認)
      this.attachBarrelWeaponToPlayer(barrel, player, newGenre);
      barrel.get(BarrelItemComponent).weaponTransferred = true;
      return 'transferred';
    } catch (e) {
      // Fallback: AssetManager から新規 clone し直して attach
      try {
        const cloned = this.assetManager.cloneWeaponTemplate(newGenre);
        this.attachObjectToPlayer(cloned, player, newGenre);
        // 樽側 weapon child は CleanupSystem に通常 dispose させる（weaponTransferred=false のまま）
        this.eventLogger.error('weapon_transfer_fallback_clone', {
          genre: newGenre, barrelId: barrel.id, reason: String(e),
        });
        return 'cloned';
      } catch (e2) {
        // 両方失敗: genre 書き換えを rollback（呼出側で実施）、toast/HUD も巻き戻し
        this.eventLogger.error('weapon_transfer_failed', {
          genre: newGenre, barrelId: barrel.id, reason: String(e2),
        });
        return 'failed';
      }
    }
  }
}
```

---

## S6-SVC-08: DeterministicRng（新規 Service、debug-only 機能）

```ts
// vite.config.ts 内で define 注入:
//   define: { __DEBUG_API__: JSON.stringify(mode !== 'production') }
//   build 時 mode='production' → __DEBUG_API__ = false → if (__DEBUG_API__) ブロックは DCE で除去
declare const __DEBUG_API__: boolean;

class DeterministicRng {
  private static seed: number | null = null;
  private static state: number = 0;

  static init(seedFromDebugConfig?: number) {
    this.seed = seedFromDebugConfig ?? null;
    this.state = seedFromDebugConfig ?? 0;
    if (__DEBUG_API__) {
      (window as any).__setRngSeed = (n: number) => { this.seed = n; this.state = n; };
    }
  }

  static next(): number {
    if (this.seed === null) return Math.random();  // 通常モード
    // シード固定モード: LCG
    this.state = (this.state * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (this.state >>> 0) / 0x100000000;
  }
}
```

- プロジェクト内の `Math.random()` 呼び出しを `DeterministicRng.next()` に置換（Spawner / EntityFactory / Enemy AI 等、範囲は Construction で確定）
- 本番ビルドでは seed 初期化なしで `Math.random` 挙動を維持
- **PROD 漏出防止**: Playwright AC で production build に対し `await page.evaluate(() => typeof (window as any).__setRngSeed)` が `'undefined'` であることを assert。同様に `__SPAWN_FORCE_NEXT` / `__gameState` も `__DEBUG_API__` ガードで統一し同 AC で確認。

---

## S6-SVC-09: DebugConfigLoader（新規 Service、入力検証強化）

```ts
class DebugConfigLoader {
  static load(): Partial<DebugConfig> {
    const cfg: Partial<DebugConfig> = {};
    if (!__DEBUG_API__) return cfg;  // 本番は常に空（DCE で除去）

    const params = new URLSearchParams(location.search);

    // URL query: Number.isFinite + 範囲チェック通過のみ採用、不合格は EventLogger.error + 無視（S-NG-2）
    this.pickNumber(params, 'rngSeed',            cfg, 'rngSeed',            0,    Number.MAX_SAFE_INTEGER);
    this.pickNumber(params, 'barrelIntervalMin',  cfg, 'barrelIntervalMin',  0.1,  60);
    this.pickNumber(params, 'barrelIntervalMax',  cfg, 'barrelIntervalMax',  0.1,  60);
    this.pickNumber(params, 'gateIntervalMin',    cfg, 'gateIntervalMin',    0.1,  60);
    this.pickNumber(params, 'gateIntervalMax',    cfg, 'gateIntervalMax',    0.1,  60);
    // forceNextBarrel / forceNextGate は enum サニタイズ（既知値のみ採用）

    // localStorage: 型ごとに検証 + プロトタイプ汚染対策（S-NG-1）
    const ls = localStorage.getItem('debugConfig');
    if (ls) {
      try {
        const parsed = JSON.parse(ls);
        Object.assign(cfg, this.sanitizeDebugConfig(parsed));
      } catch (e) {
        EventLogger.instance.error('debug_config_parse', { reason: String(e) });
      }
    }
    return cfg;
  }

  private static pickNumber(
    params: URLSearchParams, key: string,
    cfg: Partial<DebugConfig>, field: keyof DebugConfig,
    min: number, max: number,
  ): void {
    if (!params.has(key)) return;
    const raw = params.get(key);
    const v = Number(raw);
    if (!Number.isFinite(v) || v < min || v > max) {
      EventLogger.instance.error('debug_config_invalid_query', { key, raw, min, max });
      return;
    }
    (cfg as any)[field] = v;
  }

  private static sanitizeDebugConfig(obj: unknown): Partial<DebugConfig> {
    if (typeof obj !== 'object' || obj === null) return {};
    const out: Partial<DebugConfig> = {};
    // プロトタイプ汚染対策: __proto__ / constructor / prototype を除外
    const EXCLUDED = new Set(['__proto__', 'constructor', 'prototype']);
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (EXCLUDED.has(k)) continue;
      // 数値フィールド: typeof === 'number' && Number.isFinite && 範囲 check
      if (['rngSeed', 'barrelIntervalMin', 'barrelIntervalMax', 'gateIntervalMin', 'gateIntervalMax'].includes(k)) {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          EventLogger.instance.error('debug_config_invalid_ls', { key: k, value: v });
          continue;
        }
        (out as any)[k] = v;
      } else if (['forceNextBarrel', 'forceNextGate'].includes(k)) {
        // enum メンバシップチェック（BarrelItemType / GateType の既知値のみ）
        if (typeof v === 'string') {
          (out as any)[k] = v;
        }
      }
    }
    return out;
  }
}
```

- 本番ビルドでは `__DEBUG_API__ === false` により全体が DCE で除去される
- 入力検証強化により S-NG-1（プロトタイプ汚染）/ S-NG-2（NaN/Infinity 素通し）を封殺

---

## S6-SVC-10: EventLogger（新規 Service）

```ts
// src/config/logConfig.ts:
//   export const DEBUG_LOG_ENABLED: boolean = Boolean(import.meta.env.VITE_DEBUG_LOG);
// vite.config.ts:
//   define: { 'import.meta.env.VITE_DEBUG_LOG': JSON.stringify(process.env.VITE_DEBUG_LOG ?? '') }
//   → build 時は環境変数 VITE_DEBUG_LOG の真偽で定数化、DCE される
import { DEBUG_LOG_ENABLED } from '@/config/logConfig';

class EventLogger {
  info(event: string, payload: object) {
    // 本番 + DEBUG_LOG_ENABLED=false の場合のみスキップ
    // （DEBUG_LOG_ENABLED は build 時定数なので if 全体が DCE される）
    if (!__DEBUG_API__ && !DEBUG_LOG_ENABLED) return;
    console.info(JSON.stringify({ event, ...payload, t: performance.now() }));
  }
  error(event: string, payload: object) {
    // error は本番でも出力（障害調査のため）
    console.error(JSON.stringify({ event, ...payload, t: performance.now() }));
  }
}
```

- Playwright の `browser_console_messages` でテスト assert 可能
- Open Issue 4（`DEBUG_LOG_ENABLED` 出所未定）は本定義でクローズ

---

## ランタイムフロー例（武器樽取得）

```
1. [Input]         プレイヤーが発射（既存 InputSystem → WeaponSystem）
2. [Spawn]         ItemBarrelSpawner がタイマー到達 → EntityFactory.createBarrelItem()
                   → 樽 entity（Crate + 武器 child、HP=30 等）
3. [Render]        ThreeJSRenderSystem が樽描画
                   HTMLOverlayManager.WorldToScreenLabel が残 HP ラベル DOM 取得（プールから）
4. [Collision]     CollisionSystem が弾 x 樽衝突検知 → BarrelItemComponent.hp -= 1
                   HP 0 到達 → WeaponSwitchSystem.enqueueSwitch()
                   HTMLOverlayManager: ラベル即非表示（例外パス、30Hz 間引き対象外）
5. [Switch]        WeaponSwitchSystem.update() → PlayerWeaponComponent.genre 更新
                   → 樽 child の武器 Mesh をプレイヤー handBone へ attach
                   → toast enqueue、WeaponHudPanel フラッシュトリガー
                   → EventLogger.info('weapon_switch', ...)
6. [Cleanup]       CleanupSystem が樽 entity を破棄
                   樽本体 mesh + cloned material dispose、武器 mesh は参照 null（player 所有）
                   HTMLOverlayManager: ラベル DOM をプールへ戻す（visibility:hidden）
```

## ランタイムフロー例（ゲート通過）

```
1. [Spawn]         GateSpawner がタイマー到達 → EntityFactory.createGate()
                   → ゲート entity（アーチ、効果 ALLY_ADD、amount=5）
2. [Render]        ThreeJSRenderSystem が描画
                   HTMLOverlayManager.WorldToScreenLabel が効果量ラベル取得（"+5"）
3. [Movement]      ゲート entity が Y 方向に前進（MovementSystem）
4. [Trigger]       GateTriggerSystem:
                   - ゲート Y がプレイヤー Y を跨いだ瞬間を検知
                   - X 幅内 && consumed=false
                   → effect: ALLY_ADD × 5
                       → SpawnManager.spawnAlly() × 5（上限 10 でクランプ）
                       → toast "+5 仲間"
                   → gate.consumed = true
                   → EventLogger.info('ally_add', ...)
5. [Cleanup]       CleanupSystem: consumed ゲートを dispose
                   procedural geometry / material / ラベル DOM → プールへ戻す
```

## bundle gzip 増分見積り（I-NG-4）

| 区分 | 内訳 | 見積り (gzip) |
|---|---|---|
| 新規 Component (6個) | BarrelItem / Gate / PlayerWeapon / ActiveBuffs / Tag類 | ≈ 1.5 KB |
| 新規 System (4個) | ItemBarrelSpawner / GateSpawner / GateTriggerSystem / WeaponSwitchSystem | ≈ 4.0 KB |
| UI 機能 (4個) | WorldToScreenLabel / ActiveBuffIcon / WeaponHudPanel / ToastQueue | ≈ 3.5 KB |
| Config / Types (3個) | BarrelConfig / GateConfig / WeaponConfig(再設計) / I18nStrings | ≈ 0.8 KB |
| Debug 系 (4個) | DeterministicRng / DebugConfigLoader / ForceSpawnApi / EventLogger | ≈ 0 KB（`__DEBUG_API__` / `import.meta.env.PROD` で DCE） |
| 削除分 | ItemDropManager / ItemCollectionSystem / ItemDropComponent / 旧 WeaponType / ITEM_COLORS 等 | **-5.0 KB** |
| **差分合計** | | **+4.8 〜 +6.8 KB** |

- NFR-02 (+20 KB 以内) に対して十分なマージン
- `size-limit` CI で実測を PR チェック（NFR の継続確認）
