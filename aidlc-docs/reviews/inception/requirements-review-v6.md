# 要件定義書 レビュー結果（第1回、Iter6）

**レビュー対象**: `aidlc-docs/inception/requirements/requirements-v6.md`
**レビュー日**: 2026-04-20
**レビュー方式**: 6 つの専門家ロールによるクロスファンクショナルレビュー（独立エージェント並列実行）
**前回レビューからの変更点**: 初回レビュー（Iter6 新規作成 requirements-v6.md 対象）

---

## 1. フロントエンド開発者

### レビュー観点
- UI/UX の実現可能性（Three.js/DOM オーバーレイでの数値ラベル、HUD、トースト）
- 数値ラベル表示の実装選択肢（3D 追従 sprite vs ワールド→スクリーン座標変換の DOM オーバーレイ）
- 武器切替時の HUD 表示とプレイヤーフィードバック（現武器ジャンルの可視化）
- ゲート通過判定の視覚的フィードバック（色分け、発光、トースト）
- 既存コンポーネント（HTMLOverlayManager / EffectManager3D / EntityFactory / AssetManager）との整合性
- 状態管理（武器ジャンル、バフ残り時間、仲間数）の責務分離とデータフロー
- ユーザー操作フロー（プレイヤーが何をすると何が起こるか一貫して伝わるか）

### OK項目

| # | 対象要件 | OK理由 |
|---|---------|--------|
| F-OK-1 | FR-07: UI/HUD の HTMLOverlayManager 流用方針 | 既存 `HTMLOverlayManager` を再利用し 3D 座標→スクリーン座標変換でオーバーレイを出す方針が明記されており、現行 Iter5 までのアーキテクチャとの親和性が高い。新たなレンダリングパスを追加しないため技術的整合が取れている。 |
| F-OK-2 | FR-07 / NFR-05: XSS 対策の textContent 縛り | `innerHTML` 禁止・`textContent` と DOM API のみという方針が既存 Iter3 方針と一致して明示されており、数値ラベル追加という DOM 量の増える変更でも安全側に倒す指針がぶれない。 |
| F-OK-3 | FR-04: ゲートの色分け（ALLY_ADD=青 / ATTACK_UP=赤 / SPEED_UP=黄 / HEAL=緑）＋アイコン併記（NFR-09） | 通過型ゲートというプレイヤーにとって新メカニクスに対し、「効果種別を色で瞬時に判別させる」＋「色覚依存回避のためのアイコン/文字併記」という二重のフィードバック設計があり、UI としての正当性が高い。 |
| F-OK-4 | FR-08: 取得時トースト（「RIFLE を取得！」0.8 秒） | 武器切替という画面上は小さな変化になりがちなイベントに対し、画面中央トーストで明示する設計は、Last War 系ゲームに期待される「何が起きたか即座に分かる」UX 原則に沿っている。 |
| F-OK-5 | NFR-03: ラベル更新 30Hz 方針 | 数値ラベルの DOM 更新を毎フレーム実行しないと明記されており、DOM の layout/paint コストを避けつつ 60fps 維持する実装方針として妥当。Three.js + DOM ハイブリッド描画の定番最適化を踏襲している。 |
| F-OK-6 | NFR-06: gateConfig.ts / weaponConfig.ts への集約 | 武器ジャンル・ゲート効果の追加が config エントリ追加のみで済む構造が要件化されており、UI 側（HUD アイコン、色マップ）を config 駆動にするための前提が揃っている。 |
| F-OK-7 | FR-05: 同時存在数の上限（樽 3 / ゲート 2） | 画面上の数値ラベル DOM 要素数が予測可能になり、HTMLOverlayManager の pool サイズや可読性（文字が重ならない配置）の設計が現実的になる。UI 側の輻輳を防ぐ要件として適切。 |
| F-OK-8 | AC-02 / AC-03: 視覚確認可能な Acceptance Criteria | 「樽の上に武器モデルが乗っている」「効果量が数値でゲートにオーバーレイ表示される」など、画面上で目視検証できる形で受入基準が書かれており、フロント視点のテストがしやすい。 |

### NG項目

| # | 対象要件 | NG理由 | 提案 |
|---|---------|--------|------|
| F-NG-1 | FR-03 / FR-04: **数値ラベル表示方式が「or」のまま未確定** | FR-03「3D テキストスプライト **or** HTMLオーバーレイ」、FR-07「3D 追従 or ワールド→スクリーン座標変換」と両論併記のまま受入に進もうとしている。方式によりフォント品質・パフォーマンス特性・文字サイズ制御・DPR 対応・重なり順が大きく異なり、NFR-03（30Hz 更新）や NFR-09（読みやすさ）の成立条件も変わる。要件段階で方式が決まらないと NFR 達成可否を判定できない。 | **提案**: FR-07 に「数値ラベルは HTMLOverlayManager による DOM オーバーレイ方式（ワールド→スクリーン座標変換）を採用する」と一本化して明記する。Three.js Sprite/CanvasTexture は日本語/大きな数字のアンチエイリアスと動的更新コストで劣るため、既存 HTMLOverlayManager と同方式に揃えたほうが既存コンポーネントとの整合・テスト容易性の両面で優位。どうしても両論残すなら Application Design で確定する旨を Open Issues に追加する。 |
| F-NG-2 | FR-07: **現武器ジャンル HUD の表示位置・内容・更新契機が未定義** | 「画面端 HUD、アイコン＋名前」としか書かれておらず、位置（左下/右下/上部）、サイズ、アクティブ時の強調、武器切替時のトランジション（FR-08 のトーストとの役割分担）が未定義。プレイヤーは「今どの武器か」「切替が成功したか」を確認する主要 UI なので、ここが曖昧だと Playwright 目視確認も主観的になる。 | **提案**: FR-07 に「画面左下（または右下）に固定表示、幅・高さの目安値、アイコンはゲートの色分けに準拠、切替時は 0.3 秒のフラッシュ/スケールで強調」等を具体化する。トースト（FR-08）は「切替瞬間の演出」、HUD（FR-07）は「現在状態の常時表示」と役割分離を明文化する。 |
| F-NG-3 | FR-06: **バフ残り時間の可視化要件が欠落** | ATTACK_UP / SPEED_UP は `durationSec=10`、かつ同種取得時「残り時間の長い方に上書き」という仕様だが、残り秒数をプレイヤーが視認する手段（バフアイコン＋カウントダウン等）が FR-07 に記載されていない。プレイヤーは次ゲートへ突入すべきかの意思決定ができず、Last War 風 UI としても片手落ち。 | **提案**: FR-07 に「アクティブバフアイコン列（画面上部または HUD 横）を設け、各バフの残り時間をカウントダウン表示する」項目を追加する。少なくとも ATTACK_UP / SPEED_UP の 2 種が同時アクティブになりうるため、表示枠数（2〜3）も明記する。 |
| F-NG-4 | FR-04: **ゲートの「通過」判定のユーザー体験仕様が曖昧** | 「プレイヤー/仲間のいずれかがゲート Y 座標を跨ぐ」とあるが、(a) ゲート幅を外れた位置で通過した場合の挙動（FR-04「アーチ/板型」と Open Issues 1「全幅か部分幅か」）、(b) 仲間だけ通過してプレイヤー未通過の場合も発動するか、(c) 複数仲間が同時通過した際に効果が重複して発動するか、が未定義。ユーザーは「狙って通る」「避ける」という意思決定をするので、この判定仕様が UX の根幹。 | **提案**: FR-04 に「発動条件: ゲートの X 幅内かつ Y 跨ぎ。発動は 1 ゲートあたり 1 回のみ（最初に通過した 1 エンティティでトリガー、以降は通過してもノーオペ）」のように具体化する。Open Issues 1 を FR に昇格させる。 |
| F-NG-5 | FR-03: **樽の残 HP 数値ラベルの意義・可読性の要件不足** | 樽 HP が固定 30/40/50 に対し、プレイヤー弾のダメージが要件に現れていないため、プレイヤーが「何発で壊れるか」を把握できるかが数値表示の主目的か、単なる演出かが不明。また「樽の上部」にラベルを出すと、樽の上に乗る武器モデル（FR-03）と表示が重なる可能性がある。 | **提案**: FR-03 に「ラベルは樽モデル bounding box の**上辺より上方（武器モデルの上）**に配置」「ダメージを与えるたびに数値が減るアニメ（例: 色フラッシュ）」を追加し、ラベルの目的（残 HP 把握）と配置競合回避を明記する。 |
| F-NG-6 | FR-05: **Wave 境目ボーナスのユーザーへの予告/演出が未定義** | 「強化ゲートが 1 個確定出現」「上位武器樽が確定出現」と書かれているが、プレイヤーから見て「Wave 境目が来た」「ボーナスが出現した」ことを認識する手段が無い。Last War 系ではここが盛り上がりポイントであり、UI 上の強調演出（Wave 表示の拡大、BGM 合図、ボーナスマーク）が無いと仕様の意図が伝わらない。 | **提案**: FR-05 または FR-08 に「Wave 境目では、ボーナス樽/ゲートに強調装飾（リング発光、上部に "BONUS" ラベル等）を付与し、画面上部に Wave 遷移トーストを出す」ことを追加する。 |
| F-NG-7 | FR-06: **ALLY_ADD で仲間上限到達時のフィードバック未定義** | 「取得しても増えない／取得不可」だけで、ゲート通過したのに何も起きない体験になるとユーザーは故障と勘違いする。HEAL も同様に「HP 満タン時」に無反応だと同じ問題。 | **提案**: FR-08 の視覚効果節に「上限到達/HP 満タンで効果が発動しなかった場合も、ゲート通過演出は出したうえで「MAX」等の代替トーストを表示する」を追加。サイレント失敗を避ける。 |
| F-NG-8 | FR-07: **HUD と既存 HTML UI（スコア/Wave/防衛ライン HP 等）との画面レイアウト整合性が未記載** | 新規追加要素（武器 HUD、バフ残時間、数値ラベル 3〜5 個、Wave ボーナストースト）が集中するが、現行 HUD（スコア/Wave/残 HP）との画面内配置・z-index・優先度が定義されていない。モバイル横画面やウィンドウサイズ変更時のオーバーラップが未検討。 | **提案**: FR-07 に「画面レイアウトマップ（ASCII 図 or 箇条書き）」を追加し、各要素のアンカー位置（top-left / top-right / bottom-left / bottom-center 等）と z-index レイヤを定義する。NFR にレスポンシブ（最小幅/高さ）要件も追加する。 |
| F-NG-9 | NFR-03: **ラベル 30Hz 更新の実装責務が未定義（どのシステム/マネージャが担うか）** | HTMLOverlayManager が 30Hz 制御を行うのか、各エンティティ側で dt を積算するのか、GameLoop 側で分岐するのかが書かれていない。実装者ごとに解釈がブレると二重更新や更新漏れが起きる。 | **提案**: NFR-03 または FR-07 に「HTMLOverlayManager が内部で ~33ms スロットリングし、`update(scene, camera)` が毎フレーム呼ばれても DOM 書き換えは 30Hz に間引く」と責務を明記する。 |
| F-NG-10 | NFR-07: **武器モデル clone の disposal 対象にマテリアル/テクスチャが含まれるか不明確** | 「新規で clone する武器モデル（樽上の guns モデル）は破壊時に dispose 必要」とあるが、MACHINEGUN の tint 用に material clone（NFR-08）する場合、geometry は共有でも cloned material の dispose 責任が宣言されていない。メモリリークの温床になる。 | **提案**: NFR-07 に「`SkinnedMesh`/`Mesh` の dispose 対象を (geometry は共有のため非 dispose / cloned material のみ dispose / texture は AssetManager 所有のため非 dispose) のように分離して明記」する。CleanupSystem のテストで cloned material 数のリークチェックを追加する旨も NFR-04 に加える。 |
| F-NG-11 | FR-08: **トースト同時発火時のキュー/重畳ポリシーが未定義** | 武器取得・ゲート通過・Wave 境目が短時間に重なった場合、トーストを重ねて出すか、キューして順次表示するかが未定義。Last War 系では高頻度で重なるシチュエーションがあり、UX 直撃要件。 | **提案**: FR-08 に「トーストは同時 1 件まで。発生が重なった場合は FIFO キューで 0.8 秒ずつ順次表示、古い通知はドロップ」等のポリシーを明記する。 |
| F-NG-12 | AC-03: **「効果量が数値でゲートにオーバーレイ表示される」の検証粒度不足** | 受入基準が定性的で、「読みやすいサイズ」（NFR-09）の閾値や、距離が遠い時に文字が潰れないかを Playwright で確認する具体手順が無い。目視の主観に依存する。 | **提案**: AC-03 に「ゲート出現時から通過までの間、文字が画面上 24px 以上の高さで描画される」「カメラ距離最遠時でもつぶれない」等、計測可能な基準を追加する。Playwright では `getBoundingClientRect` で検証可能。 |

