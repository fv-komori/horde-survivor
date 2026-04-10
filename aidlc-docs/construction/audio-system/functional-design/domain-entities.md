# ドメインエンティティ定義 — Unit-01: サウンドシステム

## 概要
Web Audio APIを使用したゲームサウンドシステムのドメインモデル。
BGMと効果音をコードのみで生成・再生・管理する。

---

## 1. エンティティ

### AE-01: AudioManager（サウンド管理）
サウンドシステム全体の統括。BGM・SEの再生・停止・音量管理を担当。

| 属性 | 型 | 説明 | 初期値 |
|------|-----|------|--------|
| context | AudioContext \| null | Web Audio APIコンテキスト | null（遅延初期化） |
| initialized | boolean | AudioContextが有効化済みか | false |
| masterGain | GainNode \| null | マスター音量ノード | null（resumeContext後に生成） |
| bgmGain | GainNode \| null | BGM音量制御ノード | null（resumeContext後に生成） |
| seGain | GainNode \| null | SE音量制御ノード | null（resumeContext後に生成） |
| bgmVolume | number | BGM音量 (0.0〜1.0) | 0.7 |
| seVolume | number | SE音量 (0.0〜1.0) | 0.8 |
| currentBGM | BGMTrack \| null | 再生中のBGMトラック | null |
| currentScene | GameScene | 現在のゲームシーン | 'title' |
| sePool | Map\<SEType, SEChannel[]\> | SE同時再生プール | 空Map |
| seCooldowns | Map\<string, number\> | SE最終再生時刻（キー: SEType or SEType+'_ally'） | 空Map |
| fadeTimerId | number \| null | BGMフェードアウト用タイマーID | null |
| activeOscillatorCount | number | アクティブなOscillatorNode総数 | 0 |

### AE-02: BGMTrack（BGMトラック）
1曲分のBGMシーケンスの再生状態。

| 属性 | 型 | 説明 |
|------|-----|------|
| scene | GameScene | 対応するシーン |
| gainNode | GainNode | 音量制御ノード |
| oscillators | OscillatorNode[] | アクティブなオシレーター群 |
| isPlaying | boolean | 再生中フラグ |
| isLooping | boolean | ループ再生フラグ |
| tempo | number | テンポ (BPM) |
| currentStep | number | 現在の再生ステップ |
| schedulerTimerId | number \| null | lookaheadスケジューラのsetInterval ID |
| nextNoteTimes | number[] | 各チャンネルの次のノートスケジュール時刻 |
| channelGains | GainNode[] | 各チャンネルの音量制御ノード |
| currentSteps | number[] | 各チャンネルの現在ステップ位置 |

### AE-03: SEChannel（効果音チャンネル）
1つの効果音再生インスタンス。

| 属性 | 型 | 説明 |
|------|-----|------|
| seType | SEType | 効果音タイプ |
| oscillator | OscillatorNode \| null | 発振器 |
| gainNode | GainNode | 音量制御ノード |
| isPlaying | boolean | 再生中フラグ |
| startTime | number | 再生開始時刻 |

---

## 2. 値オブジェクト

### VO-A01: GameScene（ゲームシーン）
```
'title'     - タイトル画面
'playing'   - ゲームプレイ中
'gameover'  - ゲームオーバー
```

### VO-A02: SEType（効果音タイプ）
```
'shoot'           - 射撃音
'enemy_destroy'   - 敵撃破音
'item_destroy'    - アイテム破壊音
'buff_activate'   - バフ発動音
'ally_convert'    - 仲間化音
'boss_spawn'      - ボス出現音
'defense_breach'  - 防衛ライン突破音
```

### VO-A03: BGMDefinition（BGM定義データ）
| 属性 | 型 | 説明 |
|------|-----|------|
| scene | GameScene | 対応シーン |
| tempo | number | テンポ (BPM) |
| notes | NoteSequence[] | 音符シーケンス（チャンネル別） |
| loop | boolean | ループするか |

### VO-A04: NoteSequence（音符シーケンス）
| 属性 | 型 | 説明 |
|------|-----|------|
| waveType | OscillatorType | 波形タイプ (square/sawtooth/triangle/sine) |
| notes | NoteEvent[] | 音符イベント配列 |
| volume | number | チャンネル音量 (0.0〜1.0) |

### VO-A05: NoteEvent（音符イベント）
| 属性 | 型 | 説明 |
|------|-----|------|
| frequency | number | 周波数 (Hz)。0 = 休符 |
| duration | number | 音の長さ（拍数） |

### VO-A06: SEDefinition（SE定義データ）
本設計はWeb Audio API前提のため、generator関数の引数にAudioContext/GainNodeの具体型を使用する。

| 属性 | 型 | 説明 |
|------|-----|------|
| seType | SEType | 効果音タイプ |
| generator | (ctx: AudioContext, gain: GainNode) => OscillatorNode[] | 音生成関数。生成したOscillatorNodeの参照を返す |
| duration | number | 音の長さ（秒） |
| maxConcurrent | number | 同時再生上限 |
| cooldown | number | 再生間隔クールダウン（秒）。0 = 制限なし |
| oscillatorCount | number | 1回の再生で生成するOscillatorNode数（ノード上限管理用） |

---

## 3. エンティティ関係図

```
AudioManager (1) ---- (0..1) BGMTrack        [現在再生中のBGM]
AudioManager (1) ---- (*) SEChannel          [SE再生プール]
AudioManager (1) ---- (1) AudioContext        [Web Audio APIコンテキスト]

BGMTrack (1) ---- (1) BGMDefinition          [BGM楽曲データ]
BGMTrack (1) ---- (*) OscillatorNode         [音源ノード]
BGMTrack (1) ---- (1) GainNode               [音量ノード]

SEChannel (1) ---- (1) SEDefinition          [SE定義データ]
SEChannel (1) ---- (0..1) OscillatorNode     [音源ノード]
SEChannel (1) ---- (1) GainNode              [音量ノード]
```

---

## 4. Web Audio APIノードグラフ

```
[BGM]
OscillatorNode(melody)  ──┐
OscillatorNode(bass)    ──┤── GainNode(BGM音量) ──┐
OscillatorNode(rhythm)  ──┘                        │
                                                    ├── GainNode(Master) ── destination
[SE]                                                │
OscillatorNode(SE-1) ── GainNode(SE-1音量) ──┐     │
OscillatorNode(SE-2) ── GainNode(SE-2音量) ──┤─────┘
OscillatorNode(SE-3) ── GainNode(SE-3音量) ──┘
```
