# Iter6 Code Generation Plan — アイテム刷新（Last War 風）

本計画は `requirements-v6.md` / `components-v6.md` / `services-v6.md` / `component-methods-v6.md` / `component-dependency-v6.md` に基づき、Construction の実装順序と検証ステップを定める。

## 実装方針（開発段階、旧維持不要）

- **旧削除を前倒し**: 開発段階なので並存期間を作らず、取りこぼしリスクを消す
- **Phase 2 を 2a/2b に分割**: 独立系の削除（2a）→ enum 切替（2b）で commit 粒度を揃える
- **コンパイル可能状態をフェーズ境で維持**: 各フェーズ終わりで `npx tsc --noEmit` / `npm run lint` / `npm test` を通す
- **テストは各フェーズで追加**: System ごとに単体テスト、フェーズ終わりで Playwright 目視確認

## フェーズ構成（7 フェーズ）

### Phase 0: 事前調査（≤0.5 日）
1. `Math.random()` 利用箇所を全 grep（`src/**/*.ts`）
2. localStorage キー利用の有無を grep（旧 `ItemType`/`WeaponType` が永続化されていないことを確認）
3. 旧 `ItemType` / `WeaponType` / `ItemDropManager` / `ITEM_COLORS` の参照箇所をマップ化（置換時の参照リスト）
4. `renderer.info.programs.length` の Iter5 ベースライン取得（AC-05 用）

### Phase 1: Debug 基盤とインフラ（独立、破壊的変更なし）
- `src/services/EventLogger.ts`（新規）
- `src/services/DeterministicRng.ts`（新規）
- `src/services/DebugConfigLoader.ts`（新規、プロトタイプ汚染・NaN対策込み）
- `src/services/ForceSpawnApi.ts`（新規、debug-only）
- `src/config/logConfig.ts`（新規）+ `vite.config.ts` の `define` 拡張（`__DEBUG_API__`, `VITE_DEBUG_LOG`）
- `main.ts` / `GameService.init()` で EventLogger を**最優先 new**、続けて DebugConfigLoader→DeterministicRng→ForceSpawnApi 初期化
- ✅ チェック: tsc/lint/test clean、production build で `window.__setRngSeed === undefined` を手動確認

### Phase 2a: 旧コード削除（独立系、tsc 影響なし）
旧 `ItemType` / `WeaponType` 本体は残したまま、**既存の `WeaponSystem` / `BulletComponent` から参照されていないコード**を先に削除する。これにより tsc は通ったまま、削除行を確定できる。

- **削除対象**:
  - `src/systems/AllyConversionSystem.ts`（Iter6 例外、NFR-01）
  - `src/systems/CollisionSystem.ts` の敵→仲間変換呼出箇所
  - `src/systems/ItemCollectionSystem.ts`（既に no-op）
  - `src/managers/ItemDropManager.ts`（dead code）
  - `src/components/ItemDropComponent.ts`
  - `src/config/itemConfig.ts` の `POWERUP_DROP_WEIGHTS` / `WEAPON_DROP_TYPES` / `ITEM_COLORS` / `itemTypeToBuff` / `itemTypeToWeapon`（ファイルも不要なら削除）
  - `src/config/gameConfig.ts` の `GAME_CONFIG.itemSpawn`
  - `src/managers/SpawnManager.ts` の `itemSpawnTimer` 処理（敵スポーン/`spawnAlly` は維持）
  - `GameService.createItemGeometry()`（旧 SphereGeometry 0.08）
  - `src/config/enemyConfig.ts` の `itemDropRate` / `weaponDropRate` / 仲間変換確率フィールド
  - `src/services/GameService.ts` から `AllyConversionSystem` の登録除外
  - 関連 Jest テスト（AllyConversionSystem / ItemDropManager / ItemCollectionSystem 系）削除
- **grep チェック**: `ItemDropManager` / `determineDrops` / `POWERUP_DROP_WEIGHTS` / `WEAPON_DROP_TYPES` / `ITEM_COLORS` / `itemTypeToBuff` / `itemTypeToWeapon` / `SphereGeometry\(0\.08` / `itemDropRate` / `weaponDropRate` / `GAME_CONFIG\.itemSpawn` / `ItemDropComponent` / `ItemCollectionSystem` / `AllyConversionSystem` が全て 0 件
- ✅ チェック: tsc/lint/test clean。起動〜プレイヤー射撃〜敵撃破のゴールデンパスが維持される（旧 `WeaponType` はまだ生きているので射撃は通常動作）

