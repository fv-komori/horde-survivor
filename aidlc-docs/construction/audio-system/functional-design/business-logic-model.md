# ビジネスロジックモデル — Unit-01: サウンドシステム

## 概要
サウンドシステムのロジックフロー、アルゴリズム、処理手順を定義する。

---

## 1. AudioManager 初期化フロー

### 1.1 コンストラクタ
```
AudioManager()
  context = null
  initialized = false
  masterGain = null
  bgmGain = null
  seGain = null
  bgmVolume = デフォルト値（audioConfig.defaultBGMVolume）
  seVolume = デフォルト値（audioConfig.defaultSEVolume）
  currentBGM = null
  currentScene = null
  sePool = 空Map（各SETypeに空配列を初期化）
  seCooldowns = 空Map
  fadeTimerId = null
  activeOscillatorCount = 0
```

### 1.2 resumeContext()（ユーザーインタラクション後に呼び出し）
```
resumeContext()
  IF initialized → return

  // Web Audio API非対応チェック（BR-AU04）
  IF typeof AudioContext === 'undefined' AND typeof webkitAudioContext === 'undefined'
    Logger.warn('AudioManager', 'Web Audio API not supported, running silent')
    return

  TRY
    context = new (AudioContext || webkitAudioContext)()
    masterGain = context.createGain()
    masterGain.connect(context.destination)
    bgmGain = context.createGain()
    bgmGain.gain.value = bgmVolume
    bgmGain.connect(masterGain)
    seGain = context.createGain()
    seGain.gain.value = seVolume
    seGain.connect(masterGain)

    IF context.state === 'suspended'
      await context.resume()

    initialized = true
    Logger.info('AudioManager', 'AudioContext initialized')
  CATCH (error)
    initialized = false
    Logger.error('AudioManager', 'Failed to create AudioContext:', error)
    // ゲームは無音で続行（BR-AU04）
```

---

## 2. BGM 再生ロジック（lookaheadスケジューリング）

### 2.1 playBGM(scene: GameScene)
```
playBGM(scene)
  IF NOT initialized → return
  IF context.state === 'closed' → return（BR-AU02）
  IF currentScene === scene AND currentBGM?.isPlaying → return（同じBGM再生中）

  oldScene = currentScene

  // 旧BGMの停止（フェードタイマー競合防止: BR-BGM02）
  IF fadeTimerId !== null
    clearTimeout(fadeTimerId)
    fadeTimerId = null

  IF currentBGM?.isPlaying
    fadeOutBGM(0.3)

  currentScene = scene
  bgmDef = BGM_DEFINITIONS[scene]
  IF bgmDef === undefined → return

  track = new BGMTrack(bgmDef)
  track.start(context, bgmGain)
  currentBGM = track

  Logger.info('AudioManager', `BGM changed: ${oldScene} -> ${scene}`)
```

### 2.2 BGMTrack.start()（lookaheadパターン: BR-BGM05）
```
start(context, destinationGain)
  FOR EACH channel IN definition.notes
    channelGain = context.createGain()
    channelGain.gain.value = channel.volume
    channelGain.connect(destinationGain)
    channelGains.push(channelGain)

    // 各チャンネルの次ノート時刻を初期化
    nextNoteTimes[channelIndex] = context.currentTime

  isPlaying = true

  // lookaheadスケジューラ起動（100msごと）
  schedulerTimerId = setInterval(() => scheduleNotes(context), LOOKAHEAD_INTERVAL)
  scheduleNotes(context)  // 初回即実行
```

