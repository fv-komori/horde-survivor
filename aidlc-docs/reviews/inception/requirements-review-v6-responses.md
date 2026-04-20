# 要件定義書 レビュー対応記録（第1回、Iter6）

**対応日**: 2026-04-20
**対応者**: ユーザー + Claude
**対応元レビュー**: `reviews/inception/requirements-review-v6.md`
**編集対象**: `inception/requirements/requirements-v6.md`

## 対応結果

### 重大（4 件）

| # | NG-ID | 対応方針 | 対応内容 |
|---|-------|----------|---------|
| 1 | F-NG-4 | 修正済み（変形版） | FR-04 に「**プレイヤーのみ通過で発動**、効果は全仲間/対象に連動適用、仲間単独通過はスルー（ゲートは消滅しない）、1 ゲート=1 回発動、consumed フラグで消滅」を明記 |
| 2 | B-NG-1 | 修正済み | FR-02 + 武器再設計節 + AC-05 に「旧 `WeaponType` は削除し `WeaponGenre` に一本化、互換維持なし」を明記 |
| 3 | Q-NG-1 | 修正済み | NFR-03 に「viewport 1280x720、90 秒連続計測、rAF ベースで平均 ≥58fps、5% 以下で 50fps 下回り禁止」を定量化、AC-05 と同期 |
| 4 | Q-NG-2 | 修正済み | NFR-11 新設: PRNG シード固定 API、強制スポーン API、`window.__gameState` assert API を定義 |

### 重要（18 件）

| # | NG-ID | 対応方針 | 対応内容 |
|---|-------|----------|---------|
| 5 | F-NG-1 | 修正済み | FR-07: HTMLOverlayManager DOM オーバーレイに一本化（Sprite/CanvasTexture は不採用） |
| 6 | F-NG-2 | 修正済み | FR-07: 画面左下固定、0.3 秒切替フラッシュ、トーストと役割分離（HUD=常時表示、トースト=瞬間演出） |
| 7 | F-NG-3 | 修正済み | FR-07: アクティブバフアイコン列、残り時間カウントダウン、2〜3 枠 |
| 8 | B-NG-2 | 修正済み | FR-06 + 武器再設計節: 既発射弾丸は発射時パラメータで継続 |
| 9 | B-NG-4 | 修正済み | FR-04: 符号変化で 1 回発火、`consumed=true` フラグで消滅、次フレームの CleanupSystem で破棄 |
| 10 | B-NG-8 | 修正済み | FR-03: プレイヤー/仲間 × 樽はすり抜け、衝突レイヤ `BULLET↔BARREL/ENEMY`, `BODY↔GATE=なし` を明示 |
| 11 | I-NG-1 | 修正済み | NFR-02: gzip 内訳管理（新規+削除+config）+ `size-limit` CI 検証 + 絶対値 ≦215KB チェック |
| 12 | I-NG-2 | 統合（Q-NG-1） | 同上（Q-NG-1 と統合） |
| 13 | I-NG-3 | 修正済み | NFR-03: mesh 総数 ≦80、draw call ≦60 の目安を記載、最悪ケース（3樽+2ゲート+30敵+20仲間）を明記 |
| 14 | I-NG-5 | 修正済み | NFR-07: dispose 責任表を新規追加（樽本体 / 武器モデル所有権移譲 / ゲート / HUD DOM / texture / template） |
| 15 | S-NG-2 | 修正済み | NFR-05: CSP 不緩和（`unsafe-inline`/`unsafe-eval` 新規導入禁止、インライン style/onclick 禁止） |
| 16 | Q-NG-3 | 統合（B-NG-8） | 同上 |
| 17 | Q-NG-4 | 修正済み | FR-06: 仲間上限 `GAME_CONFIG.ally.maxCount = 10` 既存維持、到達時は no-op + 通過 toast + 「MAX」代替表示 |
| 18 | Q-NG-5 | 修正済み | FR-05: Wave 境目確定スポーンは最優先、上限 +1 を例外許容 |
| 19 | Q-NG-6 | 統合（F-NG-4） | AC-03 に「仲間のみ通過は発動しない」「同時通過でも 1 回のみ発動」を追加 |
| 20 | O-NG-1 | 軽量版（対応不要ベース + grep 追記） | 開発段階のためローカル localStorage 削除で足りる運用。FR-02 に「旧 ItemType/WeaponType の localStorage 書き込みを事前 grep 確認」を追記（S-NG-5 と統合） |
| 21 | O-NG-3 | 修正済み | NFR-01: context lost/restored 時の樽/ゲート破棄・再スポーン方針、AssetManager.restoreTextures の範囲拡大、AC-06 新設 |
| 22 | O-NG-4 | 修正済み | NFR-07: MetricsProbe 5 分プレイで heap +10MB 未満基準、AC-07 新設（ロングシナリオ） |

