# ビジネスロジックモデル — Unit-02: 設定画面 & 遊び方ヘルプ

## 概要
設定画面（音量・操作タイプ）と遊び方ヘルプ画面のロジックフロー、処理手順を定義する。

---

## 1. 設定データ管理（SettingsManager）

### 1.1 初期化（起動時のlocalStorage復元）
```
SettingsManager.init()
  raw = localStorage.getItem('fv-game-settings')
  IF raw !== null
    TRY
      parsed = JSON.parse(raw)
      // 型チェック: 数値型以外またはNaNはデフォルト値にフォールバック
      bgmVolume = (typeof parsed.bgmVolume === 'number' && !isNaN(parsed.bgmVolume))
        ? clamp(Math.round(parsed.bgmVolume), 0, 100)
        : DEFAULT_BGM_VOLUME
      seVolume = (typeof parsed.seVolume === 'number' && !isNaN(parsed.seVolume))
        ? clamp(Math.round(parsed.seVolume), 0, 100)
        : DEFAULT_SE_VOLUME
      controlType = validateControlType(parsed.controlType) ?? DEFAULT_CONTROL_TYPE
    CATCH
      // 破損データ → デフォルト使用
      Logger.warn('Settings', 'Settings data corrupted, using defaults')
      bgmVolume = DEFAULT_BGM_VOLUME
      seVolume = DEFAULT_SE_VOLUME
      controlType = DEFAULT_CONTROL_TYPE
  ELSE
    bgmVolume = DEFAULT_BGM_VOLUME
    seVolume = DEFAULT_SE_VOLUME
    controlType = DEFAULT_CONTROL_TYPE

  // AudioManagerとInputHandlerに即時反映
  applySettings()
```

### 1.2 設定値の変更と保存
```
SettingsManager.setBGMVolume(value: number)
  bgmVolume = clamp(Math.round(value), 0, 100)
  audioManager.setBGMVolume(bgmVolume / 100)  // 0-100 → 0.0-1.0 変換
  save()

SettingsManager.setSEVolume(value: number)
  seVolume = clamp(Math.round(value), 0, 100)
  audioManager.setSEVolume(seVolume / 100)  // 0-100 → 0.0-1.0 変換
  save()

SettingsManager.setControlType(type: ControlType)
  controlType = type
  inputHandler.setControlType(type)
  save()
```

### 1.3 永続化
```
SettingsManager.save()
  data = { bgmVolume, seVolume, controlType }
  localStorage.setItem('fv-game-settings', JSON.stringify(data))
```

### 1.4 設定適用
```
SettingsManager.applySettings()
  audioManager.setBGMVolume(bgmVolume / 100)
  audioManager.setSEVolume(seVolume / 100)
  inputHandler.setControlType(controlType)
```

---

## 2. 設定画面UI（SettingsScreen）

### 2.1 画面状態管理
```
SettingsScreen
  visible = false          // 表示/非表示
  activeTab = 'settings'   // 'settings' | 'howtoplay'

  // 設定タブのUI状態
  draggingSlider = null    // 現在ドラッグ中のスライダー（'bgm' | 'se' | null）

  // 遊び方タブのページ状態
  helpPageIndex = 0        // 現在表示中のヘルプページ（0〜5）
```

### 2.2 表示/非表示
```
SettingsScreen.show()
  visible = true
  activeTab = 'settings'
  helpPageIndex = 0
  draggingSlider = null

SettingsScreen.hide()
  visible = false
  draggingSlider = null
```

### 2.3 タブ切替
```
SettingsScreen.switchTab(tab: 'settings' | 'howtoplay')
  activeTab = tab
  IF tab === 'howtoplay'
    helpPageIndex = 0   // ヘルプ表示時は常に最初のページから
  draggingSlider = null
```

### 2.4 入力ルーティング（handleInput）
```
SettingsScreen.handleInput(x, y)
  // 1. 閉じるボタン判定（タブに関係なく常に判定）
  IF point(x, y) IS within closeButton.hitArea
    hide()
    return

  // 2. タブバー判定
  IF point(x, y) IS within settingsTab.hitArea
    switchTab('settings')
    return
  IF point(x, y) IS within howToPlayTab.hitArea
    switchTab('howtoplay')
    return

  // 3. activeTabに応じたコンテンツ入力委譲
  IF activeTab === 'settings'
    // スライダータップ/ラジオボタン選択
    IF handleSliderInput(x, y) → return
    IF handleControlTypeSelect(x, y) → return
  ELSE IF activeTab === 'howtoplay'
    // ページ送り/ドット直接タップ
    IF handleHelpNavigation(x, y) → return
```

---

## 3. スライダー操作ロジック

### 3.1 スライダーレイアウト定義
```
各スライダーの構成:
  ラベル: テキスト（"BGM音量" / "SE音量"）
  トラック: 横棒（X: trackLeft, Y: trackY, W: trackWidth, H: 8px）
  ノブ: 円形（半径12px）、トラック上をX軸で移動
  数値表示: 現在値（0〜100）をトラック右側に表示
```