### Phase 2b: 新 Enum/Config 切替 + WeaponSystem/BulletComponent 置換
- `src/types/index.ts`: 旧 `ItemType` / 旧 `WeaponType` enum を削除、`WeaponGenre` / `BarrelItemType` / `GateType` を追加
- `src/config/barrelConfig.ts`（新規）
- `src/config/gateConfig.ts`（新規、runtime 検証ヘルパ含む）
- `src/config/weaponConfig.ts` を `WEAPON_PARAMS: Record<WeaponGenre, ...>` ベースに再設計
- `src/config/i18nStrings.ts`（新規）
- `src/systems/WeaponSystem.ts` / `src/components/BulletComponent.ts` を `WeaponGenre` 参照へ置換
- プレイヤー初期装備は `WeaponGenre.RIFLE` で遊べる状態を維持（`PlayerWeaponComponent` は Phase 3 で正式導入、2b では暫定の単純フィールドで可）
- **grep チェック**: 旧 `ItemType` / 旧 `WeaponType` の参照が全て 0 件
- ✅ チェック: tsc/lint/test clean。Playwright で「起動→プレイヤーが RIFLE で射撃→敵撃破→GAMEOVER」のゴールデンパスを目視確認（アイテム機能は一時不在、以降のフェーズで導入）

### Phase 3: 新 Components / EntityFactory の追加
- `src/components/BarrelItemComponent.ts`（新規、`weaponTransferred` フラグ込み）
- `src/components/GateComponent.ts`（新規、`consumed` / `widthHalf` / `labelDomId` 込み）
- `src/components/PlayerWeaponComponent.ts`（新規、`currentWeaponMesh` 込み）
- `src/components/ActiveBuffsComponent.ts`（既存 `BuffComponent` 拡張 or 新規、複数同時対応）
- `src/factories/EntityFactory.ts`（既存 or 新規）: `createBarrelItem` / `createGate` 追加、`AssetManager.cloneBarrelTemplate` / `cloneWeaponTemplate` を利用
- `src/managers/AssetManager.ts`: `cloneBarrelTemplate` / `cloneWeaponTemplate` 新設、`restoreTextures` の走査対象に樽/武器 clone 追加
- ✅ チェック: 新規テスト（Component 初期値・Factory 生成形状）

### Phase 4: 新 Systems 実装（既存パスは未接続）
1. `src/systems/ItemBarrelSpawner.ts`（新規、priority 3.1）
2. `src/systems/GateSpawner.ts`（新規、priority 3.2）
3. `src/systems/GateTriggerSystem.ts`（新規、priority 6.0、`playerInitialized` フラグ + `prevGateY` Map + `onGateDisposed`）
4. `src/systems/WeaponSwitchSystem.ts`（新規、priority 6.1、`transferWeaponMesh` 3値戻り値 + try/catch + rollback）
5. `src/state/WaveState.ts` 改修: `bonusFiredAt: Set<number>` 追加
- ✅ チェック: 各 System の単体テスト（モック World で update 動作確認）
  - WeaponSwitchSystem: `transferred` / `cloned` / `failed` 3経路
  - GateTriggerSystem: プレイヤー通過成功 / 仲間スルー / consumed 多重発火防止 / 初期フレームスキップ
  - Spawner: 上限到達スキップ、Wave 境目 45/90/180s 各 1 回のみ

### Phase 5: HTMLOverlayManager の Facade 化
- `src/ui/HTMLOverlayManager.ts` を Facade に降格
- サブクラス新設:
  - `src/ui/WorldToScreenLabel.ts`（プール 6、ロールオーバー規則込み、ResizeObserver）
  - `src/ui/ActiveBuffIcon.ts`
  - `src/ui/WeaponHudPanel.ts`（0.3s フラッシュ）
  - `src/ui/ToastQueue.ts`（FIFO、上限 3、同時 1、同種延長、MAX 代替 toast）
- 30Hz ドレイン型スロットリング実装（F-NG-1）
- 各 System は上記サブクラスを**直接 DI** で受ける（BuffSystem/WeaponSwitchSystem/GateTriggerSystem/EntityFactory/CleanupSystem）
- XSS 対策: `textContent` のみ使用、`innerHTML` は ESLint で禁止（`no-restricted-syntax` 拡張）
- ✅ チェック: Playwright で DOM プール占有・解放を確認、XSS 回帰テスト（`<script>` 文字列が実行されない）