### 2.3 scheduleNotes()（先読みスケジューリング）
```
scheduleNotes(context)
  IF NOT isPlaying → return

  scheduleAhead = context.currentTime + SCHEDULE_AHEAD_TIME  // 200ms先まで

  FOR EACH channelIndex IN definition.notes
    channel = definition.notes[channelIndex]
    WHILE nextNoteTimes[channelIndex] < scheduleAhead
      note = channel.notes[currentSteps[channelIndex]]
      stepDuration = (60 / definition.tempo) * note.duration

      IF note.frequency > 0  // 休符でない場合
        osc = context.createOscillator()
        osc.type = channel.waveType
        osc.frequency.value = note.frequency
        osc.connect(channelGains[channelIndex])
        noteEnd = nextNoteTimes[channelIndex] + stepDuration * 0.9
        osc.start(nextNoteTimes[channelIndex])
        osc.stop(noteEnd)
        // ノード解放はonendedで自動的に行われる（参照を保持しない）

      nextNoteTimes[channelIndex] += stepDuration

      // 次のステップ
      currentSteps[channelIndex]++
      IF definition.loop
        currentSteps[channelIndex] %= channel.notes.length
      ELSE IF currentSteps[channelIndex] >= channel.notes.length
        // 非ループ: 全チャンネル終了チェック（BR-BGM06）
        IF allChannelsCompleted()
          scheduleEndCallback(nextNoteTimes[channelIndex])
        BREAK
```

### 2.4 非ループBGM終了処理（BR-BGM06）
```
scheduleEndCallback(endTime)
  delay = (endTime - context.currentTime) * 1000
  setTimeout(() => {
    isPlaying = false
  }, Math.max(0, delay))
```

### 2.5 fadeOutBGM(duration)
```
fadeOutBGM(duration)
  IF currentBGM === null → return
  bgmGain.gain.setValueAtTime(bgmGain.gain.value, context.currentTime)
  bgmGain.gain.linearRampToValueAtTime(0, context.currentTime + duration)

  fadeTimerId = setTimeout(() => {
    stopBGM()
    bgmGain.gain.value = bgmVolume  // 音量を復元
    fadeTimerId = null
  }, duration * 1000)
```

### 2.6 stopBGM()
```
stopBGM()
  IF currentBGM === null → return

  // lookaheadスケジューラ停止
  IF currentBGM.schedulerTimerId !== null
    clearInterval(currentBGM.schedulerTimerId)

  currentBGM.isPlaying = false

  // チャンネルGainNodeの切断
  FOR EACH gainNode IN currentBGM.channelGains
    gainNode.disconnect()

  currentBGM = null
```

---

## 3. SE 再生ロジック

### 3.1 playSE(type: SEType, options?: { isAlly?: boolean })
```
playSE(type, options = {})
  IF NOT initialized → return
  IF context.state === 'closed' → return（BR-AU02）

  seDef = SE_DEFINITIONS[type]
  IF seDef === undefined → return

  // OscillatorNodeハードリミットチェック（BR-PERF01）
  IF activeOscillatorCount + seDef.oscillatorCount > MAX_OSCILLATOR_COUNT
    Logger.debug('AudioManager', `SE skipped: type=${type}, reason=oscillatorLimit`)
    return

  // クールダウンチェック（BR-SE03、プレイヤー/仲間独立: BR-EV02）
  cooldownKey = type
  effectiveCooldown = seDef.cooldown
  IF options.isAlly AND type === 'shoot'
    cooldownKey = 'shoot_ally'
    effectiveCooldown = ALLY_SHOOT_COOLDOWN  // 0.2秒

  lastPlayed = seCooldowns.get(cooldownKey) ?? 0
  now = context.currentTime
  IF now - lastPlayed < effectiveCooldown
    Logger.debug('AudioManager', `SE skipped: type=${type}, reason=cooldown`)
    return

  // 同時再生チェック（BR-SE02）
  activeChannels = sePool.get(type).filter(ch => ch.isPlaying)
  IF activeChannels.length >= seDef.maxConcurrent
    Logger.debug('AudioManager', `SE skipped: type=${type}, reason=maxConcurrent`)
    return

  // 音量計算（BR-SE04）
  volume = seVolume
  IF options.isAlly AND type === 'shoot'
    volume = seVolume * ALLY_VOLUME_RATIO  // 0.5

  // SE再生
  channel = createSEChannel(type, volume, seDef)
  sePool.get(type).push(channel)
  seCooldowns.set(cooldownKey, now)
```

