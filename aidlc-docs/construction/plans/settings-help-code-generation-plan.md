# Code Generation Plan — Unit-02: 設定画面 & 遊び方ヘルプ

**作成日**: 2026-04-13
**プロジェクトタイプ**: Brownfield
**ワークスペースルート**: /Users/komori/fv-genai-specialforce/fv-game

## 対象ストーリー
- US-26: 設定画面（BGM音量, SE音量, 操作タイプ）
- US-27: 遊び方ヘルプ（6ページ構成、テキスト+スプライト）

## 設計参照
- FD: `aidlc-docs/construction/settings-help/functional-design/`
- AutoReview未解決事項（実装時対応）:
  - ドラッグ中のsave分離 → previewVolume方式で対応
  - render構造 → renderSettingsTab()/renderHelpTab()委譲
  - gameConfig依存 → ヘルプ数値をconfig参照
  - save() try-catch → BR-PS03準拠

---

## ファイル変更サマリー

### 新規作成（3ファイル）
| ファイル | 責務 |
|---------|------|
| `src/config/settingsConfig.ts` | デフォルト設定値・localStorageキー・UI座標定数 |
| `src/game/SettingsManager.ts` | 設定値の管理・永続化・AudioManager/InputHandlerへの適用 |
| `src/ui/SettingsScreen.ts` | 設定タブ+遊び方タブの統合UI（オーバーレイモーダル） |

### 既存変更（4ファイル）
| ファイル | 変更内容 |
|---------|---------|
| `src/types/index.ts` | ControlType列挙型追加 |
| `src/input/InputHandler.ts` | setControlType(), consumeLastTapPosition(), isButtonsEnabled()追加 |
| `src/ui/TitleScreen.ts` | SETTINGSボタン追加 |
| `src/game/GameService.ts` | SettingsManager初期化・設定画面の入出力統合 |

---

## 実装ステップ

### Step 1: 型定義・設定ファイル
- [ ] `src/types/index.ts` に ControlType 列挙型を追加
- [ ] `src/config/settingsConfig.ts` を新規作成
  - SETTINGS_CONFIG定数（デフォルト値、localStorageキー）
  - スライダーUI定数（トラック座標、ノブ半径、ヒットエリア）
  - パネル座標・タブ座標・閉じるボタン座標
  - 操作タイプ選択肢定義
  - ヘルプページ定義（タイトル配列）

### Step 2: SettingsManager実装
- [ ] `src/game/SettingsManager.ts` を新規作成
  - constructor(audioManager, inputHandler)
  - init(): localStorage復元 → 型チェック+バリデーション → applySettings
  - getBGMVolume/getSEVolume/getControlType
  - setBGMVolume/setSEVolume/setControlType（即時反映+永続化）
  - previewBGMVolume/previewSEVolume（ドラッグ中: AudioManager反映のみ、save不要）
  - save(): try-catch付きlocalStorage書き込み（BR-PS03対応）
  - applySettings(): AudioManager/InputHandler一括反映

### Step 3: InputHandler拡張
- [ ] `src/input/InputHandler.ts` を変更
  - controlType/swipeEnabled/buttonsEnabledプロパティ追加
  - setControlType(type: ControlType): void
  - consumeLastTapPosition(): get-and-clear方式
  - isButtonsEnabled(): boolean（描画側参照用）
  - setupTouchListeners内でswipeEnabled/buttonsEnabledフラグ参照

### Step 4: TitleScreen変更
- [ ] `src/ui/TitleScreen.ts` を変更
  - settingsButtonRect追加（y: 780）
  - render()にSETTINGSボタン描画追加
  - isSettingsButtonClicked()メソッド追加

### Step 5: SettingsScreen実装 — 基盤・設定タブ
- [ ] `src/ui/SettingsScreen.ts` を新規作成（Part 1）
  - クラス定義・コンストラクタ（settingsManager, inputHandler参照）
  - show()/hide()/switchTab()
  - render(): オーバーレイ背景 → パネル → タブバー → 閉じるボタン → activeTab委譲
  - renderSettingsTab(): BGMスライダー + SEスライダー + 操作タイプラジオボタン
  - handleInput(): 閉じる→タブ→コンテンツのルーティング
  - スライダー描画・入力処理（タップ+ドラッグ、ポインターイベント統合）
  - ラジオボタン描画・入力処理

### Step 6: SettingsScreen実装 — 遊び方タブ
- [ ] `src/ui/SettingsScreen.ts` を追記（Part 2）
  - renderHelpTab(): ページコンテンツ + ページインジケータ + 前後ボタン
  - 各ページの描画（Page 0〜5、テキスト+スプライトアイコン）
  - ページ送りナビゲーション入力処理
  - gameConfig.ts参照によるヘルプ数値表示（BR-HP04）
  - ゲーム内描画関数を流用したミニスプライト表示

### Step 7: GameService統合
- [ ] `src/game/GameService.ts` を変更
  - SettingsManager/SettingsScreenのimport追加
  - init()内: SettingsManager初期化 → SettingsScreen生成
  - handleTitleInput(): consumeLastTapPosition使用、settingsScreen.visible時の入力委譲
  - update() TITLE分岐: settingsScreen.visible時のオーバーレイ描画追加
  - SettingsScreenのポインターイベントリスナー登録/解除の管理

### Step 8: コードサマリー・最終確認
- [ ] aidlc-docs/construction/settings-help/code/code-generation-summary.md 作成
- [ ] 全ファイルの変更内容サマリー
- [ ] ストーリートレーサビリティ確認（US-26, US-27の受入基準カバー）

---

## ストーリートレーサビリティ

| 受入基準 | 実装ステップ |
|---------|------------|
| US-26: SETTINGSボタン表示 | Step 4 |
| US-26: 設定画面オーバーレイ表示 | Step 5, 7 |
| US-26: BGM音量スライダー | Step 2, 5 |
| US-26: SE音量スライダー | Step 2, 5 |
| US-26: 操作タイプ3択 | Step 2, 3, 5 |
| US-26: localStorage永続化・復元 | Step 1, 2 |
| US-26: 閉じるボタン | Step 5 |
| US-27: 遊び方ボタン（タブ） | Step 5 |
| US-27: ヘルプ6セクション | Step 6 |
| US-27: スクロール/ページ送り | Step 6 |
| US-27: 戻るボタン（タブ） | Step 5 |

---

## 依存関係

```
Step 1（型・設定） → Step 2（SettingsManager） → Step 5-6（SettingsScreen）
Step 1 → Step 3（InputHandler拡張）
Step 4（TitleScreen）は独立
Step 5-6 → Step 7（GameService統合）
Step 7 → Step 8（サマリー）
```