### Phase 6: 既存 Systems の拡張 + Systems 登録
- `src/systems/CollisionSystem.ts` 拡張: 衝突レイヤ分離（BULLET↔BARREL / BODY↔BARREL なし / BODY↔GATE は GateTrigger 担当）、樽 HP 減算、HP 0 で `WeaponSwitchSystem.enqueueSwitch`
- `src/systems/BuffSystem.ts` 改修: `applyOrExtend(type, amount, duration)` / `getActiveBuffs()` / 重複時は「残り時間の長い方で上書き」 / GAME_OVER で no-op
- `src/systems/CleanupSystem.ts` 拡張: 樽/ゲート dispose 分岐、`weaponTransferred` フラグで武器 child 分岐、`GateTriggerSystem.onGateDisposed` 呼出、ラベル DOM プール返却
- `src/systems/HealthSystem.ts` 軽微調整: GAME_OVER 遷移を `GameService.onGameOver()` へ
- `src/services/GameService.ts` 改修: 新 Systems 登録（priority 順）、GAME_OVER フック、webglcontextlost/restored 拡張
- ✅ チェック: tsc/lint/test clean、Playwright で「樽を撃って武器切替→ゲート通過でバフ発動」の golden path 確認

### Phase 7: Build & Test + Polish
- `npm run build` で bundle gzip 増分を計測、PR 本文に内訳記載
- `size-limit`（or 同等）を `devDependencies` 追加、閾値: main 差分 +20KB、絶対値 gzip ≤ 215KB
- Playwright シナリオ:
  - AC-01: 120 秒プレイ中にシーンへ旧アイテム描画なし
  - AC-02: 決定論モード+強制スポーンで樽撃破→武器切替、本体すり抜け、弾誤検知ゼロ
  - AC-03: ゲート通過、仲間のみはスルー、同時通過 1 回のみ、MAX 代替 toast
  - AC-04: 45/90/180s Wave 境目ボーナス確定出現（強調装飾 + Wave 遷移トースト）
  - AC-05: 90 秒連続 fps 計測（avg≥58, 5%以下で 50 未満）、`renderer.info.programs.length` Iter5 ベースライン比較
  - AC-06: `WEBGL_lose_context` lost→restored でプレイ継続、console error なし
  - AC-07: 5 分プレイで `heapDiff5min < 10MB`
  - AC-08: GAME_OVER 後にゲート/樽の発動が止まる
- 持ち越し項目（あれば）を state.md に記録

## リスクと緩和

| リスク | 緩和策 |
|---|---|
| 旧 `WeaponType` 依存コードの取りこぼしで tsc fail | Phase 0 で全参照マップ化、Phase 7 で grep チェックリスト 0 件確認 |
| 武器所有権移譲失敗で武器モデル消失 | `transferWeaponMesh` の 3 値戻り値 + try/catch + rollback（genre/switchedAt 巻き戻し）+ cloned fallback |
| Wave 境目跨ぎで二重発火 | `bonusFiredAt: Set<number>` + `elapsedTime` ベース判定（`Date.now()` 禁止） |
| DOM プール枯渇 | プール 6 固定、bonus が normal を押し退けるロールオーバー規則 |
| `__setRngSeed` の PROD 漏出 | `__DEBUG_API__` define + Vite DCE、Playwright で production build assert |
| cloned material のリーク | CleanupSystem で `weaponTransferred` フラグ分岐、Jest で cloned material 数チェック |
| shader 再コンパイル | `onBeforeCompile` 新規追加禁止、`material.color` のみ変更、`renderer.info.programs.length` AC で検証 |
| bundle +20KB 超過 | `size-limit` CI で fail、Phase 7 削除分で -5KB 確保見込み |

## 推奨作業順序（ショートパス）

Phase 0 → 1 → 2a → 2b → 3 → 4 → 5 → 6 → 7

各フェーズ終わりで `tsc / lint / test` を通す。Playwright 目視は以下のポイントで実施:
- Phase 2b 完了時: 「プレイヤーが RIFLE で射撃→敵撃破→GAMEOVER」のゴールデンパス（アイテム不在で通常プレイが壊れていないこと）
- Phase 4 完了時: 樽撃破→武器切替、ゲート通過→バフ発動のゴールデンパス
- Phase 7: 全 AC（AC-01〜08）の本番確認

## 次アクション

本計画をユーザー承認後、Phase 0（事前調査）から着手する。
