/**
 * AE-01: AudioManager — サウンドシステム管理（Unit-01）
 * BGM・SEの再生・停止・音量管理を統括
 * BLM §1〜§9, BR-AU01〜05, BR-BGM01〜07, BR-SE01〜05, BR-PERF01〜02
 */

import type { GameScene, SEType } from '../config/audioConfig';
import { AUDIO_CONFIG, SE_CONFIG } from '../config/audioConfig';
import { SE_DEFINITIONS } from './SoundGenerator';
import { BGM_DEFINITIONS } from './BGMGenerator';
import type { NoteSequence } from './BGMGenerator';
import { GAME_CONFIG } from '../config/gameConfig';

/** SE再生チャンネル（AE-03） */
interface SEChannel {
  seType: SEType;
  oscillators: OscillatorNode[];
  gainNode: GainNode;
  isPlaying: boolean;
  startTime: number;
}

/** BGMトラック（AE-02） */
class BGMTrack {
  scene: GameScene;
  isPlaying: boolean = false;
  private definition: typeof BGM_DEFINITIONS[GameScene];
  private channelGains: GainNode[] = [];
  private activeOscillators: OscillatorNode[] = []; // F-NG-1: OscillatorNode参照保持
  private nextNoteTimes: number[] = [];
  private currentSteps: number[] = [];
  schedulerTimerId: ReturnType<typeof setInterval> | null = null;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.definition = BGM_DEFINITIONS[scene];
  }

  /** BGM再生開始（lookaheadパターン: BR-BGM05） */
  start(context: AudioContext, destinationGain: GainNode): void {
    if (!this.definition) return;

    for (const channel of this.definition.notes) {
      const channelGain = context.createGain();
      channelGain.gain.value = channel.volume;
      channelGain.connect(destinationGain);
      this.channelGains.push(channelGain);
      this.nextNoteTimes.push(context.currentTime);
      this.currentSteps.push(0);
    }

    this.isPlaying = true;

    // lookaheadスケジューラ起動
    this.schedulerTimerId = setInterval(
      () => this.scheduleNotes(context),
      AUDIO_CONFIG.lookaheadInterval,
    );
    this.scheduleNotes(context); // 初回即実行
  }

  /** 先読みスケジューリング（BLM §2.3） */
  private scheduleNotes(context: AudioContext): void {
    if (!this.isPlaying || !this.definition) return;

    const scheduleAhead = context.currentTime + AUDIO_CONFIG.scheduleAheadTime;
    const channels = this.definition.notes;

    for (let ch = 0; ch < channels.length; ch++) {
      const channel = channels[ch];
      // 非ループBGMで全ノート再生済みのチャンネルはスキップ
      if (!this.definition.loop && this.currentSteps[ch] >= channel.notes.length) {
        continue;
      }
      while (this.nextNoteTimes[ch] < scheduleAhead) {
        const note = channel.notes[this.currentSteps[ch]];
        if (!note) break; // 安全ガード: 配列外アクセス防止
        const stepDuration = (60 / this.definition.tempo) * note.duration;

        if (note.frequency > 0) {
          const osc = context.createOscillator();
          osc.type = channel.waveType;
          osc.frequency.value = note.frequency;
          osc.connect(this.channelGains[ch]);
          const noteEnd = this.nextNoteTimes[ch] + stepDuration * 0.9;
          osc.start(this.nextNoteTimes[ch]);
          osc.stop(noteEnd);
          this.activeOscillators.push(osc);
          osc.onended = () => {
            const idx = this.activeOscillators.indexOf(osc);
            if (idx !== -1) this.activeOscillators.splice(idx, 1);
          };
        }

        this.nextNoteTimes[ch] += stepDuration;
        this.currentSteps[ch]++;

        if (this.definition.loop) {
          this.currentSteps[ch] %= channel.notes.length;
        } else if (this.currentSteps[ch] >= channel.notes.length) {
          // 非ループBGM: 全チャンネル終了チェック（BR-BGM06）
          if (this.allChannelsCompleted(channels)) {
            this.scheduleEndCallback(context);
          }
          break;
        }
      }
    }
  }

  private allChannelsCompleted(channels: NoteSequence[]): boolean {
    for (let ch = 0; ch < channels.length; ch++) {
      if (this.currentSteps[ch] < channels[ch].notes.length) return false;
    }
    return true;
  }

  private scheduleEndCallback(context: AudioContext): void {
    const maxEndTime = Math.max(...this.nextNoteTimes);
    const delay = (maxEndTime - context.currentTime) * 1000;
    setTimeout(() => {
      this.isPlaying = false;
      this.stopScheduler();
    }, Math.max(0, delay));
  }

  /** スケジューラ停止 */
  stopScheduler(): void {
    if (this.schedulerTimerId !== null) {
      clearInterval(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
  }

  /** BGM停止 */
  stop(): void {
    this.stopScheduler();
    this.isPlaying = false;
    // F-NG-1: アクティブなOscillatorNodeを明示的に停止
    for (const osc of this.activeOscillators) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    this.activeOscillators = [];
    for (const gainNode of this.channelGains) {
      gainNode.disconnect();
    }
    this.channelGains = [];
  }

  /** タブ復帰時のリスケジュール（BR-BGM07） */
  reschedule(context: AudioContext): void {
    // S-NG-1: 既存タイマーをクリアしてから新規登録（二重登録防止）
    this.stopScheduler();
    for (let ch = 0; ch < this.nextNoteTimes.length; ch++) {
      this.nextNoteTimes[ch] = context.currentTime;
    }
    this.schedulerTimerId = setInterval(
      () => this.scheduleNotes(context),
      AUDIO_CONFIG.lookaheadInterval,
    );
    this.scheduleNotes(context);
  }
}

/** デバッグ情報（BR-LOG02） */
export interface AudioDebugInfo {
  contextState: string;
  initialized: boolean;
  currentScene: GameScene | null;
  bgmPlaying: boolean;
  activeSEChannels: Record<string, number>;
  activeOscillatorCount: number;
}

/**
 * AudioManager — サウンドシステム管理クラス
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private initialized: boolean = false;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private seGain: GainNode | null = null;
  private bgmVolume: number = AUDIO_CONFIG.defaultBGMVolume;
  private seVolume: number = AUDIO_CONFIG.defaultSEVolume;
  private currentBGM: BGMTrack | null = null;
  private currentScene: GameScene | null = null;
  private sePool: Map<SEType, SEChannel[]> = new Map();
  private seCooldowns: Map<string, number> = new Map();
  private fadeTimerId: ReturnType<typeof setTimeout> | null = null;
  private activeOscillatorCount: number = 0;

  constructor() {
    // F-NG-5/S-NG-3: audioConfigバリデーション（BR-ACFG02）
    this.validateConfig();

    // SEプール初期化
    const seTypes: SEType[] = [
      'shoot', 'enemy_destroy', 'item_destroy', 'buff_activate',
      'ally_convert', 'boss_spawn', 'defense_breach',
    ];
    for (const seType of seTypes) {
      this.sePool.set(seType, []);
    }
  }

  /** audioConfigバリデーション（BR-ACFG02） */
  private validateConfig(): void {
    const warn = (key: string, value: unknown) => {
      if (import.meta.env.DEV) {
        console.warn(`${GAME_CONFIG.logPrefix}[WARN][AudioManager] Invalid config value: ${key}=${value}, using default`);
      }
    };

    if (AUDIO_CONFIG.defaultBGMVolume < 0 || AUDIO_CONFIG.defaultBGMVolume > 1) warn('defaultBGMVolume', AUDIO_CONFIG.defaultBGMVolume);
    if (AUDIO_CONFIG.defaultSEVolume < 0 || AUDIO_CONFIG.defaultSEVolume > 1) warn('defaultSEVolume', AUDIO_CONFIG.defaultSEVolume);
    if (AUDIO_CONFIG.maxOscillatorCount < 1) warn('maxOscillatorCount', AUDIO_CONFIG.maxOscillatorCount);

    for (const [seType, config] of Object.entries(SE_CONFIG)) {
      if (config.duration <= 0) warn(`${seType}.duration`, config.duration);
      if (config.cooldown < 0) warn(`${seType}.cooldown`, config.cooldown);
      if (config.maxConcurrent < 1) warn(`${seType}.maxConcurrent`, config.maxConcurrent);
      if (config.oscillatorCount < 1) warn(`${seType}.oscillatorCount`, config.oscillatorCount);
    }
  }

  /** AudioContext初期化（BR-AU01: 遅延初期化） */
  resumeContext(): void {
    if (this.initialized) return;

    // Web Audio API非対応チェック（BR-AU04）
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (typeof AudioContextClass === 'undefined') {
      if (import.meta.env.DEV) {
        console.warn(`${GAME_CONFIG.logPrefix}[WARN][AudioManager] Web Audio API not supported, running silent`);
      }
      return;
    }

    try {
      this.context = new AudioContextClass();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);

      this.bgmGain = this.context.createGain();
      this.bgmGain.gain.value = this.bgmVolume;
      this.bgmGain.connect(this.masterGain);

      this.seGain = this.context.createGain();
      this.seGain.gain.value = this.seVolume;
      this.seGain.connect(this.masterGain);

      if (this.context.state === 'suspended') {
        // F-NG-4: resume()のPromiseをハンドリング
        this.context.resume().catch(() => {
          // resume失敗時もゲームは無音で続行（BR-AU04）
        });
      }

      this.initialized = true;
      if (import.meta.env.DEV) {
        console.info(`${GAME_CONFIG.logPrefix}[INFO][AudioManager] AudioContext initialized`);
      }
    } catch (error) {
      this.initialized = false;
      if (import.meta.env.DEV) {
        console.error(`${GAME_CONFIG.logPrefix}[ERROR][AudioManager] Failed to create AudioContext:`, error);
      }
    }
  }

  /** BGM再生（BLM §2.1） */
  playBGM(scene: GameScene): void {
    if (!this.initialized || !this.context || !this.bgmGain) return;
    if (this.context.state === 'closed') return; // BR-AU02

    // 同じBGM再生中なら何もしない
    if (this.currentScene === scene && this.currentBGM?.isPlaying) return;

    const oldScene = this.currentScene;

    // フェードタイマー競合防止（BR-BGM02）
    if (this.fadeTimerId !== null) {
      clearTimeout(this.fadeTimerId);
      this.fadeTimerId = null;
    }

    // 旧BGM停止
    if (this.currentBGM?.isPlaying) {
      this.fadeOutBGM();
    }

    this.currentScene = scene;

    const bgmDef = BGM_DEFINITIONS[scene];
    if (!bgmDef) return;

    // BGM音量復元（フェード後の場合）
    this.bgmGain.gain.value = this.bgmVolume;

    const track = new BGMTrack(scene);
    track.start(this.context, this.bgmGain);
    this.currentBGM = track;

    if (import.meta.env.DEV) {
      console.info(`${GAME_CONFIG.logPrefix}[INFO][AudioManager] BGM changed: ${oldScene} -> ${scene}`);
    }
  }

  /** BGMフェードアウト（BLM §2.5, BR-BGM04） */
  private fadeOutBGM(): void {
    if (!this.currentBGM || !this.context || !this.bgmGain) return;

    const duration = AUDIO_CONFIG.fadeOutDuration;
    this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, this.context.currentTime);
    this.bgmGain.gain.linearRampToValueAtTime(0, this.context.currentTime + duration);

    const bgmToStop = this.currentBGM;
    this.fadeTimerId = setTimeout(() => {
      bgmToStop.stop();
      // F-NG-7: フェード完了時のcurrentBGMクリア
      if (this.currentBGM === bgmToStop) {
        this.currentBGM = null;
      }
      if (this.bgmGain) {
        this.bgmGain.gain.value = this.bgmVolume;
      }
      this.fadeTimerId = null;
    }, duration * 1000);
  }

  /** BGM停止（BLM §2.6） */
  stopBGM(): void {
    if (!this.currentBGM) return;
    this.currentBGM.stop();
    this.currentBGM = null;
  }

  /** SE再生（BLM §3.1） */
  playSE(type: SEType, options?: { isAlly?: boolean }): void {
    if (!this.initialized || !this.context || !this.seGain) return;
    if (this.context.state === 'closed') return; // BR-AU02

    const seDef = SE_DEFINITIONS[type];
    if (!seDef) return;

    // OscillatorNodeハードリミットチェック（BR-PERF01）
    if (this.activeOscillatorCount + seDef.oscillatorCount > AUDIO_CONFIG.maxOscillatorCount) {
      return;
    }

    // クールダウンチェック（BR-SE03, BR-EV02）
    let cooldownKey: string = type;
    let effectiveCooldown = seDef.cooldown;
    if (options?.isAlly && type === 'shoot') {
      cooldownKey = 'shoot_ally';
      effectiveCooldown = AUDIO_CONFIG.allyShootCooldown;
    }

    const lastPlayed = this.seCooldowns.get(cooldownKey) ?? 0;
    const now = this.context.currentTime;
    if (now - lastPlayed < effectiveCooldown) {
      return;
    }

    // 同時再生チェック（BR-SE02）
    const channels = this.sePool.get(type)!;
    // F-NG-3: 完了チャンネルをクリーンアップ
    for (let i = channels.length - 1; i >= 0; i--) {
      if (!channels[i].isPlaying) channels.splice(i, 1);
    }
    const activeCount = channels.filter((ch) => ch.isPlaying).length;
    if (activeCount >= seDef.maxConcurrent) {
      return;
    }

    // 音量計算（BR-SE04）
    let volume = this.seVolume;
    if (options?.isAlly && type === 'shoot') {
      volume *= AUDIO_CONFIG.allyVolumeRatio;
    }

    // SE再生（BLM §3.2）
    const channelGain = this.context.createGain();
    channelGain.gain.value = volume;
    channelGain.connect(this.seGain);

    // S-NG-6: generator例外捕捉
    let oscillators: OscillatorNode[];
    try {
      oscillators = seDef.generator(this.context, channelGain);
    } catch {
      channelGain.disconnect();
      return;
    }
    this.activeOscillatorCount += oscillators.length;

    const channel: SEChannel = {
      seType: type,
      oscillators,
      gainNode: channelGain,
      isPlaying: true,
      startTime: this.context.currentTime,
    };

    channels.push(channel);
    this.seCooldowns.set(cooldownKey, now);

    // 主要解放パス: onendedイベント（BR-SE05）
    let completedCount = 0;
    for (const osc of oscillators) {
      osc.onended = () => {
        completedCount++;
        this.activeOscillatorCount--;
        if (completedCount >= oscillators.length) {
          channel.isPlaying = false;
          channelGain.disconnect();
        }
      };
    }

    // フォールバック解放（BR-SE05）
    setTimeout(() => {
      if (channel.isPlaying) {
        channel.isPlaying = false;
        channelGain.disconnect();
        this.activeOscillatorCount -= Math.max(0, oscillators.length - completedCount);
      }
    }, (seDef.duration + AUDIO_CONFIG.seFallbackMargin) * 1000);
  }

  /** BGM音量設定（BLM §5.1） */
  setBGMVolume(volume: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.bgmGain) {
      this.bgmGain.gain.value = this.bgmVolume;
    }
  }

  /** SE音量設定（BLM §5.2） */
  setSEVolume(volume: number): void {
    this.seVolume = Math.max(0, Math.min(1, volume));
  }

  /** 全停止・クリーンアップ（BLM §6.1） */
  reset(): void {
    // フェードタイマーキャンセル
    if (this.fadeTimerId !== null) {
      clearTimeout(this.fadeTimerId);
      this.fadeTimerId = null;
    }

    this.stopBGM();
    this.stopAllSE();
    this.seCooldowns.clear();
    this.currentScene = null;
  }

  /** 全SE停止（BLM §6.2） */
  private stopAllSE(): void {
    for (const [, channels] of this.sePool) {
      for (const channel of channels) {
        if (channel.isPlaying) {
          for (const osc of channel.oscillators) {
            try { osc.stop(); } catch { /* already stopped */ }
          }
          channel.gainNode.disconnect();
          channel.isPlaying = false;
        }
      }
      channels.length = 0;
    }
    this.activeOscillatorCount = 0;
  }

  /** タブ可視性ハンドリング（BR-BGM07, BLM §7.1） */
  setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // BGM一時停止
        if (this.currentBGM?.isPlaying && this.currentBGM.schedulerTimerId !== null) {
          this.currentBGM.stopScheduler();
        }
      } else {
        // BGM再開
        if (this.context && this.currentBGM?.isPlaying && this.currentBGM.schedulerTimerId === null) {
          this.currentBGM.reschedule(this.context);
        }
      }
    });
  }

  /** デバッグ診断API（BR-LOG02） */
  getAudioDebugInfo(): AudioDebugInfo {
    const activeSEChannels: Record<string, number> = {};
    for (const [seType, channels] of this.sePool) {
      activeSEChannels[seType] = channels.filter((ch) => ch.isPlaying).length;
    }

    return {
      contextState: this.context?.state ?? 'no-context',
      initialized: this.initialized,
      currentScene: this.currentScene,
      bgmPlaying: this.currentBGM?.isPlaying ?? false,
      activeSEChannels,
      activeOscillatorCount: this.activeOscillatorCount,
    };
  }
}