### 3.2 タッチ/クリック → スライダー値変換
```
handleSliderInput(pointerX, pointerY)
  FOR each slider IN [bgmSlider, seSlider]
    // タッチ判定エリア: トラック ± 24px（タッチしやすさ確保）
    hitArea = slider.trackRect expanded by 24px vertically

    IF pointerPosition IS within hitArea
      ratio = clamp((pointerX - slider.trackLeft) / slider.trackWidth, 0, 1)
      value = Math.round(ratio * 100)

      IF slider === bgmSlider
        settingsManager.setBGMVolume(value)
      ELSE
        settingsManager.setSEVolume(value)

      return true  // 入力を消費

  return false  // どのスライダーにもヒットしなかった
```

### 3.3 ドラッグ操作
```
handlePointerDown(x, y)
  FOR each slider IN [bgmSlider, seSlider]
    IF point(x,y) IS within slider.knobHitArea (knob ± 20px)
      draggingSlider = slider.id
      updateSliderValue(slider, x)
      return

  // スライダー以外のダウン → ドラッグなし
  draggingSlider = null

handlePointerMove(x, y)
  IF draggingSlider !== null
    updateSliderValue(draggingSlider, x)
    // ドラッグ中はAudioManagerに即時反映するがlocalStorageへの書き込みはしない

handlePointerUp()
  IF draggingSlider !== null
    settingsManager.save()  // ドラッグ終了時にlocalStorageに永続化
  draggingSlider = null
```

### 3.4 ポインターイベント統合方針
```
SettingsScreenはmouseイベントとtouchイベントの両方を処理する。
既存InputHandlerのイベントリスナーとは独立し、SettingsScreen.visible時のみ動作する。

イベントマッピング:
  mousedown / touchstart → handlePointerDown(x, y)
  mousemove / touchmove  → handlePointerMove(x, y)
  mouseup / touchend     → handlePointerUp()

座標変換: 物理座標→論理座標変換はInputHandler.updateScaling()で
  設定されるscale/offset値を使用する（SettingsScreen初期化時に参照を保持）。
touchイベント時はevent.touches[0]またはevent.changedTouches[0]から座標を取得。
```

---

## 4. 操作タイプ選択ロジック

### 4.1 3択ラジオボタン
```
操作タイプ選択:
  [○] ボタン操作   — 画面下部の左右ボタンのみ
  [○] スワイプ操作 — 水平スワイプのみ
  [●] 両方        — ボタン + スワイプ併用（デフォルト）
```

### 4.2 選択処理
```
handleControlTypeSelect(pointerX, pointerY)
  FOR each option IN controlTypeOptions
    IF point(pointerX, pointerY) IS within option.hitArea
      settingsManager.setControlType(option.type)
      return true
  return false
```

### 4.3 InputHandlerへの反映
```
InputHandler.setControlType(type: ControlType)
  controlType = type

  IF type === 'buttons'
    // スワイプ入力を無視、ボタンのみ有効
    swipeEnabled = false
    buttonsEnabled = true
  ELSE IF type === 'swipe'
    // ボタン入力を無視、スワイプのみ有効
    swipeEnabled = true
    buttonsEnabled = false
  ELSE  // 'both'
    swipeEnabled = true
    buttonsEnabled = true

  // 注: PC（キーボード）入力は常に有効
```

---

## 5. 遊び方ヘルプ ページ送りロジック

### 5.1 ページ定義
```
helpPages = [
  { title: "操作方法",     index: 0 },
  { title: "ゲームルール", index: 1 },
  { title: "敵タイプ",     index: 2 },
  { title: "アイテム・バフ", index: 3 },
  { title: "武器",         index: 4 },
  { title: "仲間化",       index: 5 }
]

totalPages = 6
```

### 5.2 ページ送り操作
```
handleHelpNavigation(pointerX, pointerY)
  IF point IS within nextButton.hitArea
    IF helpPageIndex < totalPages - 1
      helpPageIndex += 1
    return true

  IF point IS within prevButton.hitArea
    IF helpPageIndex > 0
      helpPageIndex -= 1
    return true

  // ページインジケータドット直接タップ
  FOR i IN 0..totalPages-1
    IF point IS within pageDot[i].hitArea
      helpPageIndex = i
      return true

  return false
```

