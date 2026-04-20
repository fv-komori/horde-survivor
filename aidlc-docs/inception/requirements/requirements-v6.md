# Requirements - Iteration 6: アイテム刷新（Last War 風アイテム/ゲート導入）

## 参考・前提

- 参考画像: `./reference-visual.png` / `./lastwar.jpeg`（Last War スタイル：道路上を流れてくる樽アイテム＋数値ラベル付きゲート）
- Iter5 完了時点（PR #1 マージ済）の成果物を土台とする（Toon Shooter Game Kit の GLTF キャラ・銃・環境アセット配置済、AssetManager / AnimationSystem 稼働中）
- Iter5 持ち越し（LoaderScreen / EntityFactory.gltf 経路テスト / ProceduralMeshFactory 残骸確認）は**本 Iter のスコープ外**とし、必要であれば別 Iter で処理する
- 本要件書は第 1 回レビュー（reviews/inception/requirements-review-v6.md）の対応を反映済

## Intent Analysis

- **User Request**: アイテムのビジュアル刷新＋種類整理。Last War 風の「樽を撃って取得する武器アイテム」と「通過でバフ発動するゲート」を導入する
- **Request Type**: Major Enhancement（ゲームプレイのコアループに関わる）
- **Scope Estimate**: Multiple Components（Spawn / Factory / Component / System / Config / Rendering / UI）
- **Complexity Estimate**: Moderate〜High（新規メカニクス「ゲート通過」導入、武器系の再設計、既存アイテム系の削除）

## 現状（コード確認済）

- `ItemType` enum（`src/types/index.ts`）: ATTACK_UP / FIRE_RATE_UP / SPEED_UP / BARRAGE / WEAPON_SPREAD / WEAPON_PIERCING（6種）
- 旧 `WeaponType` enum（`src/types/index.ts`）: FORWARD / SPREAD / PIERCING / BARRAGE（`WeaponSystem` / `BulletComponent` が依存）
- アイテム描画: `GameService.createItemGeometry()` の `SphereGeometry(0.08, 4, 2)`（簡易ジェム）＋ `ITEM_COLORS` 着色
- スポーン: `SpawnManager` の `itemSpawn`（画面上部からランダム位置降下、15秒間隔、hitCount=8）
- ヒット破壊で効果適用: `CollisionSystem` がバフ/武器変更を適用
- **`ItemCollectionSystem` は既に no-op**（アイテムは射撃破壊方式で稼働中）
- **`ItemDropManager.determineDrops()` は定義のみで未使用（dead code）** — 敵撃破ドロップは現状**発動していない**
- GLB 既存資産（Iter5 配置済）: `environment/{Crate, Barrier_Single, SackTrench, Fence, Tree_1, Fence_Long}.glb`, `guns/{AK, Pistol, Shotgun}.glb`
- 仲間上限: `GAME_CONFIG.ally.maxCount = 10`（既存、HUD に `Allies: N/10` で表示）

## 新モデル（合意済）

### 2 系統に分割

