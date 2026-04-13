# Code Generation Plan — Unit-01: サウンドシステム

**作成日**: 2026-04-10
**対象Unit**: Unit-01（サウンドシステム）
**プロジェクトタイプ**: Brownfield
**ワークスペースルート**: /Users/komori/fv-genai-specialforce/fv-game

---

## 概要

Web Audio APIを使用したBGM・効果音システムをコードのみで実装する。
FDで定義したドメインエンティティ・ビジネスルール・ビジネスロジックモデルに準拠。

---

## ファイル計画

### 新規作成ファイル
| # | ファイルパス | 責務 |
|---|------------|------|
| 1 | src/config/audioConfig.ts | SE/BGM定義データ、パラメータ定数 |
| 2 | src/audio/SoundGenerator.ts | SE音生成関数群（generator関数） |
| 3 | src/audio/BGMGenerator.ts | BGM楽曲データ定義（NoteSequence） |
| 4 | src/audio/AudioManager.ts | サウンド管理メインクラス（BGM/SE再生・停止・音量） |

### 既存変更ファイル
| # | ファイルパス | 変更内容 |
|---|------------|---------|
| 5 | src/input/InputHandler.ts | 初回インタラクションコールバック追加 |
| 6 | src/game/GameService.ts | AudioManager初期化・BGM切り替え・各System注入 |
| 7 | src/systems/WeaponSystem.ts | 射撃SE呼び出し追加（プレイヤー/仲間区別） |
| 8 | src/systems/CollisionSystem.ts | 敵撃破・アイテム破壊・バフ発動SE追加 |
| 9 | src/systems/AllyConversionSystem.ts | 仲間化SE追加 |
| 10 | src/systems/DefenseLineSystem.ts | 防衛ライン突破SE追加 |
| 11 | src/managers/SpawnManager.ts | ボス出現SE追加 |

---

## 実行ステップ

### Step 1: audioConfig.ts — サウンドパラメータ定義
- [x] `src/config/audioConfig.ts` を新規作成
- [x] SE定義データ型（SEDefinitionConfig）定義: seType, duration, maxConcurrent, cooldown, oscillatorCount
- [x] BGMパラメータ定数: デフォルト音量、フェードアウト時間、lookahead間隔/バッファ時間
- [x] OscillatorNodeハードリミット定数（MAX_OSCILLATOR_COUNT = 20）
- [x] 仲間射撃音の音量比率（ALLY_VOLUME_RATIO = 0.5）、仲間射撃クールダウン（0.2秒）
- **参照**: BR-ACFG01, BR-SE01, BR-SE03, BR-PERF01

### Step 2: SoundGenerator.ts — SE音生成関数
- [x] `src/audio/SoundGenerator.ts` を新規作成
- [x] 7種のSE generator関数を実装（各 `(ctx, gain) => OscillatorNode[]`）:
  - shoot: square波 880Hz→440Hz, 0.05秒
  - enemy_destroy: sawtooth波 200Hz→50Hz, 0.2秒
  - item_destroy: sine波 523Hz→1047Hz, 0.15秒
  - buff_activate: sine波 C5→E5→G5→C6 アルペジオ, 0.4秒
  - ally_convert: triangle波 C4→E4→G4, 0.5秒
  - boss_spawn: sawtooth波 80Hz + LFOビブラート, 1.0秒
  - defense_breach: square波 150Hz→80Hz, 0.3秒
- [x] SE_DEFINITIONS マップ（SEType → SEDefinition）をエクスポート
- **参照**: BLM §4.1〜4.7, BR-SE01

### Step 3: BGMGenerator.ts — BGM楽曲データ定義
- [x] `src/audio/BGMGenerator.ts` を新規作成
- [x] BGMDefinition型を定義（scene, tempo, notes: NoteSequence[], loop）
- [x] title BGM: 120BPM, square+triangle, ループ, 軽快なチップチューンメロディ
- [x] playing BGM: 150BPM, square+sawtooth+triangle, ループ, 戦闘感のある速いテンポ
- [x] gameover BGM: 80BPM, triangle, 非ループ, 短い下降フレーズ（2小節）
- [x] BGM_DEFINITIONS マップ（GameScene → BGMDefinition）をエクスポート
- **参照**: BR-BGM01, VO-A03〜A05

### Step 4: AudioManager.ts — メインサウンド管理クラス
- [x] `src/audio/AudioManager.ts` を新規作成
- [x] エンティティ: AudioManager（AE-01属性すべて）
- [x] resumeContext(): AudioContext初期化（遅延初期化、モバイル対応）
- [x] playBGM(scene): BGM再生（lookaheadスケジューリング）
  - BGMTrack内部クラス: start(), scheduleNotes(), stop()
  - フェードアウト（0.3秒）、フェードタイマー競合防止
  - 非ループBGM終了処理
