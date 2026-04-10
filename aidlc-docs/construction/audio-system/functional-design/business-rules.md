# ビジネスルール定義 — Unit-01: サウンドシステム

## 概要
サウンドシステムの制約条件、バリデーションロジック、動作ルールを定義する。

---

## 1. AudioContext管理ルール

### BR-AU01: 遅延初期化（モバイル対応）
- AudioContextはユーザーの最初のインタラクション（タップ/クリック）後に初期化する
- ブラウザの自動再生ポリシー（Autoplay Policy）に準拠
- 初期化前はすべてのplaySE()/playBGM()呼び出しを無視する（エラーにはしない）
- 初期化方法: `resumeContext()`をユーザーインタラクションイベント内で呼び出し

### BR-AU02: AudioContext状態管理
- `context.state === 'suspended'` の場合は `context.resume()` を呼び出す
- `context.state === 'running'` の場合のみ音声再生を実行
- `context.state === 'closed'` の場合は再初期化を試みない（リロード必要）
- playBGM()/playSE()の冒頭で `context.state === 'closed'` をガードし、即座にreturnする

### BR-AU03: リソース解放
- ゲームリセット時にアクティブなSEを全て停止（OscillatorNode.stop() + GainNode.disconnect()）
- BGMは停止してオシレーターを解放
- AudioContext自体は再利用（closeしない）

### BR-AU04: エラーハンドリング（グレースフルデグラデーション）
- `resumeContext()`内の`new AudioContext()`と`context.resume()`をtry-catchで囲む
- AudioContext生成失敗時: `initialized = false`のまま維持、ゲームは無音で続行
- ブラウザがWeb Audio API非対応の場合: `typeof AudioContext === 'undefined'`チェックで早期return
- 上流NFR-08の方針「アセット読み込み失敗: プレースホルダーで代替、ゲーム続行」と整合

### BR-AU05: CSP整合性
- 本設計はOscillatorNode/GainNode等の基本Web Audio APIノードのみを使用し、AudioWorkletや外部オーディオファイルのfetchを行わない
- そのため現行CSPポリシー（`default-src 'self'; connect-src 'none'`）と互換
- 将来オーディオファイル読み込みに拡張する場合はCSPの`media-src`更新が必要

---

## 2. BGMルール

### BR-BGM01: シーン別BGM
| シーン | テンポ(BPM) | 波形 | ループ | 特徴 |
|--------|-----------|------|--------|------|
| title | 120 | square + triangle | Yes | 軽快で明るいメロディ |
| playing | 150 | square + sawtooth + triangle | Yes | テンポが速い戦闘感 |
| gameover | 80 | triangle | No（1回再生） | 短い下降フレーズ（2小節） |

### BR-BGM02: BGM切り替え
- GameState変更時に対応するBGMに切り替え
- 切り替え時は現在のBGMをフェードアウト（0.3秒）→ 新BGMを即再生
- 同じシーンのBGMが既に再生中の場合は何もしない
- フェードアウト中に新しいplayBGM()が呼ばれた場合: 旧フェードタイマーをclearTimeoutし即座に新BGMを開始

### BR-BGM03: BGM音量制御
- 範囲: 0.0〜1.0（設定画面UIでは0〜100にマッピング）
- リアルタイム反映（GainNodeのvalue変更）
- デフォルト: 0.7

### BR-BGM04: BGMフェードアウト
- stopBGM()またはBGM切り替え時に0.3秒でフェードアウト
- フェード完了後にオシレーターを停止・解放
- フェードタイマーIDをAudioManager.fadeTimerIdに保持し、競合防止

### BR-BGM05: BGMスケジューリング方式（lookaheadパターン）
- setTimeoutではなく、Web Audio APIの`OscillatorNode.start(when)`の`when`パラメータに`context.currentTime`基準の絶対時間を指定する先読みスケジューリングを採用
- lookahead間隔: setIntervalで100msごとにスケジューラを起動
- バッファ時間: 200ms先までのノートを事前にスケジュール
- 理由: setTimeoutはイベントループの精度制約（±数十ms）とバックグラウンドタブのスロットリング（最低1秒間隔）があり、正確なリズム再生に不適

### BR-BGM06: 非ループBGMの終了処理
- 非ループBGM（gameover）は全チャンネルの最終ノート再生完了後に`isPlaying = false`を設定
- 終了検知: 全チャンネルの最終ノートのスケジュール完了時にsetTimeoutで`isPlaying = false`を設定