---

## 2. バックエンド開発者

### レビュー観点
- データモデル（enum / config / Component）の設計妥当性と拡張性
- 既存 WeaponType / BuffType / ItemType との整合（移行/置換方針）
- 処理フローの実現可能性（スポーン、衝突判定、バフ適用、武器切替、ゲート通過検知）
- ビジネスルール（HP/効果量/出現頻度/Wave連動）の定義網羅性
- エラー/エッジケース（HP 0 直前にゲームオーバー、武器切替中の弾丸、仲間上限超過、同時取得）
- 設定値の外部化（config 分離）と保守性
- 破壊的変更（既存テスト破壊、既存ロジック削除）の影響評価

### OK項目

| # | 対象要件 | OK理由 |
|---|---------|--------|
| B-OK-1 | FR-01（敵ドロップ機構の完全削除）| dead code である `ItemDropManager` / `determineDrops` / `POWERUP_DROP_WEIGHTS` / `WEAPON_DROP_TYPES` と `EnemyConfig` の `itemDropRate` / `weaponDropRate` を明示削除対象として列挙しており、「grep で参照ゼロ」という検証可能な AC-01 と対応しているため、破壊的変更の範囲が明確。 |
| B-OK-2 | 付録の enum / config 新定義（`WeaponGenre` / `BarrelItemType` / `GateType` / `BARREL_HP` / `GATE_EFFECTS`）| 新データモデルが enum と Record で型安全に定義されており、既存 TypeScript ECS の慣習と整合。`BARREL_HP` / `GATE_EFFECTS` を別 config ファイル（`barrelConfig.ts` / `gateConfig.ts`）に分離する方針が NFR-06（保守性）とも整合。 |
| B-OK-3 | FR-06（バフ重複・武器切替の扱い）| 同種バフの重複は「残り時間を上書き（長い方）」、武器は「最後取得で切替（スタックなし）」と明示しており、状態遷移の曖昧さが排除されている。`ALLY_ADD` 上限や `HEAL` オーバーフローのエッジケースにも言及されている。 |
| B-OK-4 | FR-05（出現頻度・タイミング、採用方針C）| 通常ランダム（武器12-15秒/ゲート8-10秒、別タイマー）と Wave 境目ボーナスを両立する方針が定量化されており、既存 `SpawnManager` / `WAVE_DEFINITIONS` / `WAVE_SCALING` を参照点として利用できる。同時存在上限（樽3/ゲート2）もランタイム資源管理の観点で妥当。 |
| B-OK-5 | NFR-07（メモリ/dispose 責任）| Iter5 で確立した dispose 分界（AssetManager 保持禁止 / CleanupSystem が entity 所有物を dispose）を踏襲し、樽上の武器モデル clone の dispose 責務も明記されている。GLTF clone リークという本プロジェクト固有の落とし穴に対して適切。 |
| B-OK-6 | FR-04（ゲートは HP なし・撃てない）| ゲートを「弾が当たらない判定」と明記することで、CollisionSystem 側の分岐（Barrel=弾↔HP判定、Gate=プレイヤー/仲間↔通過判定）を明確に切り分けられており、既存衝突ロジックの汚染を避けられる設計。 |
| B-OK-7 | Open Issues の列挙 | レーン構造・上限値・武器切替中の弾道など、Application Design に委ねるべき論点が明示的に残されており、要件レベルでの over-specification を避けている。 |

### NG項目

