# ドメインエンティティ — Unit-02: 設定画面 & 遊び方ヘルプ

## 概要
設定画面・遊び方ヘルプのドメインモデルと型定義。

---

## 1. 列挙型

### ControlType
```
enum ControlType {
  BUTTONS = 'buttons'     // ボタン操作のみ
  SWIPE = 'swipe'         // スワイプ操作のみ
  BOTH = 'both'           // 両方（デフォルト）
}
```

### SettingsTab
```
enum SettingsTab {
  SETTINGS = 'settings'   // 設定タブ
  HOW_TO_PLAY = 'howtoplay'  // 遊び方タブ
}
```

### HelpPage
```
enum HelpPage {
  CONTROLS = 0        // 操作方法
  RULES = 1           // ゲームルール
  ENEMIES = 2         // 敵タイプ
  ITEMS_BUFFS = 3     // アイテム・バフ
  WEAPONS = 4         // 武器
  ALLIES = 5          // 仲間化
}
```

---

## 2. データ構造

### GameSettings（永続化対象）
```
interface GameSettings {
  bgmVolume: number       // 0〜100（整数）、デフォルト 70
  seVolume: number        // 0〜100（整数）、デフォルト 80
  controlType: ControlType  // デフォルト BOTH
}
```

### SettingsConfig（定数）
```
interface SettingsConfig {
  localStorageKey: string          // 'fv-game-settings'
  defaults: GameSettings           // デフォルト値
  slider: SliderConfig             // スライダーUI設定
  controlTypeOptions: ControlTypeOption[]  // 操作タイプ選択肢
}
```

### SliderConfig
```
interface SliderConfig {
  trackLeft: number       // トラック左端X座標
  trackWidth: number      // トラック幅
  trackHeight: number     // トラック高さ（8px）
  knobRadius: number      // ノブ半径（12px）
  hitAreaPadding: number  // タッチ判定余白（24px）
}
```

### ControlTypeOption
```
interface ControlTypeOption {
  type: ControlType       // 列挙値
  label: string           // 表示名（"ボタン操作" / "スワイプ操作" / "両方"）
  description: string     // 説明文
}
```

---

## 3. UI矩形定義

### ButtonRect（共通）
```
interface ButtonRect {
  x: number
  y: number
  w: number
  h: number
}
```

### TabDef
```
interface TabDef {
  id: SettingsTab
  label: string
  rect: ButtonRect
}
```

### HelpPageDef
```
interface HelpPageDef {
  index: HelpPage
  title: string
  renderContent: (ctx: CanvasRenderingContext2D, area: ButtonRect) => void
}
```

---

## 4. エンティティ関係図

```
GameService
  │
  ├── SettingsManager ←→ localStorage ('fv-game-settings')
  │     │
  │     ├── → AudioManager.setBGMVolume() / setSEVolume()
  │     └── → InputHandler.setControlType()
  │
  └── UIManager
        │
        └── SettingsScreen（オーバーレイUI）
              │
              ├── SettingsTab（設定タブ）
              │     ├── BGM Volume Slider
              │     ├── SE Volume Slider
              │     └── ControlType Radio Buttons
              │
              └── HowToPlayTab（遊び方タブ）
                    ├── HelpPage[0..5]
                    ├── Prev/Next Buttons
                    └── Page Indicator Dots
```

---

## 5. クラス定義

### SettingsManager（新規）
```
class SettingsManager {
  // コンストラクタ
  constructor(audioManager: AudioManager, inputHandler: InputHandler)

  // プロパティ
  private audioManager: AudioManager
  private inputHandler: InputHandler
  private bgmVolume: number       // 0〜100
  private seVolume: number        // 0〜100
  private controlType: ControlType

  // 公開メソッド
  init(): void                    // localStorage復元 → 適用
  getBGMVolume(): number          // 0〜100
  getSEVolume(): number           // 0〜100
  getControlType(): ControlType
  setBGMVolume(value: number): void
  setSEVolume(value: number): void
  setControlType(type: ControlType): void
  save(): void                    // localStorageに永続化

  // 内部メソッド
  private applySettings(): void   // AudioManager/InputHandlerに反映
}
```

### SettingsScreen（新規）
```
class SettingsScreen {
  // コンストラクタ
  constructor(settingsManager: SettingsManager, inputHandler: InputHandler)
  // inputHandlerはscaling情報（物理→論理座標変換）の参照用

  // 責務: 「設定」タブと「遊び方」タブの両方を管理するタブ付きUI画面
  // ※ unit-of-work.mdでは HowToPlayScreen.ts を別ファイルとして定義していたが、
  //   タブ切替UIのため1クラスに統合。実装時は src/ui/SettingsScreen.ts に配置し、
  //   HowToPlayScreen.ts は作成しない。

  // 状態プロパティ
  visible: boolean
  activeTab: SettingsTab
  draggingSlider: 'bgm' | 'se' | null
  helpPageIndex: number           // 0〜5

  // 公開メソッド
  show(): void
  hide(): void
  handleInput(x: number, y: number): void  // 入力ルーティング
  render(ctx: CanvasRenderingContext2D): void
}
```

### 新規クラス・変更一覧

| クラス/モジュール | 責務 | 新規/変更 |
|---|---|---|
| SettingsManager | 設定値の管理・永続化・適用 | 新規 |
| SettingsScreen | 設定タブ＋遊び方タブの統合UI画面 | 新規 |
| settingsConfig.ts | デフォルト設定値・localStorage キー・UI定数 | 新規 |
| TitleScreen | SETTINGSボタン追加 | 変更 |
| UIManager | SettingsScreen管理追加 | 変更 |
| GameService | SettingsManager初期化・設定画面の入出力統合 | 変更 |
| InputHandler | setControlType() + consumeLastTapPosition()追加・操作タイプ切替対応 | 変更 |

### unit-of-work.mdとの差異
unit-of-work.mdでは `SettingsScreen.ts` と `HowToPlayScreen.ts` を別ファイルとして定義しているが、
FD検討の結果、タブ切替UIの一体性を考慮し `SettingsScreen.ts` に統合する設計とした。
unit-of-work.mdはCG（Code Generation）時に合わせて更新する。

---

## 6. 依存関係

```
settingsConfig.ts ← SettingsManager ← GameService
                  ← SettingsScreen

SettingsManager → AudioManager（音量設定）
SettingsManager → InputHandler（操作タイプ設定）

SettingsScreen → SettingsManager（値取得・変更）
SettingsScreen → InputHandler（scaling情報参照、ポインターイベント座標変換）
SettingsScreen → AssetManager（スプライト取得、ヘルプ画面用）※既存描画関数を流用

GameService → TitleScreen（ボタン判定のみ、TitleScreenはSettingsScreenに直接依存しない）
GameService → SettingsScreen（show/hide/handleInput/render呼び出し）
UIManager → SettingsScreen（描画管理）
```

### 操作タイプ切替時のボタン表示/非表示責務
```
InputHandler.setControlType(type)
  → InputHandler.buttonsEnabled を更新
  → InputHandler.swipeEnabled を更新

描画時（RenderSystem / UIManager）:
  InputHandler.isButtonsEnabled() を参照し、
  false の場合はモバイル左右ボタンの描画をスキップする。
  描画制御の責務はボタンを描画するコンポーネント（UIManager or HUD）に置く。
```