### 3.2 createSEChannel(type, volume, seDef)
```
createSEChannel(type, volume, seDef)
  channelGain = context.createGain()
  channelGain.gain.value = volume
  channelGain.connect(seGain)

  // 音生成関数を実行 → OscillatorNode参照の配列を返す
  oscillators = seDef.generator(context, channelGain)

  // activeOscillatorCountを加算
  activeOscillatorCount += oscillators.length

  channel = {
    seType: type,
    oscillators: oscillators,
    gainNode: channelGain,
    isPlaying: true,
    startTime: context.currentTime
  }

  // 主要解放パス: onendedイベント（BR-SE05）
  completedCount = 0
  FOR EACH osc IN oscillators
    osc.onended = () => {
      completedCount++
      activeOscillatorCount--
      IF completedCount >= oscillators.length
        channel.isPlaying = false
        channelGain.disconnect()
    }

  // フォールバック解放（onendedが発火しないケースに備える）
  setTimeout(() => {
    IF channel.isPlaying
      channel.isPlaying = false
      channelGain.disconnect()
      activeOscillatorCount -= Math.max(0, oscillators.length - completedCount)
  }, (seDef.duration + 0.1) * 1000)

  return channel
```

---

## 4. SE 音生成アルゴリズム

各generator関数は `(ctx, gain) => OscillatorNode[]` の形式で、生成したOscillatorNode参照の配列を返す。

### 4.1 shoot（射撃音）
```
generator(ctx, gain) → [osc]
  osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(880, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.05)
  osc.connect(gain)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.05)
  return [osc]
```

### 4.2 enemy_destroy（敵撃破音）
```
generator(ctx, gain) → [osc]
  osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(200, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2)
  osc.connect(gain)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.2)
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
  return [osc]
```

### 4.3 item_destroy（アイテム破壊音）
```
generator(ctx, gain) → [osc]
  osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(523, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(1047, ctx.currentTime + 0.15)
  osc.connect(gain)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.15)
  return [osc]
```

### 4.4 buff_activate（バフ発動音）
```
generator(ctx, gain) → [osc1, osc2, osc3, osc4]
  notes = [523, 659, 784, 1047]  // C5, E5, G5, C6
  oscillators = []
  FOR i, freq IN notes
    osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(gain)
    startTime = ctx.currentTime + i * 0.1
    osc.start(startTime)
    osc.stop(startTime + 0.1)
    oscillators.push(osc)
  return oscillators
```

### 4.5 ally_convert（仲間化音）
```
generator(ctx, gain) → [osc1, osc2, osc3]
  notes = [262, 330, 392]  // C4, E4, G4
  oscillators = []
  FOR i, freq IN notes
    osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    osc.connect(gain)
    startTime = ctx.currentTime + i * 0.15
    osc.start(startTime)
    osc.stop(startTime + 0.15)
    oscillators.push(osc)
  return oscillators
```

### 4.6 boss_spawn（ボス出現音）
```
generator(ctx, gain) → [osc, lfo]
  osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(80, ctx.currentTime)
  lfo = ctx.createOscillator()
  lfo.frequency.value = 5
  lfoGain = ctx.createGain()
  lfoGain.gain.value = 10
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  lfo.start(ctx.currentTime)
  lfo.stop(ctx.currentTime + 1.0)
  osc.connect(gain)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 1.0)
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(gain.gain.value * 1.5, ctx.currentTime + 0.3)
  gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 1.0)
  return [osc, lfo]
```

### 4.7 defense_breach（防衛ライン突破音）
```
generator(ctx, gain) → [osc]
  osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(150, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3)
  osc.connect(gain)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.3)
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
  return [osc]
```

---

## 5. 音量設定ロジック

### 5.1 setBGMVolume(volume: number)
```
setBGMVolume(volume)
  bgmVolume = clamp(volume, 0.0, 1.0)
  IF bgmGain !== null
    bgmGain.gain.value = bgmVolume
```

### 5.2 setSEVolume(volume: number)
```
setSEVolume(volume)
  seVolume = clamp(volume, 0.0, 1.0)
  // 次回のSE再生時から反映される
```

---