| # | 対象要件 | NG理由 | 提案 |
|---|---------|--------|------|
| B-NG-1 | FR-02 / FR-03（既存 `WeaponType` の再設計方針）| 「既存 `WeaponType: FORWARD/SPREAD/PIERCING/BARRAGE` は再設計（詳細は Application Design で）」としつつ、付録では新しい `WeaponGenre: RIFLE/SHOTGUN/MACHINEGUN` を定義しており、**旧 enum を廃止するのか共存するのかが要件レベルで未確定**。`WeaponSystem` や `BulletComponent` の弾道ロジックは `WeaponType` に依存しているため、移行戦略が無いとバックエンド実装が着手不能。 | FR-02 に明示で「旧 `WeaponType` enum は削除し、`WeaponGenre` に一本化する。`WeaponSystem` / `BulletComponent` / `weaponConfig.ts` の `WeaponType` 参照箇所は全て `WeaponGenre` に置換する」旨を追記。互換維持しないことを AC にも明記。 |
| B-NG-2 | FR-06 / Open Issues-4（武器切替時の既発射弾丸の扱い）| 「射撃中にジャンル変更された場合の弾丸破棄 or 継続」が Open Issue 扱いだが、バックエンドロジック上は**切替時点で在空弾の発射元ジャンル情報が不定**になる可能性があり、ダメージ計算や貫通挙動が不整合を起こす。要件として最低ラインの方針を決めないと、CollisionSystem のダメージ判定にバグが残る。 | FR-06 に「武器切替時、既発射の弾丸は `BulletComponent` に保持された発射時パラメータ（ダメージ/貫通/拡散）で最後まで処理される（継続）。新武器の弾は次フレーム以降の発射から適用」という既定値を明示。Application Design で逆の結論になった場合のみ上書き。 |
| B-NG-3 | FR-03（武器樽 HP と Wave 不変）| HP を「タイプ別固定値（Wave 不変）RIFLE=30 / SHOTGUN=40 / MACHINEGUN=50」としているが、後半 Wave では敵 HP・火力がスケーリングするためプレイヤー火力も高く、**樽が即破壊される**（取得しやすすぎる）リスク。逆に序盤は時間がかかる。ロジック層として Wave 連動の余地を閉ざすと後で config 変更量が増える。 | `BARREL_HP` を `Record<BarrelItemType, number>` ではなく `Record<BarrelItemType, { baseHp: number; waveScale?: number }>` 等に拡張できる型にし、「Iter6 では waveScale=1 で固定、将来の調整余地を残す」と明記。または FR-05 側で「Wave 境目ボーナス樽は HP +50%」等の既定を入れる。 |
| B-NG-4 | FR-04（ゲート通過検知「Y 座標を跨ぐ」）| 通過検知を「プレイヤー/仲間のいずれかがゲート Y 座標を跨ぐ」と書いているが、**ゲート自体が移動している**（上部からプレイヤー方向へ流れる）ため、Y 座標の相対運動で判定が発火するタイミングが曖昧。また複数仲間が同時に跨いだ場合の多重発火や、効果が1回きりか毎通過かも未定義。 | FR-04 を「ゲートのワールド Y 座標がプレイヤー/仲間の Y 座標を**ゲート側から**跨いだ瞬間（フレーム間で符号変化）に1回発火する。その後ゲートは `consumed=true` フラグで以降の通過を無視し、次フレームの CleanupSystem で消滅」と明示。多重発火防止フラグを Component レベルで定義する。 |
| B-NG-5 | FR-06（`ALLY_ADD` 仲間上限）| 「仲間上限（仮 20 人）に達している場合は取得しても増えない／取得不可」と両論併記されており、要件としてどちらが正解か未決。バックエンド観点では「ゲート効果は発動したが人数は増えない」（取得不可ではなく no-op）か、「ゲート効果自体がキャンセルされる」かで SpawnManager とエフェクト表示の分岐が変わる。 | FR-06 を「上限到達時は `ALLY_ADD` ゲートを通過しても仲間は増えない（no-op）。ただし通過エフェクトと toast は表示する（視覚上の不整合回避）」と単一解に確定させる。上限値は Open Issue で残してよい。 |
| B-NG-6 | FR-06（`HEAL` の「現在 HP が最大ならオーバーフローしない」）| 「オーバーフローしない」とあるが、対象が**防衛ラインの HP**（FR-04 で定義）なのか、Iter5 時点でプレイヤー/仲間に HP 概念があるのか曖昧。`HEAL` amount=40 の単位も「防衛ライン HP +40」と注記だけで、**最大値や現在値の型・保持場所**が要件上不明。 | FR-06 の HEAL 箇所で「回復対象は `DefenseLineComponent.hp`。最大値は現行の `defenseLine.maxHp`。加算後 `min(hp + amount, maxHp)` でクランプする」と対象 Component と計算式を明記。 |
| B-NG-7 | FR-05（Wave 境目ボーナスの発火契機）| 「`WAVE_DEFINITIONS.endTime` 到達時、および `WAVE_SCALING` による 30 秒ごとのスケーリング境目のうち**主要箇所**」という曖昧表現で、どのタイミングで確定スポーンさせるかが不定。AC-04 では 45s/90s/180s と具体値があるが、FR-05 と AC-04 で粒度が異なる。 | FR-05 の Wave 境目ボーナス条件を「`WAVE_DEFINITIONS` の各 `endTime`（45s/90s/180s）に到達した次フレームで 1 回だけ発火」と単一基準に確定。`WAVE_SCALING` 30 秒境目は Iter6 スコープ外と明記。 |
| B-NG-8 | FR-03（衝突判定：プレイヤー本体 vs 樽）| 「すり抜け or 同位置で破壊（詳細は Application Design）」と要件レベルで未決。バックエンドとしてはここが決まらないと **CollisionSystem のレイヤー/マスク設計**が組めない（プレイヤー↔樽を衝突レイヤーに含めるか否か）。Open Issue-2 にも再掲されている重複項目。 | FR-03 に既定値として「プレイヤー/仲間 vs 樽はすり抜け（衝突なし）。樽 vs 弾のみ判定対象」と確定記載。Open Issue-2 は削除し、調整が必要なら別 Iter で。 |
| B-NG-9 | 付録（バフの加算方式）| `GATE_EFFECTS` の `ATTACK_UP: { amount: 30, durationSec: 10 }` が `+30%` を意味すると注記されているが、**加算（+30）か乗算（×1.3）か**の型上の区別がなく、将来 HEAL の `amount: 40` が HP 固定値であることとも混在する。バックエンド実装時に単位ミスを招きやすい。 | `GATE_EFFECTS` の型を `{ amount: number; unit: 'percent' | 'flat' | 'count'; durationSec?: number }` に拡張、または `effect` 種別ごとに別型にして discriminated union 化する。要件にも単位を明記。 |
| B-NG-10 | FR-07（数値ラベル更新頻度と HP 0 直前のイベント順序）| NFR-03 で「数値ラベルは 30Hz」だが、**HP 0 直前 1 フレームで樽がゲームオーバー（防衛ライン到達）する**ケースや、ラベル更新の遅延で「HP=1 と表示されたまま破壊」が発生する。要件レベルで「破壊時点で即ラベル非表示・toast 発火」の順序保証がない。 | FR-07 / FR-08 に「樽 HP が 0 以下になった当該フレームでラベルを非表示化し、同フレームで取得 toast を発火する（ラベル更新 30Hz の間引き対象外）」と例外ルールを明記。 |
| B-NG-11 | FR-03 / NFR-04（`ItemPickupSystem` or CollisionSystem 拡張の選択未定）| FR-03 で「CollisionSystem（または専用 ItemPickupSystem）が破壊イベントを検知」と両論併記、NFR-04 テスト対象では `ItemBarrelSpawner` / `GateTriggerSystem` は列挙されるが `ItemPickupSystem` は曖昧。ECS 層の System 一覧が確定しないとテスト計画が組めない。 | 「武器樽の HP 判定は既存 CollisionSystem に拡張、武器切替副作用は新規 `WeaponSwitchSystem` で扱う」など System 責務分担を確定。NFR-04 のテスト対象リストも合わせて更新。 |
| B-NG-12 | NFR-01（既存テスト 100 tests の扱い）| 「破壊的変更で失敗するテストのみ修正し、原則全 PASS を維持」とあるが、FR-01 / FR-02 で `ItemType` / `ItemDropManager` / `itemSpawn` / `ITEM_COLORS` を削除するため、**これらに依存している既存テストは確実に破壊される**。"どのテストが破壊対象か" の見積もりと置換方針が無いと着地が読めない。 | NFR-01 に「`ItemType` / `ItemDropManager` / `itemSpawn` / `ITEM_COLORS` 関連テストは削除 or 新 `BarrelItemType` / `GateType` テストへ置換。置換後のテスト総数の目安を Application Design で確定」と補足。 |

---

## 3. AWSインフラエンジニア

### レビュー観点
- バンドルサイズ影響（NFR-02: gzip +20KB 以内の妥当性）
- アセット流用方針の是非（新規 GLB 追加なし、material clone 戦略）
- ビルド時間・デプロイ影響（CI/CD 工程変更の必要性）
- ランタイムリソース（同時樽 3 + ゲート 2 + 敵/仲間時のメモリ・GPU 負荷）
- dispose 責任分界の明記有無（メモリリーク防止）
- キャッシュ戦略（既存 GLB キャッシュ影響、バージョニング）
- 60fps 維持の前提条件・計測方法

### OK項目

| # | 対象要件 | OK理由 |
|---|---------|--------|
| I-OK-1 | NFR-02（バンドルサイズ）+ NFR-08（リソース配置） | Iter5 配置済の `Crate.glb` / `guns/*.glb` を流用し、新規 GLB 追加なしを明言。公衆配信パス `public/models/toon-shooter/v1/` が Iter5 から変わらないため CloudFront のキャッシュキー／invalidation 範囲への影響がなく、デプロイコストが最小。gzip +20KB 上限も現行 195KB に対し約 +10% 枠で、ロジック追加（config/enum/新 System）規模としては妥当。 |
| I-OK-2 | NFR-07（メモリ/dispose 責任）＋「MACHINEGUN は material clone + tint」方針 | Iter5 で確立した dispose 責任分界（AssetManager は保持のみ、CleanupSystem が entity 所有物を dispose）を踏襲し、新規 clone 対象（樽上の guns モデル）の dispose 必要性を NFR-07 で明記。material clone + tint 方針は GLB 再配置を避けつつ GPU テクスチャメモリを共有できるため、VRAM フットプリント増を最小化できる。 |
| I-OK-3 | FR-05（同時存在数上限：武器樽 3 / ゲート 2） | 同時表示オブジェクトに明示的上限を設けている点はランタイムリソース制御として優秀。draw call 増加・物理判定コスト・HUD オーバーレイ DOM 要素数の爆発を抑止でき、ローエンド端末での GPU/CPU 破綻を予防。さらに「上限到達時は次回スポーン時刻まで待機」という挙動も仕様化されており、メモリリーク型の無限増殖を構造的に排除。 |
| I-OK-4 | NFR-03（パフォーマンス）＋「数値ラベル更新 30Hz」 | 60fps 維持目標と、DOM オーバーレイ更新を 30Hz に抑える方針を分離して規定。毎フレーム `getBoundingClientRect` / `style.transform` 更新は layout thrashing を招くため、半分のレートに落とす方針はブラウザレンダリングパイプラインの観点で正しい最適化。 |
| I-OK-5 | FR-01（敵ドロップ機構の完全削除）＋ AC-01 | dead code（`ItemDropManager` / `determineDrops` / `POWERUP_DROP_WEIGHTS` 等）を grep ゼロまで除去する受入基準があり、Tree-shaking 残渣を防ぐうえで有効。未参照 enum/config の残存はバンドル肥大化と保守負債の温床のため、削除を AC 化しているのは CI/CD 的に望ましい。 |
| I-OK-6 | NFR-04（コード品質）＋ AC-05 | tsc / ESLint clean、Jest 全 PASS、Playwright シナリオを NFR と AC の両方に組み込み、ビルドパイプラインのゲート条件として機能。Iter5 の CI 前提（Jest + tsc + ESLint）を変更せず使える構造になっている。 |
| I-OK-7 | FR-07（XSS 対策：textContent / DOM API のみ） | 新規 HUD（樽残 HP、ゲート効果量、現武器ジャンル）追加にあたり、`innerHTML` 禁止方針を明文化。S3/CloudFront 配信する静的アプリで WAF を持たない以上、XSS 経路を生まない DOM 生成ポリシーの継続は重要。 |