### 中（31 件）

| # | NG-ID | 対応方針 | 対応内容 |
|---|-------|----------|---------|
| 23 | F-NG-5 | 修正済み | FR-03: ラベルは樽の bounding box 上辺より上方（武器モデルの上）に配置、ダメージ時に色フラッシュ |
| 24 | F-NG-6 | 修正済み | FR-05/FR-08: Wave 境目ボーナスにリング発光・BONUS ラベル・Wave 遷移トースト |
| 25 | F-NG-7 | 修正済み | FR-06/FR-08: ALLY_ADD 上限到達 / HEAL HP 満タン時は「MAX」代替トースト |
| 26 | F-NG-8 | 修正済み | FR-07: ASCII 画面レイアウトマップ + z-index レイヤ + レスポンシブ最小サイズ（640x360）を明記 |
| 27 | F-NG-10 | 統合（I-NG-5） | dispose 責任表に cloned material 記載、NFR-04 に cloned material リークチェックテスト追加 |
| 28 | B-NG-3 | 修正済み | `BARREL_HP` の型を `{ baseHp; waveScale? }` に拡張、Iter6 は waveScale=1 固定、将来余地を残す |
| 29 | B-NG-5 | 統合（Q-NG-4） | 同上 |
| 30 | B-NG-6 | 修正済み | FR-06: HEAL 対象 = `DefenseLineComponent.hp`、`min(hp + amount, maxHp)` でクランプ |
| 31 | B-NG-7 | 修正済み | FR-05: Wave 45s/90s/180s の 3 点確定、WAVE_SCALING 30s 境目は Iter6 スコープ外、将来調整余地を明記 |
| 32 | B-NG-9 | 修正済み | `GATE_EFFECTS` に `unit: 'percent' \| 'flat' \| 'count'` を追加、型を明確化 |
| 33 | B-NG-11 | 修正済み | FR-03: CollisionSystem 拡張（HP 判定）+ 新規 `WeaponSwitchSystem`（副作用）を System 責務分担 |
| 34 | B-NG-12 | 修正済み | NFR-01: 旧テスト置換方針、修正/削除テストを PR/CHANGELOG に一覧化、総数見積りは Application Design で |
| 35 | I-NG-4 | 修正済み | NFR-08: material clone 時は `material.color` のみ変更、`onBeforeCompile` 追加禁止、`renderer.info.programs.length` が Iter5 比増加しないことを AC-05 に |
| 36 | I-NG-6 | 修正済み | NFR-10 新設: キャッシュ戦略（v1/ 維持、GLB 追加なし、将来追加時は v2/ へ） |
| 37 | I-NG-9 | 統合（I-NG-1） | AC-05 の `size-limit` CI 化で合否判定プロセスを明示 |
| 38 | S-NG-1 | 修正済み | NFR-05: 禁止 API リスト（`innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`/`eval`/`new Function`）+ `Number(x).toString()` ルール |
| 39 | S-NG-3 | 修正済み | FR-08/NFR-05: i18n 辞書経由、動的値は数値のみ、テンプレートリテラルで HTML 構築禁止 |
| 40 | S-NG-4 | 統合（I-NG-5 + S-NG-1） | FR-07 の DOM ライフサイクル + 固定プール方式に統合 |
| 41 | S-NG-5 | 統合（O-NG-1） | FR-02 に「旧 enum の localStorage 書き込み grep 確認」を追記 |
| 42 | S-NG-7 | 修正済み | NFR-04: ESLint リンタ有効化（`no-restricted-syntax` 拡張）+ XSS 回帰テスト 1 件 |
| 43 | Q-NG-7 | 修正済み | FR-05/FR-06 + AC-08: GAME_OVER 時のスポーン・発動停止 |
| 44 | Q-NG-8 | 修正済み | FR-05: 均等乱択、独立タイマー、初期オフセット（武器12s/ゲート8s）、ポーズ/設定画面時停止 |
| 45 | Q-NG-9 | 修正済み | NFR-02「目安」→「必達」、FR-05 の「主要箇所」→ 具体 3 点列挙、曖昧表現整理 |
| 46 | Q-NG-10 | 修正済み | NFR-04: カバレッジ ≥80%、必須テスト項目リスト（武器切替/ゲート通過/HP 減算/Wave 境目/cloned material/XSS 回帰） |
| 47 | Q-NG-11 | 修正済み | FR-07: 既存 HUD サイズ系列、最小 20px、画面高 2.8% 以上 |
| 48 | Q-NG-12 | 修正済み | AC-01: コード grep（`SphereGeometry(0.08,` 等）+ Playwright シーン走査の 2 段構え検証 |
| 49 | O-NG-2 | 対応不要 | 開発段階・PoC・PR ごとに git revert で戻せるため、フィーチャーフラグは導入しない |
| 50 | O-NG-5 | 対応不要 | F-NG-1/I-NG-5/S-NG-4 で対応済み（方式一本化 + DOM プール化） |
| 51 | O-NG-6 | 修正済み | FR-09 新設: 主要イベントを `console.info` に JSON 1 行ログ、本番ビルドで除去 |
| 52 | O-NG-8 | 統合（Q-NG-2） | AC-02/03 を決定論モード 1 秒以内に改訂、`window.__gameState` で assert |
| 53 | O-NG-9 | 統合（B-NG-8） | FR-03 に衝突レイヤ分離を明示、AC-02 に「敵と樽が重なる位置での誤検知ゼロ」追加 |