### BR-BGM07: タブ非アクティブ時のBGM
- `document.visibilitychange`イベントでタブ非アクティブを検知
- 非アクティブ時: BGMを一時停止（lookaheadタイマーを停止、AudioContextのsuspend()は任意）
- アクティブ復帰時: BGMを再開（lookaheadタイマーを再開、context.currentTimeから再スケジュール）

---

## 3. SE（効果音）ルール

### BR-SE01: SE定義一覧
| SEタイプ | 音の特徴 | 長さ(秒) | 同時上限 | クールダウン(秒) | OscNode数/回 |
|----------|---------|---------|---------|-----------------|-------------|
| shoot | 高音の短いパルス (square波, 880Hz→440Hz) | 0.05 | 3 | 0.1 | 1 |
| enemy_destroy | 低音ノイズ+下降音 (sawtooth波, 200Hz→50Hz) | 0.2 | 4 | 0 | 1 |
| item_destroy | 上昇音 (sine波, 523Hz→1047Hz) | 0.15 | 2 | 0 | 1 |
| buff_activate | キラキラ上昇アルペジオ (sine波, C5→E5→G5→C6) | 0.4 | 1 | 0 | 4 |
| ally_convert | 短いファンファーレ (triangle波, C4→E4→G4) | 0.5 | 1 | 0 | 3 |
| boss_spawn | 低音警告音 (sawtooth波, 80Hz, ビブラート付き) | 1.0 | 1 | 0 | 2 |
| defense_breach | ダメージ音 (square波, 150Hz→80Hz + ノイズ) | 0.3 | 2 | 0 | 1 |

**用語変更**: 旧`item_collect`→`item_destroy`に改名。アイテムは弾丸射撃で破壊して効果を得る仕様のため「破壊音」が正確。

### BR-SE02: 同時再生制限
- 各SEタイプごとに同時再生チャンネル上限を設定（BR-SE01参照）
- 上限到達時: 新しいSE再生リクエストを無視
- チャンネルは再生完了後（onendedイベント）に自動で再利用可能になる

### BR-SE03: 射撃SE間引き
- プレイヤーの射撃SE: クールダウン0.1秒（0.15秒間隔の射撃で2回に1回程度鳴る）
- 仲間の射撃SE: クールダウン0.2秒＋音量50%（仲間の射撃音は控えめ）
- **クールダウンはプレイヤーと仲間で独立管理**: seCooldownsのキーを`'shoot'`(プレイヤー) / `'shoot_ally'`(仲間)で分離し、相互にブロックしない

### BR-SE04: SE音量制御
- 範囲: 0.0〜1.0（設定画面UIでは0〜100にマッピング）
- リアルタイム反映（SE再生時のGainNode値に適用）
- デフォルト: 0.8
- 仲間射撃音の音量 = seVolume × 0.5

### BR-SE05: SEクリーンアップ
- **主要解放パス**: OscillatorNodeのonendedイベントで`channel.isPlaying = false`、`gainNode.disconnect()`、activeOscillatorCountを減算
- **安全策**: setTimeoutによるフォールバック解放（onendedが発火しないケースに備える）
- ゲームリセット時に全アクティブSEのOscillatorNode.stop() + GainNode.disconnect()を実行
- generator関数はOscillatorNode参照の配列を返し、SEChannelで保持する

---

## 4. イベント→SE マッピングルール

### BR-EV01: 各Systemからのトリガーポイント
| ゲームイベント | トリガー元 | SEタイプ | 備考 |
|--------------|-----------|---------|------|
| プレイヤー射撃 | WeaponSystem | shoot | クールダウン0.1秒、プレイヤー音量 |
| 仲間射撃 | WeaponSystem | shoot | クールダウン0.2秒、音量50%、キー'shoot_ally' |
| 敵撃破 | CollisionSystem | enemy_destroy | 撃破キュー処理時 |
| アイテム破壊 | CollisionSystem | item_destroy | アイテム破壊キュー処理時（弾丸射撃でアイテムを破壊する仕様） |
| バフ適用 | CollisionSystem | buff_activate | バフ適用処理時 |
| 仲間化成功 | AllyConversionSystem | ally_convert | 仲間化判定成功時 |
| ボス出現 | SpawnManager | boss_spawn | ボスエンティティ生成時 |
| 防衛ライン突破 | DefenseLineSystem | defense_breach | HP減少処理時 |
| GameState→TITLE | GameService | BGM: title | changeState呼び出し時 |
| GameState→PLAYING | GameService | BGM: playing | startPlaying()時 |
| GameState→GAME_OVER | GameService | BGM: gameover | HP 0判定時 |