### 5.3 各ページのコンテンツ構成
```
Page 0: 操作方法
  - PC: A/Dキー または 矢印キーで左右移動
  - モバイル: ボタンタップ / スワイプで移動
  - 射撃: 自動（オート射撃）
  - [キーボードアイコン] [タッチアイコン]

Page 1: ゲームルール
  - 防衛ライン: 画面下部のライン。敵が通過するとHP減少
  - HP: 初期100。0になるとゲームオーバー
  - 生存: 可能な限り長く生き残る
  - スコア: 生存時間 + 撃破数 + 仲間数
  - [防衛ラインイラスト] [HPバーイラスト]

Page 2: 敵タイプ
  - 通常敵（緑）: ヒット5, 速度普通
  - 高速敵（黄）: ヒット2, 速度速い
  - タンク敵（赤）: ヒット15, 速度遅い
  - ボス敵（紫・大型）: ヒット100, 速度最遅
  - [各敵のスプライトアイコン + ヒット数表示]

Page 3: アイテム・バフ
  - 攻撃力UP（赤）: 1弾2カウント減算、5秒間
  - 発射速度UP（黄）: 連射2倍速、5秒間
  - 移動速度UP（青）: 移動1.5倍速、5秒間
  - 弾幕モード（紫）: 弾数3倍+拡散拡大、5秒間
  - [各バフのアイコン + 色付き■マーカー]

Page 4: 武器
  - 前方射撃（初期）: 正面直線、連射速度 高
  - 拡散射撃: 扇状3〜5発、連射速度 中
  - 貫通弾: 敵貫通、連射速度 低
  - [各武器の弾道イメージ]

Page 5: 仲間化
  - 敵撃破時に確率で仲間に転換
  - 最大10体、プレイヤー左右に配置
  - 仲間はオート射撃で援護
  - 時間経過で連射速度UP（10秒ごと+10%、最大+100%）
  - [仲間配置イメージ]
```

---

## 6. タイトル画面へのSETTINGSボタン統合

### 6.1 ボタン追加
```
TitleScreen
  既存: startButtonRect = { x: 260, y: 700, w: 200, h: 56 }
  追加: settingsButtonRect = { x: 260, y: 780, w: 200, h: 56 }

  render(ctx)
    // ... 既存描画 ...
    drawButton(ctx, settingsButtonRect, "SETTINGS")
```

### 6.2 タップ判定
```
TitleScreen.isSettingsButtonClicked(logicalX, logicalY) → boolean
  return pointInRect(logicalX, logicalY, settingsButtonRect)
```

---

## 7. GameServiceへの統合フロー

### 7.1 初期化時
```
GameService.init()
  // ... 既存初期化 ...
  settingsManager = new SettingsManager(audioManager, inputHandler)
  settingsManager.init()  // localStorage復元 → AudioManager/InputHandlerに反映
  settingsScreen = new SettingsScreen(settingsManager, inputHandler)
  uiManager.setSettingsScreen(settingsScreen)
```

### 7.2 タイトル画面での入力処理
```
GameService.handleTitleInput()
  tapPos = inputHandler.consumeLastTapPosition()  // タップ位置を取得し、即座にnullクリア
  IF tapPos === null → return

  IF settingsScreen.visible
    // 設定画面が表示中 → 設定画面が入力を処理
    settingsScreen.handleInput(tapPos.x, tapPos.y)
    return

  IF titleScreen.isStartButtonClicked(tapPos.x, tapPos.y)
    startPlaying()
  ELSE IF titleScreen.isSettingsButtonClicked(tapPos.x, tapPos.y)
    settingsScreen.show()
```

### 7.2.1 タップ消費ロジック（InputHandler拡張）
```
InputHandler.consumeLastTapPosition() → {x, y} | null
  pos = _lastTapPos
  _lastTapPos = null   // 取得と同時にクリア（同一タップの多重検出を防止）
  return pos
```

### 7.3 設定画面の描画
```
GameService.update(dt)
  SWITCH gameState
    CASE TITLE:
      uiManager.renderTitleScreen(ctx)
      IF settingsScreen.visible
        settingsScreen.render(ctx)  // タイトル画面の上にオーバーレイ描画
```

---

## 8. 設定画面レイアウト（論理座標系 720x1280）

### 8.1 オーバーレイ構成
```
背景: 半透明黒オーバーレイ（rgba(0,0,0,0.7)）
パネル: 中央配置、角丸矩形
  - X: 40, Y: 100, W: 640, H: 1080
  - 背景色: ダークグレー（#2a2a2a）
  - 角丸: 16px

タブバー（パネル上部）:
  - 「設定」タブ: X: 40, Y: 100, W: 320, H: 60
  - 「遊び方」タブ: X: 360, Y: 100, W: 320, H: 60
  - アクティブタブ: 明るい背景色 + 下線

閉じるボタン:
  - 「✕」: パネル右上 描画サイズ 40x40, ヒット判定エリア 48x48（NFR-02準拠）
  - 描画位置 X: 640, Y: 110 / ヒット判定 X: 636, Y: 106, W: 48, H: 48
```

### 8.2 設定タブコンテンツ
```
Y: 200  "BGM音量" ラベル
Y: 240  [====●========] 70
Y: 320  "SE音量" ラベル
Y: 360  [=======●=====] 80
Y: 460  "操作タイプ" ラベル
Y: 510  [○] ボタン操作
Y: 570  [○] スワイプ操作
Y: 630  [●] 両方（デフォルト）
```

### 8.3 遊び方タブコンテンツ
```
Y: 200〜1000  ページコンテンツ（テキスト + スプライトアイコン）
Y: 1060       ← [●○○○○○] →  ページインジケータ + 前後ボタン
Y: 1060       ページ番号表示: "1 / 6"
```
