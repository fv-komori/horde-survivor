# Unit of Work 定義

**作成日**: 2026-04-10
**対象**: Iteration 2完了コードベースからの機能拡張
**Unit数**: 2（既存Coreアプリに対する追加Unit）

---

## Unit-01: サウンドシステム（Audio System）

### 責務
Web Audio APIを使用したBGM・効果音の生成・再生・管理。外部アセットファイル不要で、コードのみでチップチューン風サウンドを実現する。

### スコープ

#### BGM（3曲）
| シーン | 曲調 | ループ |
|--------|------|--------|
| タイトル画面 | 軽快なチップチューン、メニュー向き | Yes |
| プレイ中 | テンポの速い戦闘BGM、緊張感あり | Yes |
| ゲームオーバー | 短いゲームオーバージングル | No（1回再生） |

#### 効果音（SE）
| イベント | 音の特徴 | トリガー |
|----------|---------|---------|
| 射撃 | 短い電子音パルス | WeaponSystem弾丸生成時 |
| 敵撃破 | 低音の爆発音 | CollisionSystem敵撃破時 |
| アイテム取得 | 上昇音（ピコッ） | CollisionSystemアイテム破壊時 |
| バフ発動 | キラキラ上昇音 | バフ適用時 |
| 仲間化 | ファンファーレ風短音 | AllyConversionSystem仲間化成功時 |
| ボス出現 | 低音警告音 | SpawnManagerボススポーン時 |
| 防衛ライン突破 | ダメージ音 | DefenseLineSystem突破時 |

#### 技術要件
- **生成方式**: Web Audio API（OscillatorNode, GainNode, BiquadFilterNode等）
- **外部ファイル**: 不要（全サウンドをコードで生成）
- **モバイル対応**: ユーザーインタラクション（タップ）後にAudioContextを初期化（ブラウザ制限対応）
- **ボリューム制御**: BGMとSEの個別音量制御（0.0〜1.0）、Unit-02の設定画面と連携
- **状態連動**: GameState変更時に適切なBGM切り替え

### 新規ファイル
```
src/
├── audio/
│   ├── AudioManager.ts        # サウンド管理のメインクラス
│   ├── SoundGenerator.ts      # Web Audio APIによるサウンド生成
│   └── BGMGenerator.ts        # BGMシーケンス生成
├── config/
│   └── audioConfig.ts         # サウンドパラメータ定義
```

### 既存コードへの変更
- `GameService.ts`: AudioManagerの初期化・BGM切り替え呼び出し追加
- `CollisionSystem.ts`: 敵撃破・アイテム破壊時のSEトリガー追加
- `WeaponSystem.ts`: 射撃時のSEトリガー追加
- `AllyConversionSystem.ts`: 仲間化時のSEトリガー追加
- `DefenseLineSystem.ts`: 防衛ライン突破時のSEトリガー追加
- `SpawnManager.ts`: ボス出現時のSEトリガー追加

---

## Unit-02: 設定画面 & 遊び方ヘルプ（Settings & How to Play）

### 責務
ゲーム設定のUI・永続化、および遊び方の説明ヘルプページ。タイトル画面からアクセス可能。

### スコープ

#### 設定項目
| 項目 | UI | デフォルト値 | 永続化 |
|------|-----|------------|--------|
| BGM音量 | スライダー（0〜100） | 70 | localStorage |
| SE音量 | スライダー（0〜100） | 80 | localStorage |
| 操作タイプ | 3択選択 | 両方 | localStorage |

#### 操作タイプ定義
| タイプ | 説明 |
|--------|------|
| ボタン操作 | 画面下部の左右ボタンのみ |
| スワイプ操作 | 水平スワイプのみ |
| 両方（デフォルト） | ボタン + スワイプ併用 |

#### 遊び方ヘルプ（設定画面内サブページ）
| セクション | 内容 |
|-----------|------|
| 操作方法 | PC: A/D・矢印キー、モバイル: ボタン/スワイプ |
| ゲームルール | 防衛ライン、HP、オート射撃、ゲームオーバー条件 |
| 敵タイプ | 通常・高速・タンク・ボスの特徴（色・ヒット数・速度） |
| アイテム・バフ | 4種バフ（攻撃UP/連射UP/速度UP/弾幕）の色とアイコン・効果 |
| 武器 | 前方射撃/拡散/貫通の特徴 |
| 仲間化 | 仲間化の仕組みと仲間の挙動 |

#### 技術要件
- **アクセス方法**: タイトル画面に「SETTINGS」ボタンを追加
- **画面遷移**: モーダル方式（GameStateに新状態は追加しない、タイトル画面上にオーバーレイ表示）
- **永続化**: localStorage（キー: `fv-game-settings`）
- **設定適用**: ゲーム起動時にlocalStorageから復元、AudioManager・InputHandlerに反映
- **遊び方ヘルプ**: 設定画面内の「遊び方」タブ/ボタンから表示。Canvas 2Dで描画（スクロール対応）

### 新規ファイル
```
src/
├── ui/
│   ├── SettingsScreen.ts      # 設定画面UI
│   └── HowToPlayScreen.ts    # 遊び方ヘルプ画面
├── config/
│   └── settingsConfig.ts      # デフォルト設定値・localStorage キー
```

### 既存コードへの変更
- `TitleScreen.ts`: 「SETTINGS」ボタン追加
- `UIManager.ts`: SettingsScreen・HowToPlayScreenの管理追加
- `GameService.ts`: 起動時のlocalStorage設定復元、AudioManager/InputHandlerへの設定適用
- `InputHandler.ts`: 操作タイプ切替対応（ボタンのみ/スワイプのみ/両方の切替）