### BR-EV02: プレイヤーと仲間の射撃音区別
- WeaponSystemは弾丸生成時にownerId（発射元エンティティID）を持つ
- AudioManager.playSE()に `isAlly: boolean` パラメータを追加
- isAlly=true の場合: クールダウンキー`'shoot_ally'`（0.2秒）、音量50%を適用
- isAlly=false の場合: クールダウンキー`'shoot'`（0.1秒）、通常音量を適用

---

## 5. パフォーマンスルール

### BR-PERF01: OscillatorNode数ハードリミット
- **ハードリミット**: 同時アクティブOscillatorNode数 最大20個
- 内訳:
  - BGM: 最大4ノード（メロディ+ベース+リズム+パーカッション）
  - SE: 最大16ノード（OscNode数/回 × maxConcurrent の合計: 3+4+2+4+3+2+2=20、BGMとの同時発火で超過可能性あり）
- **グローバルカウンタ**: AudioManager.activeOscillatorCountでアクティブノード数を追跡
  - ノード生成時: +oscillatorCount
  - ノード終了時（onended）: -oscillatorCount
- **上限超過時**: SE再生をスキップ（BGMは優先、SEのみ制限）

### BR-PERF02: GC回避
- OscillatorNodeは`stop()`後に再利用不可のため、再生ごとに新規生成→停止→解放
- GainNodeは再利用可能なためプールで管理（SEチャンネル用）
- 毎フレームのノード生成を避けるためクールダウン（BR-SE03）が有効に機能

---

## 6. パラメータ外部設定化ルール

### BR-ACFG01: audioConfig
- 以下のパラメータを`audioConfig.ts`で外部化:
  - SE定義（周波数、長さ、同時上限、クールダウン、OscNode数/回）
  - BGMテンポ、楽曲データ
  - デフォルト音量値
  - フェードアウト時間
  - 仲間射撃音の音量比率
  - lookahead間隔、バッファ時間

### BR-ACFG02: audioConfigバリデーション
- 起動時にバリデーションを実行し、不正値はWARNログ+デフォルト値フォールバック:
  - volume: 0.0〜1.0
  - cooldown >= 0
  - maxConcurrent >= 1
  - duration > 0
  - tempo > 0
  - oscillatorCount >= 1

---

## 7. ログ出力ルール

### BR-LOG01: オーディオシステムのログ設計
上流services.mdのLogger（DEBUG/INFO/WARN/ERROR）に準拠:

| イベント | レベル | メッセージ例 |
|---------|--------|------------|
| AudioContext初期化成功 | INFO | `[AudioManager] AudioContext initialized` |
| AudioContext生成失敗 | ERROR | `[AudioManager] Failed to create AudioContext: {error}` |
| Web Audio API非対応 | WARN | `[AudioManager] Web Audio API not supported, running silent` |
| BGM切替 | INFO | `[AudioManager] BGM changed: {oldScene} -> {newScene}` |
| SEクールダウンスキップ | DEBUG | `[AudioManager] SE skipped: type={type}, reason=cooldown` |
| SE同時上限スキップ | DEBUG | `[AudioManager] SE skipped: type={type}, reason=maxConcurrent` |
| OscillatorNodeハードリミット | WARN | `[AudioManager] OscillatorNode hard limit reached: {count}/{max}` |
| audioConfig不正値 | WARN | `[AudioManager] Invalid config value: {key}={value}, using default` |

### BR-LOG02: デバッグ診断API
- 開発環境向けに`getAudioDebugInfo()`メソッドを提供:
  - 戻り値: `{ contextState, initialized, currentScene, bgmPlaying, activeSEChannels: Map<SEType, number>, activeOscillatorCount }`
  - 本番ビルドではTree-shaking or DEVガードで除去可能

---

## 8. ルール間の依存関係

```
BR-AU01 (遅延初期化) → BR-BGM02 (BGM切替) ← GameState変更
BR-AU01 (遅延初期化) → BR-SE02 (SE再生) ← 各System
BR-AU04 (エラーハンドリング) → BR-AU01 (初期化時のtry-catch)
BR-SE03 (射撃間引き) ← BR-EV02 (プレイヤー/仲間区別・独立クールダウン)
BR-SE04 (SE音量) ← Unit-02: 設定画面の音量スライダー
BR-BGM03 (BGM音量) ← Unit-02: 設定画面の音量スライダー
BR-PERF01 (ノードハードリミット) ← BR-SE02 (同時再生制限) + activeOscillatorCount
BR-BGM05 (lookahead) ← BR-BGM07 (タブ非アクティブ停止)
BR-ACFG02 (バリデーション) ← BR-LOG01 (WARNログ出力)
```