| 要素 | メカニクス | 効果内容 | 見た目 |
|---|---|---|---|
| **武器アイテム** | 樽を**撃破**して取得（HP 0 で発動） | プレイヤーの武器を変更（ジャンル再設計） | **Crate.glb の樽の上に武器モデル（guns/*.glb）**を乗せる |
| **ゲート** | **プレイヤーの通過で発動**（撃破不要、撃てない、仲間単独通過はスルー） | 発動時に仲間追加 or 全仲間にバフ（攻撃UP / 移動速UP / HEAL 等） | アーチ/板型（プロシージャル）＋**効果量を大きく数値表示** |

### 武器再設計（ジャンル型）

| 武器ジャンル | 想定挙動 | 使用 GLTF |
|---|---|---|
| **RIFLE** | 基本武器、単発中威力・連射標準 | `guns/AK.glb` |
| **SHOTGUN** | 近距離散弾（拡散、多弾数、射程短） | `guns/Shotgun.glb` |
| **MACHINEGUN** | 高連射・低威力・弱反動（弾幕維持） | `guns/AK.glb`（※流用、color tint で差別化、shader 再コンパイルなし） |

- 旧 `WeaponType` enum（FORWARD/SPREAD/PIERCING/BARRAGE）は**削除**、`WeaponGenre` に一本化
- `WeaponSystem` / `BulletComponent` / `weaponConfig.ts` の旧 `WeaponType` 参照箇所は全て置換
- **互換維持なし**（AC-05 で明記）
- 武器は**最後に取得したものが最新**として上書き適用（切替式、スタックしない）
- 武器切替時、既発射の弾丸は発射時パラメータ（ダメージ/貫通/拡散）で最後まで処理される（継続、発射後の破棄なし）

## 機能要件

### FR-01: 敵ドロップ機構の完全削除（既に dead code、明示削除）

- `src/managers/ItemDropManager.ts`、`src/config/itemConfig.ts` の `POWERUP_DROP_WEIGHTS` / `WEAPON_DROP_TYPES`（ドロップ専用定義）を削除
- `EnemyConfig` の `itemDropRate` / `weaponDropRate` フィールドを削除
- Grep で利用箇所を全て除去し、ビルド/テストがクリーンに通ること

### FR-02: 現行「画面上部から降ってくるアイテム」機構の置換

- `GAME_CONFIG.itemSpawn` 設定、`SpawnManager` の `itemSpawnTimer` 処理は削除または**武器樽スポーン用に書き換え**
- 従来の `SphereGeometry(0.08)` + `ITEM_COLORS` のジェム描画は廃止
- 従来の `ItemType` enum / `ITEM_COLORS` / `itemTypeToBuff` / `itemTypeToWeapon` は新定義に置換（下記 FR-03 / FR-04）
- 旧 `WeaponType` enum は削除し `WeaponGenre` に一本化（詳細は「武器再設計」節）
- **事前 grep 確認**: 旧 `ItemType` / `WeaponType` の enum 値が localStorage 等の永続ストレージに書き込まれていないことを確認する（本プロジェクトは開発段階のため、万一書き込みがあればローカル localStorage を削除する運用で足りる）

### FR-03: 武器アイテム（樽）スポーン機構

- **配置方向**: 画面上部（敵と同じ奥領域）から**プレイヤー方向へ流れてくる**（レーン上移動）
- **見た目**: 樽ベース（`Crate.glb`）＋ 上に武器モデル（`guns/AK.glb` 等）を child として乗せる
- **HP**: タイプ別の固定値（Iter6 では Wave 不変）
  - 暫定値: RIFLE=30 / SHOTGUN=40 / MACHINEGUN=50（実装時に Playwright で微調整）
  - 将来の Wave 連動余地を残すため、型は `Record<BarrelItemType, { baseHp: number; waveScale?: number }>` 形式で拡張可能にする（Iter6 では `waveScale=1` 固定）
- **衝突判定**:
  - **弾 vs 樽のみ判定対象**（HP 減算）
  - **プレイヤー/仲間本体 vs 樽はすり抜け**（衝突なし、武器切替は射撃による HP 0 のみ）
  - 衝突レイヤ分離を明示: `BULLET ↔ BARREL`, `BULLET ↔ ENEMY`, `BODY ↔ GATE (なし)`
- **破壊時挙動**: 既存 `CollisionSystem` を拡張して HP 判定、武器切替副作用は新規 `WeaponSwitchSystem` で扱う（System 責務分担を確定）
- **武器切替**: `PlayerWeaponComponent`（新規 or 既存 `WeaponComponent` 拡張）のジャンルを更新、前武器は破棄
- **数値ラベル表示**:
  - 樽モデルの bounding box **上辺より上方（武器モデルの上）** にオーバーレイ配置（HTMLOverlayManager 経由、ワールド→スクリーン座標変換）
  - ダメージを受けるたびに数値が減り、色フラッシュで演出
  - HP が 0 以下になった当該フレームでラベル即非表示、同フレームで取得トースト発火（30Hz スロットリング対象外）
  - フォントサイズは既存 HUD テキスト系列（`hud-hp-text` / `hud-wave` 等）と同系列、最小 20px

### FR-04: ゲート（バフ発動、通過型）

- **配置方向**: 武器アイテムと同様、画面上部からプレイヤー方向へ流れてくる
- **メカニクス**: **プレイヤーが通過で発動**（仲間単独通過は何も起こらずスルー、ゲートも消滅しない）
  - **発動条件**: ゲートの X 幅内かつ、ゲートのワールド Y 座標がプレイヤーの Y 座標を**ゲート側から**跨いだ瞬間（フレーム間で符号変化）
  - **発動は 1 ゲートにつき 1 回のみ**（`consumed=true` フラグで以降の通過を無視、次フレームの CleanupSystem で消滅）
  - ゲート自体に HP はない（撃っても壊れない・弾が当たらない判定）
  - 衝突レイヤ: `BULLET ↔ GATE = なし`, `BODY ↔ GATE = 発動判定のみ`
- **効果適用範囲**: 発動時、効果は全仲間/対象に連動適用（ATTACK_UP = 全仲間に付与、ALLY_ADD = 仲間追加、HEAL = 防衛ライン回復 等）
- **効果種別**:
  - `ALLY_ADD`: 仲間追加（+N 人、Hazmat 仲間生成ロジックを再利用）
  - `ATTACK_UP`: 一定秒間、全仲間のダメージ増加（現 `BuffType.ATTACK_UP` 移行）
  - `SPEED_UP`: 一定秒間、移動速度 UP（現 `BuffType.SPEED_UP` 移行）
  - `HEAL`: 防衛ライン HP を回復（対象はプレイヤー entity の既存 `HealthComponent.hp/maxHp` — 本プロジェクトでは防衛ライン HP とプレイヤー HP を同一視、`DefenseLineSystem` が敵跨ぎで同 `hp` を削る。`min(hp + amount, maxHp)` でクランプ）
- **除外**: 連射UP（`FIRE_RATE_UP`）は Iter6 では削除／保留（種類を絞ってシンプルに）
- **数値ラベル表示**: **効果量そのもの**（`+5 (人)` / `+30%` / `+40 (HP)` 等）をゲートにオーバーレイ表示（HTMLOverlayManager 経由、既存 HUD サイズ系列、最小 20px）
- **見た目**: アーチ型（板＋柱）プロシージャル、バフ種別で色分け（例: ALLY_ADD=青 / ATTACK_UP=赤 / SPEED_UP=黄 / HEAL=緑）

### FR-05: 出現頻度・タイミング

**採用方針**: 推奨C（Wave境目で確定ボーナス + 通常ランダム）

- **通常ランダム**:
  - 武器アイテム: 12〜15 秒間隔で 1 個（**均等乱択**、タイプはランダム重み付き、独立タイマー、初回オフセット = 12s）
  - ゲート: 8〜10 秒間隔で 1 個（**均等乱択**、タイプはランダム重み付き、独立タイマー、初回オフセット = 8s）
  - 武器とゲートは別タイマーで独立発火
- **Wave 境目ボーナス**（`WAVE_DEFINITIONS.endTime` = **45 秒 / 90 秒 / 180 秒** の 3 点に到達した次フレームで 1 回だけ発火。`WAVE_SCALING` 30 秒境目は Iter6 スコープ外）:
  - ゲートが**強化値**（効果量 +50%、見た目もサイズアップ）で 1 個確定出現
  - 武器アイテムは**上位武器**（MACHINEGUN など）が確定出現
  - **強調装飾**: ボーナス樽/ゲートにリング発光・上部に "BONUS" ラベルを付与、画面上部に Wave 遷移トーストを出す
  - **優先度**: Wave 境目確定スポーンは通常キューをスキップして**最優先**で枠を取る。同時存在上限に達している場合は例外的に上限 +1 まで許容
  - ※ 将来のバランス調整次第で、タイミングや強化幅を Wave ごとに変更する可能性あり（別 Iter で見直し）
- **同時存在数**: 武器樽 **3** / ゲート **2**（上記 Wave 境目ボーナスのみ +1 許容）
- **ポーズ/設定画面・GAME_OVER 時**: スポーンタイマー停止、ゲート通過・樽撃破による発動もすべて停止（`GAME_OVER` フラグ後の通過/撃破は発動しないこと）
- **決定論モード**: テスト用に PRNG シード固定 API と強制スポーン API（`__SPAWN_FORCE_NEXT`）を提供（NFR-11 参照）
- **Wave 境目判定**: クライアント時計ではなくゲーム内 `elapsedTime`（`deltaTime` 累積）で行う。`Date.now()` / `performance.now()` 差分は使わない

### FR-06: バフ重複・武器切替・上限到達の扱い

- **バフ（ATTACK_UP / SPEED_UP 等）**: 同種を連続取得した場合、**残り時間を延長**（加算ではなく、残り時間の長い方で上書き）
- **武器**: 常に**最後に取得したジャンルへ切替**（スタック/重複なし、切替時に旧武器は破棄）
  - 既発射の弾丸は `BulletComponent` に保持された発射時パラメータで最後まで処理される（継続）。新武器の弾は次フレーム以降の発射から適用
- **ALLY_ADD**:
  - 仲間上限 = `GAME_CONFIG.ally.maxCount = 10`（既存維持）
  - 上限到達時は仲間を増やさない（**no-op**、ゲート自体は通過 toast を出して消滅する、視覚上の不整合回避）
- **HEAL**:
  - 対象: プレイヤー entity の既存 `HealthComponent.hp`（本プロジェクトでは「防衛ライン HP」とプレイヤー HP を同一視する設計、`DefenseLineSystem` が敵跨ぎ時にこの `hp` を削る）
  - 上限: `HealthComponent.maxHp`
  - 計算: `min(hp + amount, maxHp)` でクランプ（オーバーフローしない）
  - 現在 HP が最大なら通過 toast に「MAX」を併記して消滅
- **GAME_OVER 状態**: アイテム/ゲートのスポーンおよび発動を停止する（通過しても効果発動しない）

### FR-07: UI / HUD

- **数値ラベル・トースト描画方式**: **HTMLOverlayManager による DOM オーバーレイ方式**に一本化（ワールド→スクリーン座標変換）
  - Three.js Sprite + CanvasTexture 方式は採用しない
  - HTMLOverlayManager が**内部で約 33ms（30Hz）スロットリング**を行い、`update(scene, camera)` が毎フレーム呼ばれても DOM 書き換えは 30Hz に間引く
  - 樽 HP 0 直前などの破壊タイミングでは 30Hz 間引きの例外としてフレーム内で即時非表示に切替
- **数値ラベル用 DOM のライフサイクル**:
  - entity 生成時に DOM 作成、entity 破棄時に CleanupSystem が removeChild
  - **固定プール**で使い回し（最大 = 樽上限 3 + ゲート上限 2 = 5 + Wave 境目例外 +1 = 計 6 スロット）
  - カメラ背後や画面外は `visibility:hidden` でレンダリング除外
- **フォント/サイズ**: 既存 HUD テキスト（`hud-hp-text` / `hud-wave` / `hud-weapon` 等）と同系列のサイズ、**最小 20px**、画面高 1280x720 基準で 2.8% 以上相当
- **現武器ジャンル HUD**:
  - 画面**左下**に固定表示（`hud-weapon` 既存要素を拡張）
  - アイコン（色はゲートの色分けに準拠）＋武器ジャンル名
  - 武器切替時は 0.3 秒のフラッシュ/スケールで強調
  - HUD（FR-07）=「現在状態の常時表示」／トースト（FR-08）=「切替瞬間の演出」と役割分離
- **アクティブバフ残り時間表示**:
  - 画面上部または HUD 横にバフアイコン列を配置
  - 各バフの残り秒数をカウントダウン表示（表示枠 2〜3 スロット、同時アクティブ最大 3）
- **画面レイアウトマップ**:
  ```
  ┌──────────────────────────────────────────┐
  │ HP [====] 80/100   [Wave 2] [Timer]      │ top-left: HP / top-right: Wave/Timer/Allies
  │ [BuffIcons]                               │ top-center: Active Buffs
  │                                          │
  │   [Gate +5 allies]    [Barrel HP 30]     │ 3D world: overlay labels
  │                                          │
  │ [Weapon: RIFLE]                          │ bottom-left: current weapon HUD
  │                              [Toast]     │ center: toast (0.8s)
  └──────────────────────────────────────────┘
  ```
  - z-index: `hud-container` < 3D world labels < active buffs < weapon HUD < toast < settings
- **レスポンシブ**: 最小ビューポート幅 = 640px、最小高さ = 360px。それ以下ではラベルサイズを保持しつつ HUD 要素を折り畳む（詳細は Application Design）
- **アイコン実装**: `<img src="/icons/*.png">` もしくは事前定義 `<svg>` を `document.createElementNS` で構築。**文字列結合による SVG/HTML 注入は禁止**
- **XSS 対策**: NFR-05 参照（`innerHTML` 等禁止 API リスト、`textContent` のみ使用）

### FR-08: 視覚効果・トースト

- 武器樽破壊時: 既存 `EffectManager3D` の破壊エフェクト流用＋取得 toast（画面中央「RIFLE を取得！」等、0.8 秒）
- ゲート通過時: ゲート発光＋通過エフェクト（パーティクル or 光輪）＋効果 toast
- **トースト同時発火ポリシー**:
  - 同時表示は 1 件まで
  - 発生が重なった場合は FIFO キューで 0.8 秒ずつ順次表示
  - **キュー上限 = 3**、超過分は古いものから破棄
  - 同種連続時は残り時間のみ延長（重複表示しない）
- **トースト文字列**: **定数テーブル（i18n 辞書）**から引き、動的生成値は数値のみ
  - 例: `${weaponLabel[WeaponGenre.RIFLE]} を取得！` + `Number(count).toString()`
  - 文字列は `textContent` に直接代入、テンプレートリテラルで HTML 断片を組み立てない
- **MAX 代替トースト**: ALLY_ADD 上限到達時 / HEAL HP 満タン時は通過エフェクトに加え「MAX」等の代替トーストを表示（サイレント失敗を避ける）
- **Wave 境目ボーナス強調**: FR-05 で定義の強調装飾（リング発光・BONUS ラベル・Wave 遷移トースト）を発火
- **全体として** Iter3〜5 のビジュアル方針（Toon シェーダ、派手すぎない発光）を維持
- **パーティクル/エフェクト上限**: EffectManager3D の pool 上限を参照。同時エフェクト最大 = N、超過時は古いものから破棄（具体値は Application Design で確定）

### FR-09: 運用ログ・パラメータ上書き（新規）

- **主要イベントログ**: 以下を `console.info` に JSON 形式 1 行ログで出力（Playwright `browser_console_messages` で assert 可能）
  - 武器切替（`{ event: 'weapon_switch', from, to, t }`）
  - ゲート発動（`{ event: 'gate_trigger', type, amount, t }`）
  - ALLY_ADD（`{ event: 'ally_add', count, total, t }`）
  - HEAL（`{ event: 'heal', amount, defenseHp, t }`）
  - バフ延長（`{ event: 'buff_extend', type, remaining, t }`）
  - 上限到達によるスポーン/発動スキップ（`{ event: 'skip', reason, t }`）
- **本番ビルド除去**: `console.log` / `console.debug` は Vite の production 設定で除去（既存方針を継承）、`console.info` の扱いは Application Design で決定（**デフォルトは除去、デバッグビルドでは残す**）、`console.error` は常に残す
- **パラメータ上書き**: 主要スポーンパラメータは URL query（例: `?barrelIntervalMin=12`）または `localStorage.debugConfig` で上書き可能（現地調整用、本番無効化オプションあり）

## 非機能要件

### NFR-01: 互換性・ブレークなし（一部例外）

- Iter5 までの全機能（プレイヤー/仲間/敵移動、戦闘、Wave、防衛ライン、スコア、GAMEOVER、GameStart mini-renderer、設定/ヘルプ画面）は引き続き動作する
- **Iter6 例外**: Iter5 の `AllyConversionSystem`（敵撃破時の確率変換で仲間を増やす機構）は**削除**し、仲間入手は `ALLY_ADD` ゲートの通過に一本化する（Last War 風のメカニクス統一のため。関連 CollisionSystem 呼出・enemyConfig 変換確率も削除）
- **既存 Jest テスト 100 tests の扱い**:
  - 旧 `ItemType` / `ItemDropManager` / `itemSpawn` / `ITEM_COLORS` 関連テストは削除 or 新 `BarrelItemType` / `GateType` テストへ置換
  - 置換後のテスト総数の目安は Application Design で確定
  - **修正/削除したテストは PR 本文と CHANGELOG に一覧化**し、回帰可視性を確保
- **WebGL context lost/restored**:
  - context lost 時、in-flight な樽/ゲート entity は破棄して再スポーン待ち
  - restored 時、`AssetManager.restoreTextures()` の処理範囲を樽/ゲート GLB clone にも拡張
  - Playwright で `WEBGL_lose_context` を利用した AC を追加（AC-06）

### NFR-02: バンドルサイズ（必達）

- Iter5 完了時 gzip 195KB / raw 748KB を基準とし、**Iter6 追加分は gzip +20KB 以内を必達**
- **内訳管理**: 追加分 gzip = (新規コード +X) - (dead code 削除 -Y) + (新 config +Z)。PR 本文に内訳を記載
- **CI 検証**: `size-limit` / `bundlesize` 等を `devDependencies` に追加し CI で fail させる
  - 閾値: main 差分 +20KB 以内、かつ絶対値 gzip ≦ **215KB**（両方チェック）
  - AC-05 に組み込む
- 新規 GLB アセット追加なし（既存 `guns/*.glb` / `Crate.glb` 流用のため）

### NFR-03: パフォーマンス

- **fps 基準**:
  - 計測条件: viewport 1280x720、**90 秒連続計測**、`requestAnimationFrame` ベース
  - 合格条件: **平均 ≥ 58fps かつ 5% 以下のフレームで 50fps を下回らない**
  - 計測シナリオ: 最大同時表示状態（樽 3 + ゲート 2 + 敵ピーク + 仲間 10）
  - Playwright で `browser_evaluate` により rAF 間隔を集計
- **シーン内オブジェクト目安**:
  - mesh 総数 ≦ 約 80（最悪ケース: 3 樽 + 2 ゲート + 30 敵 + 20 仲間 + 弾）
  - draw call ≦ 約 60（目安、Application Design で見積り精査）
- **ラベル更新 30Hz**: 毎フレーム DOM 更新しない（HTMLOverlayManager 側でスロットリング、FR-07 参照）
- **同時ラベル数** ≦ 6（固定プール、動的生成/破棄なし）

### NFR-04: コード品質

- tsc / ESLint clean
- **カバレッジ**: 新規追加モジュールのステートメントカバレッジ **≥ 80%**
- **必須テスト項目リスト**:
  - 武器切替（`WeaponSwitchSystem`）
  - ゲート通過判定（`GateTriggerSystem`、プレイヤーのみ発動・仲間スルー・consumed フラグ）
  - 樽 HP 減算（`CollisionSystem` 拡張）
  - Wave 境目ボーナス発火（45/90/180s）
  - 新規スポーン（`ItemBarrelSpawner` / `GateSpawner`）
  - cloned material のリークチェック（破棄時に dispose されている）
  - XSS 回帰テスト（`<script>` 含む入力が `textContent` としてそのまま表示される = 実行されない）
- **ESLint リンタ**: `innerHTML` / `insertAdjacentHTML` / `document.write` / `eval` / `new Function` の利用を検出してエラー化（既存 `no-restricted-syntax` 拡張）
- Playwright でゲーム起動〜武器アイテム取得〜ゲート通過〜バフ発動までを 1 シナリオ目視確認

### NFR-05: セキュリティ

- **禁止 API リスト**: `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` / `eval` / `new Function` は**すべて禁止**
- **数値ラベル構築ルール**: `Number(x).toString()` で数値化してから `textContent` に代入する（テンプレートリテラルで HTML 断片を組み立てない）
- **文字列ラベル**: i18n 辞書（定数テーブル）から引き、動的値は数値のみ
- **CSP 不緩和**: 本 Iter では `vite.config.ts` の CSP ヘッダを**一切緩和しない**
  - `unsafe-inline` / `unsafe-eval` を新規導入しない
  - インライン `<style>` / `onclick=` 属性を新規追加しない
- **console 出力**: `console.log` / `console.debug` は production ビルドで除去（既存方針継承）、`console.error` のみ常に残す
- ユーザー入力経路は増やさない（設定画面のみ、既存踏襲）

### NFR-06: 保守性

- 武器ジャンル追加は `weaponConfig.ts` へのエントリ追加だけで済む構造にする
- ゲート効果追加も同様に `gateConfig.ts`（新規）で集約
- 樽 HP は `barrelConfig.ts`（新規）で集約
- Hard-coded 数値は極力 config へ
- **パラメータ上書き**: URL query または `localStorage.debugConfig` で主要パラメータを上書き可能（詳細は FR-09）

### NFR-07: メモリ/dispose 責任

- Iter5 で定めた dispose 責任分界（AssetManager は保持/dispose 禁止、CleanupSystem が entity 所有物を dispose）を踏襲
- **dispose 責任表（新規 entity 分）**:

| リソース | 所有者 | dispose 責任 | 備考 |
|---|---|---|---|
| 樽 mesh（Crate.glb clone） | entity (MeshComponent) | CleanupSystem が破壊時 | geometry は共有、cloned material は dispose |
| 樽上の武器モデル（guns/*.glb clone） | entity (MeshComponent) | **武器切替成功時はプレイヤー装備へ所有権移譲**（樽側は参照 null 化のみ）／破壊のみで切替不成立時は CleanupSystem が dispose | material clone あり |
| ゲートのプロシージャル geometry | entity | CleanupSystem が消滅時 | |
| ゲートの material | entity | CleanupSystem が消滅時 | |
| HUD 数値ラベル DOM | HTMLOverlayManager プール | プールは使い回し、entity 消滅時に `visibility:hidden` へ戻す | |
| AssetManager 保持の元 GLTF template | AssetManager | **dispose 禁止**（アプリ終了まで保持） | |
| texture（AssetManager 所有） | AssetManager | **dispose 禁止** | clone 間で共有 |

- **原則**: geometry は共有のため非 dispose、cloned material のみ dispose、texture は AssetManager 所有のため非 dispose
- **MetricsProbe 基準**: 5 分プレイ時の heap 差分が **+10MB 未満**（Chrome 限定、Iter5 踏襲）
  - Playwright 長時間シナリオ（5 分プレイ）で `window.__metricsProbe` の値を assert（AC-07）

### NFR-08: リソース配置

- 追加 GLB は不要。既存 `public/models/toon-shooter/v1/` のアセットを流用
- 武器モデルの色違い（MACHINEGUN）は material clone＋tint（`material.color` のみ変更）で対応
- **shader 再コンパイル禁止**: `MeshToonMaterial` の `onBeforeCompile` 分岐を新規に追加しないこと
- **検証**: Playwright で `renderer.info.programs.length` が Iter5 比で増えないことを AC-05 に含める

### NFR-09: アクセシビリティ（現行踏襲）

- 数値ラベルは読みやすいサイズ・コントラスト（FR-07 の最小 20px）
- 色だけに依存しないよう、アイコン or 文字（`+5 味方` 等）を併記

### NFR-10: キャッシュ戦略（新規）

- **既存 GLB の URL・ハッシュは変更しない**（CloudFront invalidation 不要）
- material tint で色違いを実現するため GLB バイナリは追加しない
- 仮に将来 GLB 追加が必要になった場合は `v2/` フォルダへ切り、`vN/` 単位で immutable cache を運用（現行 `v1/` はそのまま保持）
- `index.html` / `assets/*.js` は Vite hash で別管理のため invalidate 対象外

### NFR-11: テスト決定論性（新規）

- **PRNG シード固定 API**: `window.__setRngSeed(n)` のようなデバッグ API を提供。AC-02/03/04 の Playwright テストで決定論的に動作させる
- **強制スポーン API**: `window.__SPAWN_FORCE_NEXT = 'RIFLE'` のような強制指定で次スポーンのタイプを確定できる
- **ゲーム状態 assert API**: `window.__gameState` 経由で ally_count / buff_state / current_weapon 等を Playwright が assert 可能
- これらは本番ビルドでは無効化（`import.meta.env.PROD` ガード）

## 受入基準（Acceptance Criteria）

### AC-01: 敵ドロップ経路・旧ジェム描画の完全排除
- **コード検証**: 全 grep で以下がゼロ
  - `ItemDropManager` / `determineDrops` / `POWERUP_DROP_WEIGHTS` / `WEAPON_DROP_TYPES` の参照
  - 旧 `ItemType` / 旧 `WeaponType` / `ITEM_COLORS` / `itemTypeToBuff` / `itemTypeToWeapon` の参照
  - `SphereGeometry(0.08,` （旧ジェム描画）
- **実行検証**: Playwright で 120 秒プレイ中、シーン走査（`window.__gameState.sceneEntities` 等）で `ItemBarrelEntity` / `GateEntity` 以外のアイテム系描画オブジェクトが存在しないこと

### AC-02: 武器樽の機能確認
- 決定論モード（シード固定 + 強制スポーン）で 1 秒以内に樽出現
- 樽を撃ち HP 0 で破壊できる
- 破壊後、プレイヤー武器が対応ジャンルに切り替わり、射撃挙動が変化する
- 樽の上に武器モデルが乗っている（Playwright スクリーンショット目視）
- **本体衝突確認**: プレイヤー/仲間が樽に触れてもすり抜ける（衝突によって武器切替や消滅が起きないこと）
- **敵と樽が重なる位置で弾丸の誤検知ゼロ**（レイヤー分離の確認）

### AC-03: ゲートの機能確認
- 決定論モードで 1 秒以内にゲート出現
- プレイヤーがゲートを通過すると効果が発動する（`window.__gameState` 経由で ally_count / buff_state を assert）
- **仲間のみが通過した場合は効果発動しない**（スルー、ゲートは消滅しない）
- 同じゲートを 2 体以上が同時に通過しても効果は 1 回のみ発動
- ゲートは撃っても破壊されない
- 効果量が数値でゲートにオーバーレイ表示され、画面上 20px 以上の高さで描画される
- **ALLY_ADD 上限（10 人）到達時**: 仲間は増えず、「MAX」代替トーストが表示される
- **HEAL HP 満タン時**: 同様に「MAX」代替トーストが表示される

### AC-04: Wave 境目ボーナス
- `WAVE_DEFINITIONS.endTime` 直後 1 フレーム以内（45s / 90s / 180s）に**強化ゲート or 上位武器樽が確定出現**
- 確定出現オブジェクトにはリング発光・BONUS ラベル等の強調装飾が付与される
- 画面上部に Wave 遷移トーストが表示される

### AC-05: NFR 達成
- tsc / ESLint clean、Jest 全 PASS
- **bundle**: gzip 増分 +20KB 以内、絶対値 ≦ 215KB（`size-limit` CI で自動検証）
- **fps**: viewport 1280x720、90 秒連続計測で平均 ≥ 58fps、5% 以下のフレームで 50fps を下回らない（`browser_evaluate` で rAF 集計）
- `renderer.info.programs.length` が Iter5 比で増えない（shader 再コンパイルなし）

### AC-06: WebGL context lost/restored 対応
- Playwright で `WEBGL_lose_context` により context lost → restored を実行
- restored 後、既存の樽/ゲート/HUD が再構築されるか、破棄されて再スポーン待機状態になる（console error なし）
- プレイ継続可能

### AC-07: メモリリーク検証
- Playwright で 5 分プレイのロングシナリオを実行
- `window.__metricsProbe.heapDiff5min < 10 * 1024 * 1024` （10MB 未満）を assert

### AC-08: GAME_OVER 時の発動停止
- GAME_OVER フラグ後にゲートを通過しても効果が発動しないこと
- GAME_OVER 後に樽を撃破しても武器切替が起きないこと
- GAME_OVER 後はアイテム/ゲートの新規スポーンが停止していること

## Open Issues（Application Design で詰める、Iter6 要件確定外）

1. **レーン幅**: 現行ゲームの横方向移動範囲と、ゲートの幅（全幅 or 部分幅）
2. **武器切替時の弾丸挙動**: 本要件で既定値（継続）を定めたが、Application Design で逆の結論になった場合のみ上書き
3. **パーティクル/エフェクト上限の具体値**: EffectManager3D の pool 上限に合わせ具体値を確定
4. **`console.info` の production 除去判断**: デバッグビルドで残す既定で進めるが、FR-09 の具体化は Application Design で
5. **HP / 効果量の最終バランス**: Playwright 実測で微調整（本要件は暫定値）
6. **Wave 境目ボーナスの将来のバランス調整余地**: Iter6 は 45/90/180s の 3 点確定、Iter7 以降で変更する可能性あり

## 付録: enum / config の新定義（暫定）

```ts
// types/index.ts
export enum WeaponGenre { RIFLE, SHOTGUN, MACHINEGUN }

export enum BarrelItemType { WEAPON_RIFLE, WEAPON_SHOTGUN, WEAPON_MACHINEGUN }

export enum GateType { ALLY_ADD, ATTACK_UP, SPEED_UP, HEAL }

// 旧 WeaponType / ItemType / ITEM_COLORS / itemTypeToBuff / itemTypeToWeapon は削除

// config/barrelConfig.ts（新規）
export const BARREL_HP: Record<BarrelItemType, { baseHp: number; waveScale?: number }> = {
  WEAPON_RIFLE:      { baseHp: 30, waveScale: 1 },
  WEAPON_SHOTGUN:    { baseHp: 40, waveScale: 1 },
  WEAPON_MACHINEGUN: { baseHp: 50, waveScale: 1 },
};
// Iter6 では waveScale=1 固定、将来の Wave 連動に備えて型のみ拡張

// config/gateConfig.ts（新規）
export type GateEffect = {
  amount: number;
  unit: 'percent' | 'flat' | 'count';
  durationSec?: number;
};

export const GATE_EFFECTS: Record<GateType, GateEffect> = {
  ALLY_ADD:   { amount: 5,  unit: 'count' },                  // +5 人
  ATTACK_UP:  { amount: 30, unit: 'percent', durationSec: 10 }, // +30%, 10秒
  SPEED_UP:   { amount: 20, unit: 'percent', durationSec: 10 }, // +20%, 10秒
  HEAL:       { amount: 40, unit: 'flat' },                    // 防衛ライン HP +40
};

// runtime 検証（ゲート効果適用前）:
//   Number.isFinite(amount) && amount > 0 && amount <= MAX_AMOUNT
// 検証失敗時はその効果を no-op にする
```

（上記値はすべて暫定。Application Design および Construction フェーズの Playwright 実測で調整する）