### NG項目

| # | 対象要件 | NG理由 | 提案 |
|---|---------|--------|------|
| I-NG-1 | NFR-02（bundle gzip +20KB 以内） | 根拠が記載されておらず、(a) 新規コード（BarrelSpawner / GateTriggerSystem / 武器切替ロジック / barrelConfig / gateConfig / 新 enum / HUD 追加 / toast 追加）の実装規模見積りと、(b) FR-01 で削除する dead code による gzip 減少分、の差し引き内訳が不明。特に `three/examples/jsm` の未使用モジュールが新規 import で tree-shake 対象から外れるケースが頻出するため、+20KB 目安が守れる保証がない。 | NFR-02 を「追加分 gzip +20KB 以内（内訳: 新規コード +X / dead code 削除 -Y / 新 config +Z）の三要素で管理する」形に書き換え、CI で `vite build` 後の `dist/assets/*.js` の gzip サイズをアーティファクトとして比較する仕組み（例: `size-limit` or 既存の build log パース）を AC-05 に追加する。少なくとも Iter5 実績値 195KB を baseline として `size-limit` 準拠の閾値ファイルを登録する。 |
| I-NG-2 | NFR-03（同時表示 樽3+ゲート2 で 60fps 維持） | 「60fps 維持」の計測方法が Playwright DevTools Performance としか書かれておらず、(a) 対象ハード/解像度/GPU ティア、(b) 平均 fps か p95 か、(c) 連続計測時間、(d) 合否ライン、が未定義。インフラ観点で言うと CloudFront 経由配信時の初回ロード込み fps 計測なのか、キャッシュヒット後なのかも不明で再現性がない。 | NFR-03 に最低限「計測条件: viewport 1280x720 / 60 秒連続 / `requestAnimationFrame` ベースで p5 ≥ 55fps」等の定量条件を追加。Playwright で `browser_run_code` により fps サンプラを埋め込み、AC-05 の判定を「p5 fps >= 55」のような数値で書く。対象ハードティアは PR 本文に記載する運用を定める。 |
| I-NG-3 | FR-03（武器樽＝Crate.glb + 上に guns/*.glb を child） | 1 樽あたり `Crate.glb` + 武器 GLB の 2 つの clone が発生。最大 3 樽同時存在＝最大 6 mesh＋ material clone。さらにゲート 2 + 敵 + 仲間 + 弾 が同時に存在するため、draw call 総数と GLTF ノードツリー走査コストの見積りがない。Iter5 で `AssetManager` が SkinnedMesh 含む clone をどう扱うかに依存し、GPU スキニング行列アップロードが増える懸念。 | NFR-03 に「同時シーン内 mesh 総数 ≦ N / draw call ≦ M」の目安を記載。AssetManager の clone 戦略（SkeletonUtils.clone か 通常 clone か、material を shared にするか clone するか）を NFR-07 に追記。最悪ケース（3 樽 + 2 ゲート + 30 敵 + 20 仲間）の draw call を見積りで記載。 |
| I-NG-4 | NFR-08（MACHINEGUN は material clone + tint） | material を clone すると uniform が個別化され、Three.js の auto-batching 対象から外れ draw call が分離する。さらに Toon Shader 系でカスタム uniform を持つ場合、shader program も変種として扱われキャッシュミスを招く恐れがある。これを「流用＝軽い」と位置付けるのはインフラ観点で誇大。 | NFR-08 に「material clone 時も texture・geometry は共有し、uniform 差分のみとする。shader 再コンパイル（program 再生成）が起きないこと」を明記。実装時は `MeshToonMaterial` の `onBeforeCompile` 分岐を避け、`material.color` のみ変えるスコープに限定することを条件化。Playwright で `renderer.info.programs.length` が Iter5 比で増えないことを AC に加える。 |
| I-NG-5 | NFR-07（dispose 責任）＋ FR-03/FR-04 | 「clone した武器モデルは破壊時に dispose 必要」とあるが、以下が不明: (a) 樽破壊時に**武器モデルをプレイヤー側に継承**する場合の dispose 所有権移譲、(b) ゲート通過消滅時の `LineSegments`/`Sprite`（数値ラベル）の dispose、(c) HTMLOverlayManager 側の DOM element の removeChild タイミング。メモリリーク・DOM リークの原因になり得る。 | NFR-07 に「樽破壊時: 樽本体 mesh＋material clone＋HUD 数値ラベル DOM を dispose／武器モデルはプレイヤー装備へ所有権移譲（樽側は参照を null 化のみ）」「ゲート消滅時: プロシージャル geometry / material / HUD DOM をすべて dispose」を表にして明記。CleanupSystem の担当範囲を新 Component 単位で表記する。 |
| I-NG-6 | キャッシュ戦略・CI/CD 影響の記述欠如 | `public/models/toon-shooter/v1/` の `v1/` バージョニングは Iter5 の既存実装だが、Iter6 で GLB を**流用する**場合、ブラウザ/CloudFront の既存キャッシュがそのまま効く前提が明記されていない。逆に将来 MACHINEGUN 用の色違い GLB を追加する判断に転んだ場合の path 規約（例: `v2/` への切替）が未定義で、バージョン運用方針が曖昧。 | 「NFR-10: キャッシュ戦略」を新設し、(1) 既存 GLB の URL・ハッシュは変更しない（CloudFront invalidation 不要）、(2) material tint で色違いを実現するため GLB バイナリは追加しない、(3) 仮に GLB 追加が必要になった場合は `v2/` フォルダへ切り、`vN/` 単位で immutable cache を運用、を明記。`index.html` / `assets/*.js` は Vite hash で別管理のため invalidate 対象外である旨も補足。 |
| I-NG-7 | FR-07(数値ラベル=ワールド→スクリーン座標オーバーレイ) | 樽 3 + ゲート 2 = 5 個の DOM 要素を 30Hz で `transform: translate3d()` する方針だが、(a) DOM 要素のプール化（use/release）、(b) 画面外・occlusion 時の `visibility:hidden` 切替、(c) オーバードロー防止の z-order 管理、が未規定。5 要素程度なら実害は小さいが、Wave 境目ボーナス重複時（強化ゲート＋通常ゲート）で一時的に上限超過する可能性を残している。 | FR-07 に「HUD 数値ラベルは最大 (樽上限 + ゲート上限) の固定プールで確保し、`display:none`/`transform` で使い回す」「カメラ背後や画面外は `visibility:hidden` でレンダリング除外」を追記。FR-05 の同時存在上限と HUD プールサイズを同期させることを制約条件として明記。 |
| I-NG-8 | FR-08（破壊エフェクト・通過エフェクト） | EffectManager3D 流用と記されるが、同時に 3 樽破壊 + 2 ゲート通過 + toast が短時間で連発した場合のパーティクル総数上限・pooling 有無が未規定。GPU particle は draw call と fill-rate に直結するためインフラ観点でスパイク要因。 | NFR-03 or FR-08 に「パーティクル最大数 N / 同時エフェクト最大数 M、超過時は古いものから破棄」を追記。既存 EffectManager3D 側のプール上限があるなら明示参照する。toast は CSS アニメで最大 1 件表示（重複時は最新で置換）を規約化。 |
| I-NG-9 | AC-05（bundle gzip 増分 +20KB 以内） | 合否判定プロセスが曖昧。PR レビュー時に人手で `dist` サイズを眺める運用だと回帰検知が漏れる。 | `npm run build` の出力を parse して JSON 化、もしくは `size-limit` / `bundlesize` 等を `devDependencies` に追加し、CI 上で fail させる。閾値は `main` との差分で +20KB、絶対値で gzip ≦ 215KB の両方をチェック。PR template にビルド後サイズの記載欄を設ける。 |

---

## 4. セキュリティエンジニア

### レビュー観点
- 数値ラベル/トースト表示での XSS リスク（DOM オーバーレイ方針の安全性）
- 既存 NFR-06（textContent / innerHTML 禁止）の継承明記
- GLTF 外部アセット利用の Content Security Policy 整合性
- サードパーティモデル信頼（Quaternius CC0 の継続使用、新規追加なし）
- ゲーム状態の改ざん耐性（localStorage, runtime state、スコア/武器切替ロジック）
- 依存ライブラリ新規追加の有無
- `console.log` 等での情報漏えい（NFR-06 既存方針の継承）
- HUD/HTMLOverlayManager 経由の DOM 生成時のインジェクション防止
- 数値ラベルのフォーマット文字列での unescape 漏れ
- 新規 config（barrelConfig / gateConfig）由来の数値が untrusted 化しないことの確認

### OK項目

| # | 対象要件 | OK理由 |
|---|---------|--------|
| S-OK-1 | FR-07 / NFR-05 | FR-07 末尾および NFR-05 で「DOM 生成は `textContent` と DOM API のみ、`innerHTML` 禁止」を明示しており、Iter3 以降のセキュリティ方針を継承している。数値ラベル・トースト・武器ジャンル表示など新規 DOM 要素全般に対して XSS 対策が適用されることが明文化されている点は適切。 |
| S-OK-2 | NFR-02 / NFR-08 | 「新規 GLB アセット追加なし」「既存 `public/models/toon-shooter/v1/` のアセットを流用」と明記され、サードパーティモデル（Quaternius CC0）の範囲を拡大せず、既に監査済みのアセットのみを使用する方針が確定している。新しい外部アセットダウンロード経路や CSP 例外追加が不要。 |
| S-OK-3 | NFR-05 | 「ユーザー入力を扱う経路は現状なし（設定画面のみ、既存踏襲）」と明記しており、新規メカニクス（武器樽/ゲート）導入に伴う新たな入力経路追加がないことを要件レベルで確約している。攻撃面の拡大を抑える方針として妥当。 |
| S-OK-4 | NFR-02 | 「Iter6 追加分は gzip +20KB 以内」の制約により、大きな新規依存ライブラリを追加する余地が物理的にほぼなく、サプライチェーンリスク増加が構造的に抑制されている。要件中に新規 `npm install` 系の記述もない。 |
| S-OK-5 | NFR-07 | dispose 責任分界（AssetManager は保持/dispose 禁止、CleanupSystem が entity 所有物を dispose、clone した武器モデルは破壊時に dispose）が明確で、メモリリーク経由の DoS（長時間プレイでタブクラッシュ）リスクを抑える構造が保たれている。 |
| S-OK-6 | FR-06 | バフ重複・武器切替の扱いを「上書き/切替式」に統一しており、数値加算の暴走（整数オーバーフロー/過剰バフで防衛ライン即死）といったゲーム状態改ざん的挙動の余地が要件側で明確に閉じられている。ALLY_ADD 上限、HEAL オーバーフロー抑制も明記済。 |
| S-OK-7 | 付録: enum / config | 武器 HP / ゲート効果量は config ファイル（`barrelConfig.ts` / `gateConfig.ts`）で定数管理、ユーザー入力や localStorage から読み込む設計ではないため、クライアントサイドでの値改ざん経路（DevTools 経由の改変を除く）が最小化されている。 |
| S-OK-8 | FR-04 | ゲートは「撃っても壊れない・弾が当たらない判定」と明記。これは攻撃側（弾丸）と非攻撃オブジェクトの判定レイヤーを明確に分離する記述で、意図しない衝突経由で状態が飛ぶ（弾でゲート効果が暴発する等のロジック混線）リスクを抑制している。 |

### NG項目

| # | 対象要件 | NG理由 | 提案 |
|---|---------|--------|------|
| S-NG-1 | FR-07 / FR-08 | 数値ラベル（樽 HP・ゲート効果量）および取得 toast（「RIFLE を取得！」等）は**ユーザー入力ではないが config 由来の動的値**を DOM に差し込む経路。「textContent と innerHTML 禁止」は記載があるものの、**テンプレートリテラルで組み立てた結果を `innerHTML` に代入する誤実装を禁じるだけでなく、`insertAdjacentHTML` / `document.write` / jQuery の `.html()` 等の**類似 API も明示禁止しておくべき。また効果量表示の `${amount}%` 等で非数値化した場合のサニタイズ方針が不明。 | NFR-05 に「`innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` / `eval` / `new Function` 全て禁止」と列挙し、数値ラベル構築は `Number(x).toString()` で数値化してから `textContent` に代入するルールを追記する。 |
| S-NG-2 | NFR-05 全般 | 「セキュリティ（現行踏襲）」と表題のみで、**CSP（vite.config.ts に設定済）に対する Iter6 変更の有無**が要件に触れられていない。新規 GLB は追加しない方針だが、HUD 追加や toast 実装で `style-src 'unsafe-inline'` 等を誤って緩める可能性がある。 | NFR-05 に「本 Iter では CSP ヘッダ（vite.config.ts）を一切緩和しない。`unsafe-inline` / `unsafe-eval` を新規導入しない。インライン `<style>` / `onclick=` 属性を新規追加しない」を明記する。 |
| S-NG-3 | FR-08 | 「取得 toast（画面中央「RIFLE を取得！」等、0.8秒）」は**武器ジャンル名を文字列として表示する**。現状は enum 固定値だが、将来の i18n / 設定画面からのカスタム名対応を見据えると、**表示文字列のエスケープ境界**が要件で定義されていない。`WeaponGenre` enum から人間可読ラベルへの変換テーブルの扱いが不明瞭。 | FR-08 または NFR-05 に「toast / HUD の表示文字列は定数テーブル（i18n 辞書）から引き、動的生成値は数値のみ。文字列は `textContent` に直接代入し、`${}` テンプレートで HTML 断片を組み立てない」を追記する。 |
| S-NG-4 | FR-03 / FR-04 | 武器樽の**残 HP ラベル**とゲートの**効果量ラベル**は「ワールド→スクリーン座標変換でオーバーレイ」と記載。毎フレーム DOM を更新しないために NFR-03 で 30Hz 指定はあるが、**ラベル DOM の生成/破棄ライフサイクル**が要件に無い。長時間プレイで`<div>`が孤立してリーク → 情報漏えいではないが DoS（パフォーマンス低下→フリーズ）の温床。 | FR-07 に「数値ラベル用 DOM は entity 生成時に作成し、entity 破棄時に CleanupSystem が DOM も removeChild する。DOM プールを用いて生成回数を最小化」を明記する。 |
| S-NG-5 | FR-01 / FR-02 | 削除対象（`ItemDropManager` / `POWERUP_DROP_WEIGHTS` 等）に**localStorage キー / セッション永続値が含まれていないか**の言及がない。現行 `ItemType` enum が localStorage のセーブデータに書き込まれていた場合、旧値を持つクライアントでロードエラー/予期せぬ分岐 → クラッシュ経由の情報漏えいリスク。 | FR-02 に「現行 `ItemType` enum 値が localStorage 等の永続ストレージに書き込まれていないことを事前 grep で確認する。書き込みがあれば migration or キー破棄を実施する」を追加する。 |
| S-NG-6 | FR-04 | ゲート効果の「`HEAL`: 防衛ライン HP を回復」で **HP 上限クランプ**は FR-06 で記述されているが、**負値・NaN・Infinity などの異常値防御**が config 側に無い。`gateConfig.ts` を改造された（DevTools / Service Worker 経由）場合に `amount: Infinity` で防衛ライン HP が∞化 → スコア無限化に繋がりうる。 | 付録 config 定義直後に「`amount` は `Number.isFinite(amount) && amount > 0 && amount <= MAX_AMOUNT` で runtime 検証する。検証失敗時はその効果を no-op にする」を追記する。 |
| S-NG-7 | NFR-04 | 「新規実装には Jest テストを用意」と一般論は書かれているが、**セキュリティ観点のテストケース**（`textContent` で入れた文字列が `<script>` としてパースされないことの回帰テスト、`innerHTML` 未使用の Grep 静的検査）が要件に無い。 | NFR-04 に「Jest または ESLint rule で `innerHTML` / `insertAdjacentHTML` / `document.write` の利用を検出するリンタを有効化する。数値ラベル/toast の生成関数に対して `<script>` 含む入力が textContent としてそのまま表示される（=実行されない）回帰テストを 1 件追加する」を加える。 |
| S-NG-8 | FR-07 | 「プレイヤーの現武器ジャンル表示（画面端 HUD、アイコン＋名前）」の**アイコン**について、SVG インライン埋め込みか画像アセットかが未定義。SVG を文字列結合で innerHTML 挿入する実装を誘発しやすい。 | FR-07 に「アイコンは `<img src="/icons/*.png">` もしくは事前定義 `<svg>` を `textContent` ではなく DOM API（`document.createElementNS`）で構築し、文字列結合による SVG 注入を禁止」と明記する。 |
| S-NG-9 | NFR-05 / Open Issues | `console.log` など**情報漏えい経路（開発時ログの本番残存）** について Iter6 の新規実装ぶん（武器取得・ゲート通過・Wave 境目ボーナス等）の扱いが未記載。Iter3 以降の「本番ビルドでは console.log 削除」方針が継承されるかが曖昧。 | NFR-05 に「新規実装の `console.log` / `console.debug` は production ビルド（vite build）で除去されること、`console.error` のみ残す既存方針を継承する」を明記する。 |
| S-NG-10 | FR-05 | 「Wave 境目ボーナス」の発火判定が `WAVE_DEFINITIONS.endTime` ベース（時間軸）で、クライアント側の `performance.now()` / `Date.now()` に依存する。**時刻改変耐性**（DevTools で時計を早送りして強化ゲート連続発動）の防御が要件に無い。単人プレイなのでリスクは低いが、ランキング等の将来拡張を見据えて方針が欲しい。 | FR-05 に「Wave 境目判定はゲーム内 `elapsedTime`（`deltaTime` 累積）で行い、`Date.now()` / `performance.now()` 差分を直接評価しない。将来スコア送信を加える場合は別途サーバ検証を設ける」を追記する。 |

---

## 5. QAエンジニア

### レビュー観点
- 受入基準（AC-01〜AC-05）の検証可能性と測定方法明記の充実度
- 要件の曖昧表現（"微調整" "暫定値" "おおむね" 等）
- エッジケース網羅（同時取得、バフ重複、上限到達、仲間0の時、HP<=0と武器切替が同時、Wave境目同時通過）
- E2E シナリオの網羅性
- パフォーマンス要件の測定方法（「60fps 維持」の具体的測定手段）
- バグ再現の再現性（出現頻度や配置はランダム制御されているか）
- 既存テスト破壊影響の網羅（NFR-01）
- テスト自動化可能性

### OK項目

| # | 対象要件 | OK理由 |
|---|---------|--------|
| Q-OK-1 | AC-01 | 「全 grep で `ItemDropManager` / `determineDrops` / `POWERUP_DROP_WEIGHTS` / `WEAPON_DROP_TYPES` の参照がゼロ」という検索コマンド実行で検証可能な合格条件になっており、自動検証に適している |
| Q-OK-2 | AC-02 / AC-03 | 「15 秒以内に少なくとも 1 個」「10 秒以内に少なくとも 1 個」と時間境界と個数が明記され、Playwright で wait_for による自動判定が可能 |
| Q-OK-3 | AC-04 | Wave 境目の秒数（45/90/180 秒）が具体的に示されており、E2E テストで待機時刻の特定が明確 |
| Q-OK-4 | FR-01 | 削除対象（`ItemDropManager.ts`, `POWERUP_DROP_WEIGHTS`, `WEAPON_DROP_TYPES`, `itemDropRate`, `weaponDropRate`）がファイル名・シンボル名単位で列挙されており、削除漏れが grep ベースで検証できる |
| Q-OK-5 | NFR-01 | Iter5 時点の Jest tests 数（100 tests）という定量基準が明記され、「原則全 PASS を維持」という回帰確認の基準が具体的 |
| Q-OK-6 | FR-06 | バフ重複（残り時間上書きの長い方）・武器切替（常に上書き）・ALLY_ADD 上限 ・HEAL オーバーフロー回避という同時取得/上限エッジケースの方針が書かれており、テストケース設計が可能 |
| Q-OK-7 | 付録 enum/config | `BARREL_HP` / `GATE_EFFECTS` の暫定値がコード付で示されており、ユニットテストのテストデータとして即座に参照可能 |

### NG項目

| # | 対象要件 | NG理由 | 提案 |
|---|---------|--------|------|
| Q-NG-1 | AC-05 / NFR-03 | 「60fps 維持」を Playwright DevTools Performance で確認とあるが、測定時間・サンプル数・許容ドロップ率・「維持」の定義（平均 fps か、1% low か、最低 fps か）が未定義で合否判定が属人化する | 「90 秒連続計測で平均 ≥58fps かつ 5% 以下のフレームで 50fps を下回らない」等の定量基準に変更し、測定スクリプトまたは `browser_evaluate` で `requestAnimationFrame` 間隔を集計する手順を明記 |
| Q-NG-2 | AC-02 | 「15 秒以内に 1 個の樽が流れてくる」を合格判定する際、Math.random を利用したスポーンのランダム性が制御不能だと不安定テストになる。シード固定やデバッグモード（`__SPAWN_FORCE_NEXT=RIFLE`）の記述が全くない | `FR-05` 周辺に「テスト用に PRNG シード固定API または強制スポーン API を提供する」NFR を追加し、AC-02/AC-03/AC-04 の Playwright テストで決定論的にアイテムを発生させられるようにする |
| Q-NG-3 | FR-03 / AC-02 | 「HP 0 で破壊時に武器切替」と「プレイヤー/仲間本体が樽に触れた場合は すり抜け or 同位置で破壊（詳細は Application Design で確定）」が**要件段階で未確定**のまま AC を切っている。本体衝突=破壊のケースで「残HP>0でも武器切替するのか」が曖昧 | FR-03 を「本体衝突時も HP 判定をスキップし即座に武器切替するか、すり抜けのみ（武器切替は射撃による HP 0 のみ）」のいずれかに確定。AC-02 に対応するケース（本体衝突パス）を追加 |
| Q-NG-4 | FR-06 | 「仲間上限（要確認：仮に 20 人）」と具体値が未確定で、上限到達時は「取得しても増えない／取得不可」の**いずれか**と二択が残っている。ALLY_ADD 効果に対する回帰テストが書けない | Iter6 要件段階で上限値と「取得扱い（効果なしで消滅 / ゲート残留）」を確定させ、AC-03 に「ALLY_ADD 上限到達時の扱い」ケースを追加 |
| Q-NG-5 | エッジケース全般 | Wave 境目と通常ランダムが同時発火した場合（同フレームで武器樽 2 個・ゲート 2 個同時スポーンなど）、NFR-03 の「同時表示樽 3 / ゲート 2」上限との関係が記述されていない。上限超過時の優先度（Wave 確定分 vs 通常乱択）も不明 | FR-05 に「Wave 境目確定スポーンは通常キューをスキップして最優先で枠を取る」「上限超過時は古いものを消さず新規をスキップ」等、衝突時の決定論ルールを追加 |
| Q-NG-6 | エッジケース全般 | プレイヤーと仲間が**同一フレームで同じゲートを通過**した場合に効果が二重発火するか、1 ゲート=1 効果かが未定義。ALLY_ADD の場合は特にテスト結果が不安定になる | FR-04 に「1 ゲート = 1 発動。最初に通過したエンティティで発動し、以後は素通り」等のルールを追加。AC-03 に「2 体同時通過で効果は 1 回のみ発動」ケースを追記 |
| Q-NG-7 | FR-06 / エッジケース | 「プレイヤー HP <=0 による GAME OVER と武器切替」「GAME OVER 直後にゲート通過」などの**終端状態との競合**が網羅されていない。NFR-01 の「GAMEOVER 動作する」だけでは不十分 | FR に「GAME_OVER 状態ではアイテム/ゲートのスポーンと発動を停止する」旨を明記、AC に「GAME OVER フラグ後にゲート通過しても効果が発動しないこと」を追加 |
| Q-NG-8 | FR-05 / NFR-03 | 「12〜15 秒間隔」「8〜10 秒間隔」は範囲指定で、範囲内の分布（均等乱択か）・独立タイマーの初期位相・ゲームポーズ時の扱いが不明。パフォーマンス計測時の同時出現数も最悪ケースを定義できない | 分布（均等/正規）、初回スポーンのオフセット（起動何秒後）、ポーズ/設定画面時の停止可否を追記 |
| Q-NG-9 | 曖昧表現 | 「微調整」「暫定値」「おおむね」「主要箇所」「色違い」等の非検証語が多数（FR-03, FR-05, NFR-02, 付録）。特に NFR-02 の「目安」は受入基準と整合しない | AC-05 には「+20KB 以内」と定量化されているので NFR-02 側も「目安」→「必達」に統一。FR-05「主要箇所」は WAVE_SCALING のどの境目かをリストで列挙 |
| Q-NG-10 | AC / テスト戦略 | NFR-04 に「新規実装には Jest テストを用意」とあるが、どのロジック単位にどの粒度のテストを書くかが未定義（例: 武器切替、ゲート通過判定、HP 減算、Wave 境目ボーナス発火）。カバレッジ目標も無い | NFR-04 に「新規追加モジュールのステートメントカバレッジ ≥ 80%」「必須テスト項目リスト: 武器切替/ゲート通過/HP減算/Wave境目」を明記 |
| Q-NG-11 | FR-07 / AC-03 | 「数値表示は大きくはっきり」「フォントサイズは Playwright で調整」は検証不能。ラベルの最小サイズ・最大文字数・DPI 換算の基準がない | 「px 基準で ≥ 20px、1280x720 基準で 画面高 2.8% 以上」等の客観値、およびスクリーンショット比較による回帰手段を明記 |
| Q-NG-12 | AC-01 | 「既存『画面上部から降る SphereGeometry アイテム』は画面に出ない」ことを検証する具体手段が不明。Playwright ではジオメトリレベルの検証ができないので、コード上の削除確認なのか、ゲームプレイ中の観測なのかが不明瞭 | 「`SphereGeometry(0.08,` の grep ゼロ」「Playwright で 120 秒プレイ中にアイテム描画オブジェクトが `ItemBarrelEntity`/`GateEntity` 以外に存在しない（シーン走査で検証）」等、コード側と実行側の両方の検証方法を AC-01 に追加 |
| Q-NG-13 | NFR-01 | 「既存 Jest テスト（100 tests）は破壊的変更で失敗するテストのみ修正」とあるが、**どのテストを破棄・改修したか**の記録要件が無いため回帰の可視性が欠ける | 「修正/削除したテストは PR 本文と CHANGELOG に一覧化する」「Iter5 時点のテスト数→Iter6 時点のテスト数と差分理由を state に明記」を NFR-01 に追加 |
| Q-NG-14 | FR-08 | 「取得 toast 0.8秒」と明示されるが、連続取得（短時間で複数樽破壊）のとき toast の重なり・キューイング・上書き挙動が不明 | 「toast キュー上限=3、同種連続時は残り時間のみ延長」等の方針を記載し、AC に「5 個連続破壊で UI が固まらない」ケース追加 |
| Q-NG-15 | AC-04 | Wave 1→2 境目 45 秒等の具体秒数が書かれているが、`WAVE_DEFINITIONS` の現行実装から導出したものか、仕様で固定したものか不明。Wave の endTime が将来変わった場合 AC が壊れる | 「Wave 境目の時間は `WAVE_DEFINITIONS.endTime` に従う」と定義依存を明記し、AC 側は具体秒数でなく「各 Wave.endTime 直後 1 フレーム以内に確定出現」と抽象化 |

---

## 6. 運用エンジニア

### レビュー観点
- MetricsProbe 等の既存観測基盤（heap5min, Chrome 限定, NFR-07 Iter5）との整合・活用
- webglcontextlost/restored 発生時の新規オブジェクト（樽 GLB clone、ゲート、数値ラベル DOM）復旧責任
- dispose 責任分界（NFR-07 に記載あり）の徹底度
- ロールバック容易性（武器切替・ドロップ削除に対するフィーチャーフラグ）
- 既存 localStorage セーブデータ（設定）との互換性
- バランス調整のイテレーション容易性（config 外部化、Hot-reload）
- 運用中挙動把握のためのログ/テレメトリ（取得ログ、エラー可視化）
- 本番相当環境での検証手順（Playwright シナリオ）の具体性
- 手動デプロイ運用におけるリリースノート/移行手順の明示

### OK項目

| # | 対象要件 | OK理由 |
|---|---------|--------|
| O-OK-1 | NFR-07（メモリ/dispose 責任） | Iter5 で確立した「AssetManager は保持/dispose 禁止、CleanupSystem が entity 所有物を dispose」方針の継承が明記され、かつ「樽上に clone する武器モデルは破壊時に dispose 必要」と新規リスクにも具体的に言及している。運用時のメモリリーク予防として妥当 |
| O-OK-2 | NFR-06（保守性） / 付録の config 定義 | `BARREL_HP` / `GATE_EFFECTS` を `barrelConfig.ts` / `gateConfig.ts` に分離し、Hard-coded 数値を config へ集約する方針。バランス調整のイテレーション容易性が確保され、運用フェーズでの微調整負荷が低い |
| O-OK-3 | NFR-02（バンドルサイズ） / NFR-08（リソース配置） | 新規 GLB 追加なし（既存 guns/*.glb / Crate.glb 流用）、gzip +20KB 以内の具体的な目安値が設定されている。静的ホスティング運用で帯域/CDN コストに直結するバンドル増分の管理として適切 |
| O-OK-4 | NFR-03（パフォーマンス） | 同時表示数（樽3/ゲート2）を明示し 60fps 維持を要求、かつ「数値ラベル更新は 30Hz、毎フレーム DOM 更新を避ける」と運用上の DOM 負荷回避策まで指定している。観測可能な SLI として検証可能 |
| O-OK-5 | NFR-01（互換性・ブレークなし） | Iter5 までの全機能継続動作と Jest 100 tests の原則全 PASS を明記。回帰リスクを封じ込める運用品質ゲートが要件化されている |
| O-OK-6 | FR-05（同時存在数上限） | 「武器樽 3 / ゲート 2」の上限到達時は次回スポーン時刻まで待機と明記。暴走時の CPU/GPU/メモリ安全弁として運用観点で有効 |
| O-OK-7 | NFR-04 / AC-05（テスト） | Jest の新規テスト対象（`ItemBarrelSpawner` / `GateTriggerSystem` / 武器切替）と Playwright シナリオ（取得〜バフ発動）を明示。本番相当環境での検証手順が要件レベルで確保されている |
| O-OK-8 | AC-04（Wave 境目ボーナス） | Wave 1→2 (45秒) / 2→3 (90秒) / 3→4 (180秒) と具体的な秒数で判定条件を検証可能にしている。Playwright で定量的に運用検証できる |

### NG項目

| # | 対象要件 | NG理由 | 提案 |
|---|---------|--------|------|
| O-NG-1 | FR-02 / FR-01（旧 enum・config の削除） | `ItemType` / `ITEM_COLORS` / `itemTypeToBuff` / `itemTypeToWeapon` / `itemDropRate` / `weaponDropRate` の削除が破壊的変更で、既存 localStorage に保存された設定/セーブデータとの互換性影響が言及されていない。古いデータが残った場合の復元で例外発生やクラッシュに至る可能性がある | NFR に「localStorage スキーマ互換要件」を追加。(1) 旧キー/旧 enum 値を読み込んだ場合のフォールバック（無視 or デフォルトへ移行）を明記、(2) 設定 schema に version フィールドを導入、(3) Playwright で「Iter5 データで保存した localStorage を持つブラウザで Iter6 が起動できる」シナリオを AC に追加 |
| O-NG-2 | 全体（ロールバック容易性） | 武器再設計・ドロップ削除・アイテム機構置換という 3 つの破壊的変更を一括で入れるのに、フィーチャーフラグによる段階的ロールアウト/ロールバック戦略が記載されていない。PoC ながら手動デプロイ失敗時の切り戻しコストが高い | NFR に「ロールバック容易性」を追加。`FEATURE_FLAGS.useIter6Items` のような単一フラグで Iter5 旧動作に戻せる構造を要件化。最低限 FR-03/FR-04 のスポーン経路を env or config トグルで切替可能にし、ロールバック手順（リビジョンと切替コマンド）を Acceptance に含める |
| O-NG-3 | FR-03 / FR-04（webglcontextlost/restored 復旧） | 新規の樽（Crate.glb clone + guns/*.glb child）・ゲート（プロシージャル + 3Dテキスト）・HUD 数値ラベル（DOM）は WebGL context lost 時の復旧責任が不明。Iter5 で確立した lost/restored ハンドリングとの整合が明示されていない | NFR-01 もしくは新規 NFR に「context lost/restored 時、in-flight な樽/ゲート entity は破棄して再スポーン待ち、または `AssetManager.reacquire()` で再構築する」方針を明記。Playwright で `WEBGL_lose_context` を利用した AC を追加 |
| O-NG-4 | 運用観測基盤（MetricsProbe 活用） | Iter5 で導入した MetricsProbe（heap5min 差分, Chrome 限定）を Iter6 の新規オブジェクト（樽 clone/gun clone/ゲート/DOM 数値ラベル）の長時間プレイでの累積リークを検出する観点で活用する計画が無い。dispose 漏れが本番で発覚するリスク | NFR-07 に「MetricsProbe で 5 分プレイ時の heap 差分が +10MB 未満」といった定量基準を追加、または Playwright に長時間シナリオを追加して `window.__metricsProbe` の値を assert する AC を設ける |
| O-NG-5 | FR-07（HUD 数値ラベル） / NFR-03 | 樽の残 HP ラベルは「3D 追従 or ワールド→スクリーン変換でオーバーレイ」と選択肢段階、かつ樽3+ゲート2＝最大5個の DOM を 30Hz で更新する形になる。DOM 節点数の暴走時の GC 圧・layout thrashing のリスクと、ラベル要素のプール/再利用戦略が指定されていない | FR-07 または NFR-06 に「数値ラベル DOM はプール方式で再利用、樽/ゲート破棄時に DOM 再利用キューへ戻す」を規定。併せて NFR-03 に「同時ラベル数は最大 5、DOM 追加/削除は破棄/スポーン時のみ、毎フレーム行わない」を明文化 |
| O-NG-6 | 全体（ログ/テレメトリ） | 武器切替・ゲート通過・樽破壊・バフ延長といった運用上のキーイベントを通知する console ログ/構造化ログ方針が無い。不具合再現時の手元デバッグで挙動追跡が困難 | FR または新規 FR に「主要イベント（武器切替、ゲート発動、ALLY_ADD、HEAL、バフ延長、上限到達でのスポーンスキップ）は `console.info` に JSON 形式で 1 行ログを出す」を追加。Playwright の `browser_console_messages` で assert 可能にする |
| O-NG-7 | FR-05（出現頻度） | 「12〜15秒」「8〜10秒」「Wave 境目」等のパラメータが暫定値で、本番運用中に A/B 調整したい場合の手順・URL パラメータ/query string 注入等が未定義。PoC ながら現地調整が重い | NFR-06 に「主要スポーンパラメータは URL query（`?barrelIntervalMin=12`）または `localStorage.debugConfig` で上書き可能」を追加。Application Design で実装確定し AC-02 系で検証する |
| O-NG-8 | AC-02 / AC-03（Playwright シナリオ） | 「15 秒以内に 1 個」「10 秒以内に 1 個」はスポーン確率の上限境界に近く、テストフレーク要因となりうる。加えて 3D 空間での「ゲートを通過した」判定を Playwright からどう検証するかが示されていない | AC-02/03 を「テスト用に決定論モード（seed 固定、即時スポーン flag）を提供し、そのモードで 1 個出現を 1 秒以内に確認」へ改訂。ゲート通過は `window.__gameState` 経由で ally_count / buff_state を assert する手段を明記 |
| O-NG-9 | FR-03（武器樽 CollisionSystem 流用） | 「現行弾丸↔敵の判定を流用」と書かれているが、樽は敵レーンを流れる新 entity であり、弾丸命中判定のレイヤ/グループ（Collision Mask）が既存敵と衝突して誤検知するリスクが評価されていない | FR-03 または Open Issues に「衝突レイヤ分離（BULLET↔BARREL, BULLET↔ENEMY, BODY↔GATE）を明示し、誤検知ゼロを AC 化」を追加。Playwright で「敵と樽が重なる位置にあるとき弾丸が意図通り樽/敵いずれかに当たる」を検証 |
| O-NG-10 | NFR-03（パフォーマンス計測） | 「60fps 維持」を Playwright DevTools Performance で計測と書かれているが、閾値（例: 5s 平均 58fps 以上、P99 16.6ms 以下）や計測時間長、計測シナリオ（最大同時表示時）が未定義で運用検証が曖昧 | NFR-03 を「30 秒計測で平均 fps >= 58、1% low >= 50、最大同時表示状態（樽3+ゲート2+敵ピーク）で測定」と具体化し、Playwright 実行スクリプトを参照付きで指定 |
| O-NG-11 | リリース手順（手動デプロイ） | PoC・手動デプロイ前提にも関わらず、破壊的変更を含む Iter6 のリリース手順（事前バックアップ、動作確認チェックリスト、ロールバック対象のリビジョン特定）が Acceptance / 運用手順として要件化されていない | 受入基準に「RELEASE.md（または docs 内）に Iter6 リリース手順とロールバック手順を用意」を 1 条追加。少なくとも「Iter5 タグ `iter5-final` にタグ打ち、Iter6 は `iter6-items` タグで差分切替」を明記 |

---

## レビュー結果サマリー

### 集計

| ロール | OK | NG | 前回比OK | 前回比NG |
|--------|----|----|---------|---------|
| フロントエンド開発者 | 8 | 12 | 初回 | 初回 |
| バックエンド開発者 | 7 | 12 | 初回 | 初回 |
| AWSインフラエンジニア | 7 | 9 | 初回 | 初回 |
| セキュリティエンジニア | 8 | 10 | 初回 | 初回 |
| QAエンジニア | 7 | 15 | 初回 | 初回 |
| 運用エンジニア | 8 | 11 | 初回 | 初回 |
| **合計** | **45** | **69** | 初回 | 初回 |

### 重大度別集計

| 重大度 | 件数 | 該当項目 |
|--------|------|----------|
| **重大（アーキテクチャ変更が必要）** | 4 | F-NG-4（ゲート通過UX仕様曖昧）、B-NG-1（旧 WeaponType 移行戦略）、Q-NG-1（60fps 測定基準）、Q-NG-2（ランダム制御不能→不安定テスト） |
| **重要（要件追加・修正が必要）** | 18 | F-NG-1（数値ラベル方式未確定）、F-NG-2（武器ジャンル HUD 未定義）、F-NG-3（バフ残り時間可視化欠落）、B-NG-2（武器切替時既発射弾丸）、B-NG-4（ゲート通過検知曖昧）、B-NG-8（プレイヤー↔樽衝突未決）、I-NG-1（bundle size 根拠）、I-NG-2（60fps 計測条件）、I-NG-3（同時 mesh/draw call 見積）、I-NG-5（dispose 責任詳細）、S-NG-2（CSP 明記なし）、Q-NG-3（本体衝突パス未確定）、Q-NG-4（ALLY_ADD 上限未確定）、Q-NG-5（Wave × 上限衝突）、Q-NG-6（同時通過仕様）、O-NG-1（localStorage 互換）、O-NG-3（webglcontextlost 復旧）、O-NG-4（MetricsProbe 活用） |
| **中（設計フェーズで明確化が必要）** | 31 | F-NG-5, F-NG-6, F-NG-7, F-NG-8, F-NG-10, B-NG-3, B-NG-5, B-NG-6, B-NG-7, B-NG-11, B-NG-12, I-NG-4, I-NG-6, I-NG-9, S-NG-1, S-NG-3, S-NG-4, S-NG-5, S-NG-7, Q-NG-7, Q-NG-8, Q-NG-9, Q-NG-10, Q-NG-11, Q-NG-12, O-NG-2, O-NG-5, O-NG-6, O-NG-8, O-NG-9 |
| **軽微（推奨事項）** | 16 | F-NG-9, F-NG-11, F-NG-12, B-NG-10, I-NG-7, I-NG-8, S-NG-6, S-NG-8, S-NG-9, S-NG-10, Q-NG-13, Q-NG-14, Q-NG-15, O-NG-7, O-NG-10, O-NG-11 |

### ロール間合意ポイント（矛盾なし、複数ロールで同一方向の指摘）

| トピック | 該当 NG |
|---------|---------|
| 数値ラベル表示方式の未確定 | F-NG-1, I-NG-3, I-NG-7, O-NG-5 |
| 60fps 計測条件の未定義 | Q-NG-1, I-NG-2, O-NG-10 |
| ゲート通過判定仕様の曖昧 | F-NG-4, B-NG-4, Q-NG-6 |
| 武器樽と本体の衝突仕様 | B-NG-8, Q-NG-3, O-NG-9 |
| 旧 enum/localStorage 互換 | S-NG-5, O-NG-1 |
| 武器切替時の既発射弾丸 | B-NG-2（単独だが要件レベルでの確定要望） |
| ALLY_ADD 上限未確定 | B-NG-5, Q-NG-4, F-NG-7 |
| dispose 責任の詳細化 | F-NG-10, I-NG-5, S-NG-4 |

### 重大・重要項目の対応推奨

| 優先度 | NG項目 | 内容 | 推奨対応タイミング |
|--------|--------|------|-------------------|
| 1 | B-NG-1 | 旧 WeaponType → WeaponGenre 移行戦略を要件レベルで確定 | 要件修正（本 Iter 中） |
| 1 | F-NG-4 / B-NG-4 / Q-NG-6 | ゲート通過判定（1 ゲート=1 回、X幅判定、consumed フラグ）を FR-04 で確定 | 要件修正（本 Iter 中） |
| 1 | Q-NG-1 / I-NG-2 / O-NG-10 | 60fps 測定条件（計測時間・p% 閾値）を NFR-03 で定量化 | 要件修正（本 Iter 中） |
| 1 | Q-NG-2 | 決定論スポーン（シード固定 / 強制スポーン API）を NFR に追加 | 要件修正（本 Iter 中） |
| 2 | F-NG-1 / I-NG-3 / O-NG-5 | 数値ラベル方式を HTMLOverlayManager DOM に一本化 | 要件修正（本 Iter 中） |
| 2 | B-NG-2 | 武器切替時の既発射弾丸継続ルールを FR-06 で既定化 | 要件修正（本 Iter 中） |
| 2 | B-NG-8 / Q-NG-3 / O-NG-9 | プレイヤー/仲間↔樽の衝突レイヤ分離と挙動（すり抜け）を FR-03 で確定 | 要件修正（本 Iter 中） |
| 2 | B-NG-5 / Q-NG-4 / F-NG-7 | ALLY_ADD 上限到達時の挙動（no-op + toast 表示）を FR-06/FR-08 で単一化 | 要件修正（本 Iter 中） |
| 3 | O-NG-1 / S-NG-5 | localStorage 旧キー互換性（grep 確認 + migration 要否）を FR-02 に追加 | 要件修正（本 Iter 中） |
| 3 | F-NG-2, F-NG-3 | 武器ジャンル HUD / バフ残り時間可視化の追加 | 要件修正（本 Iter 中） |
| 3 | I-NG-1 / I-NG-5 | bundle size 根拠と dispose 責任詳細化 | 要件修正（本 Iter 中） |
| 3 | S-NG-2 | CSP 不緩和方針の明記 | 要件修正（本 Iter 中） |
| 3 | O-NG-3 | webglcontextlost/restored 復旧責任の明記 | 要件修正（本 Iter 中） |
| 3 | O-NG-4 | MetricsProbe 活用（heap 差分基準）の追加 | 要件修正（本 Iter 中） |