## 6. ゲームリセット・クリーンアップ

### 6.1 reset()
```
reset()
  // フェードタイマーキャンセル
  IF fadeTimerId !== null
    clearTimeout(fadeTimerId)
    fadeTimerId = null

  stopBGM()
  stopAllSE()
  seCooldowns.clear()
  currentScene = null
```

### 6.2 stopAllSE()
```
stopAllSE()
  FOR EACH type, channels IN sePool
    FOR EACH channel IN channels
      IF channel.isPlaying
        // OscillatorNodeを明示的に停止（BR-SE05）
        FOR EACH osc IN channel.oscillators
          TRY osc.stop() CATCH (ignore already stopped)
        channel.gainNode.disconnect()
        channel.isPlaying = false
    channels.length = 0
  activeOscillatorCount = 0
```

---

## 7. タブ可視性ハンドリング（BR-BGM07）

### 7.1 setupVisibilityHandler()
```
setupVisibilityHandler()
  document.addEventListener('visibilitychange', () => {
    IF document.hidden
      // BGM一時停止
      IF currentBGM?.isPlaying AND currentBGM.schedulerTimerId !== null
        clearInterval(currentBGM.schedulerTimerId)
        currentBGM.schedulerTimerId = null
    ELSE
      // BGM再開
      IF currentBGM?.isPlaying AND currentBGM.schedulerTimerId === null
        // nextNoteTimesをcontext.currentTimeからリスケジュール
        FOR EACH channelIndex IN currentBGM.nextNoteTimes
          currentBGM.nextNoteTimes[channelIndex] = context.currentTime
        currentBGM.schedulerTimerId = setInterval(
          () => currentBGM.scheduleNotes(context), LOOKAHEAD_INTERVAL
        )
        currentBGM.scheduleNotes(context)
  })
```

---

## 8. デバッグ診断API（BR-LOG02）

### 8.1 getAudioDebugInfo()
```
getAudioDebugInfo() → AudioDebugInfo
  return {
    contextState: context?.state ?? 'no-context',
    initialized,
    currentScene,
    bgmPlaying: currentBGM?.isPlaying ?? false,
    activeSEChannels: Map from sePool (type → activeCount),
    activeOscillatorCount,
  }
```

---

## 9. 既存コードとの統合ポイント

### 9.1 GameService への組み込み
```
// GameService.constructor()
this.audioManager = new AudioManager()

// GameService.init()
this.audioManager.setupVisibilityHandler()

// タイトル画面のタップリスナー内で初期化
this.inputHandler.onFirstInteraction(() => {
  this.audioManager.resumeContext()
})

// GameService.startPlaying()
this.audioManager.playBGM('playing')

// GameService.update() — TITLE state（初回のみ）
IF NOT titleBGMStarted
  this.audioManager.playBGM('title')
  titleBGMStarted = true

// GameService.update() — GAME_OVER state（初回のみ）
IF NOT gameOverBGMStarted
  this.audioManager.playBGM('gameover')
  gameOverBGMStarted = true

// GameService.resetGame()
this.audioManager.reset()
titleBGMStarted = false
gameOverBGMStarted = false
```

### 9.2 各System への AudioManager 受け渡し
```
// コンストラクタ注入方式
// WeaponSystem, CollisionSystem, AllyConversionSystem, DefenseLineSystem, SpawnManager
// にAudioManagerインスタンスを渡す

// 例: WeaponSystem
class WeaponSystem {
  constructor(entityFactory, audioManager) { ... }

  // 弾丸生成時
  createBullet(world, entity, ...) {
    // ... 弾丸生成ロジック
    const isAlly = world.getComponent(entity, AllyComponent) !== undefined
    this.audioManager.playSE('shoot', { isAlly })
  }
}

// 例: SpawnManager
class SpawnManager {
  constructor(entityFactory, waveManager, audioManager) { ... }

  // ボススポーン時
  spawnEnemy(world, ...) {
    // ...
    if (enemyType === 'BOSS') {
      this.audioManager.playSE('boss_spawn')
    }
  }
}
```