### 軽微（16 件）

| # | NG-ID | 対応方針 | 対応内容 |
|---|-------|----------|---------|
| 54 | F-NG-9 | 修正済み | FR-07: HTMLOverlayManager が内部 33ms スロットリング |
| 55 | F-NG-11 | 修正済み | FR-08: トースト同時 1 件、FIFO キュー上限 3、0.8 秒順次表示、同種連続は延長 |
| 56 | F-NG-12 | 修正済み | AC-03: 効果量ラベルが画面上 20px 以上で描画、getBoundingClientRect 検証 |
| 57 | B-NG-10 | 修正済み | FR-07: 樽 HP 0 の当該フレームでラベル即非表示・toast 即発火（30Hz 間引き対象外） |
| 58 | I-NG-7 | 統合（I-NG-5/S-NG-4） | FR-07: 固定プール方式（最大 6 スロット）、画面外 `visibility:hidden` |
| 59 | I-NG-8 | 修正済み | FR-08: エフェクト最大数規定、pool 超過時は古いものから破棄、toast 同時 1 件 |
| 60 | S-NG-6 | 修正済み | 付録 config 節: runtime 検証 `Number.isFinite(amount) && amount > 0 && amount <= MAX_AMOUNT`、失敗時 no-op |
| 61 | S-NG-8 | 修正済み | FR-07: アイコンは `<img>` か `createElementNS` で構築、文字列結合禁止 |
| 62 | S-NG-9 | 修正済み | NFR-05/FR-09: `console.log`/`console.debug` は production ビルド除去、`console.error` のみ残す |
| 63 | S-NG-10 | 修正済み | FR-05: Wave 境目判定はゲーム内 `elapsedTime` ベース、`Date.now()` / `performance.now()` 差分は使わない |
| 64 | Q-NG-13 | 修正済み | NFR-01: 修正/削除テストを PR 本文と CHANGELOG に一覧化 |
| 65 | Q-NG-14 | 統合（F-NG-11） | FR-08 に連続取得時のキュー挙動を明記 |
| 66 | Q-NG-15 | 統合（B-NG-7） | AC-04 で `WAVE_DEFINITIONS.endTime` 依存を明記、45/90/180s は現行値から導出 |
| 67 | O-NG-7 | 修正済み | FR-09/NFR-06: URL query（`?barrelIntervalMin=12`）or `localStorage.debugConfig` で上書き可 |
| 68 | O-NG-10 | 統合（Q-NG-1/I-NG-2） | NFR-03/AC-05 の fps 計測条件に統合 |
| 69 | O-NG-11 | 対応不要（※軽微で一括対応方針ではあるが該当なし） | 要件書には加えず、実装完了後の PR/リリース作業で対応（RELEASE.md は Construction 段階で検討） |

## 集計

- **修正済み**: 64 件（うち統合扱い 10 件）
- **対応不要**: 2 件（O-NG-2, O-NG-5）
- **保留（後で検討）**: 0 件
- **※ O-NG-11 は実装段階対応のため要件書改訂対象外**（集計上は「対応不要（修正不要）」として処理）

## 主な新設セクション

- **FR-09**: 運用ログ・パラメータ上書き（新規）
- **NFR-10**: キャッシュ戦略（新規）
- **NFR-11**: テスト決定論性（新規）
- **AC-06**: WebGL context lost/restored 対応（新規）
- **AC-07**: メモリリーク検証（新規）
- **AC-08**: GAME_OVER 時の発動停止（新規）

## 次のアクション

Application Design の開始。Open Issues に残された事項（レーン幅、パーティクル上限具体値、console.info の production 除去方針、HP/効果量バランス）を設計段階で確定する。