- [x] stopBGM(): BGM停止
- [x] playSE(type, options?): SE再生
  - OscillatorNodeハードリミットチェック
  - クールダウンチェック（プレイヤー/仲間独立管理）
  - 同時再生制限チェック
  - 仲間射撃音の音量・クールダウン差別化
- [x] setBGMVolume(volume), setSEVolume(volume): 音量制御
- [x] reset(): 全停止・クリーンアップ
- [x] setupVisibilityHandler(): タブ非アクティブ対応（BGM一時停止/再開）
- [x] getAudioDebugInfo(): デバッグ診断API
- **参照**: BLM §1〜8全体, BR-AU01〜05, BR-BGM01〜07, BR-SE01〜05, BR-PERF01〜02

### Step 5: InputHandler.ts — 初回インタラクションコールバック
- [x] `src/input/InputHandler.ts` を既存変更
- [x] `onFirstInteraction(callback: () => void)` メソッド追加
- [x] 初回のkeydown/touchstart/clickで一度だけコールバックを実行
- [x] フラグ管理（firstInteractionFired: boolean）
- **参照**: BLM §1.2, BR-AU01

### Step 6: GameService.ts — AudioManager統合
- [x] `src/game/GameService.ts` を既存変更
- [x] constructor: AudioManager生成、各SystemにAudioManager注入
- [x] init(): setupVisibilityHandler()、onFirstInteraction → resumeContext()
- [x] update() TITLE状態: title BGM再生（初回のみ）
- [x] startPlaying(): playing BGM再生
- [x] update() GAME_OVER状態: gameover BGM再生（初回のみ）
- [x] resetGame(): audioManager.reset()、BGMフラグリセット
- **参照**: BLM §9.1

### Step 7: WeaponSystem.ts — 射撃SEトリガー
- [x] `src/systems/WeaponSystem.ts` を既存変更
- [x] constructor: AudioManager引数追加
- [x] processPlayerWeapon(): fireBullets後に `audioManager.playSE('shoot', { isAlly: false })`
- [x] processAllyWeapon(): fireBullets後に `audioManager.playSE('shoot', { isAlly: true })`
- **参照**: BR-EV01, BR-EV02, BR-SE03

### Step 8: CollisionSystem.ts — 敵撃破・アイテム破壊・バフSEトリガー
- [x] `src/systems/CollisionSystem.ts` を既存変更
- [x] constructor: AudioManager引数追加
- [x] 敵撃破ループ内: `audioManager.playSE('enemy_destroy')`
- [x] アイテム破壊ループ内: バフ適用時 `audioManager.playSE('buff_activate')`、アイテム破壊時 `audioManager.playSE('item_destroy')`
- **参照**: BR-EV01

### Step 9: AllyConversionSystem.ts — 仲間化SEトリガー
- [x] `src/systems/AllyConversionSystem.ts` を既存変更
- [x] constructor: AudioManager引数追加
- [x] tryConvertToAlly()成功時: `audioManager.playSE('ally_convert')`
- **参照**: BR-EV01

### Step 10: DefenseLineSystem.ts — 防衛ライン突破SEトリガー
- [x] `src/systems/DefenseLineSystem.ts` を既存変更
- [x] constructor: AudioManager引数追加
- [x] 敵突破時（HP減少処理時）: `audioManager.playSE('defense_breach')`
- **参照**: BR-EV01

### Step 11: SpawnManager.ts — ボス出現SEトリガー
- [x] `src/managers/SpawnManager.ts` を既存変更
- [x] constructor: AudioManager引数追加
- [x] ボスエンティティ生成後: `audioManager.playSE('boss_spawn')`
- **参照**: BR-EV01

### Step 12: コード生成サマリ
- [x] `aidlc-docs/construction/audio-system/code/code-generation-summary.md` を作成
- [x] 新規作成・変更ファイル一覧、主要な実装判断の記録

---

## ストーリートレーサビリティ

| ストーリー | 実装ステップ |
|-----------|------------|
| US-10: BGM | Step 3, 4, 6 |
| US-11: 効果音 | Step 1, 2, 4, 7-11 |
| US-12: 音量設定 | Step 4, 6（Unit-02で設定UIを追加） |

---

## 依存関係

- Unit-02（設定画面）: AudioManager.setBGMVolume()/setSEVolume()のAPI提供のみ。設定UIはUnit-02で実装。
- 既存ECSアーキテクチャ: コンストラクタ注入方式でAudioManagerを各Systemに渡す（FDの設計通り）。

---

## 実装上の注意

1. **コードのみでサウンド生成**: 外部オーディオファイルは一切使用しない
2. **グレースフルデグラデーション**: AudioContext生成失敗時はゲームを無音で続行
3. **パフォーマンス**: OscillatorNode上限20個を厳守、クールダウンでGC回避
4. **モバイル対応**: ユーザーインタラクション後にAudioContext初期化
5. **既存ファイル変更**: 修正は最小限に、AudioManager呼び出しの追加のみ
