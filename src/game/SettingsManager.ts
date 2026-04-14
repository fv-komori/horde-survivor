/**
 * SettingsManager — ゲーム設定の管理・永続化・適用（Unit-02: BR-ST01〜05, BR-PS01〜03）
 */

import { ControlType } from '../types';
import { SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS } from '../config/settingsConfig';
import { GAME_CONFIG } from '../config/gameConfig';
import type { AudioManager } from '../audio/AudioManager';
import type { InputHandler } from '../input/InputHandler';

const LOG_PREFIX = GAME_CONFIG.logPrefix;

/** 有効なControlType値のセット（BR-ST03） */
const VALID_CONTROL_TYPES = new Set<string>([
  ControlType.BUTTONS,
  ControlType.SWIPE,
  ControlType.BOTH,
]);

export class SettingsManager {
  private audioManager: AudioManager;
  private inputHandler: InputHandler;
  private bgmVolume: number = DEFAULT_SETTINGS.bgmVolume;
  private seVolume: number = DEFAULT_SETTINGS.seVolume;
  private controlType: ControlType = DEFAULT_SETTINGS.controlType;

  constructor(audioManager: AudioManager, inputHandler: InputHandler) {
    this.audioManager = audioManager;
    this.inputHandler = inputHandler;
  }

  /** localStorage復元 → バリデーション → 適用（BLM §1.1） */
  init(): void {
    const raw = this.loadFromStorage();
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        // 型チェック+範囲バリデーション（BR-ST01, S-NG-1対応）
        this.bgmVolume =
          typeof parsed.bgmVolume === 'number' && !isNaN(parsed.bgmVolume)
            ? clamp(Math.round(parsed.bgmVolume), 0, 100)
            : DEFAULT_SETTINGS.bgmVolume;
        this.seVolume =
          typeof parsed.seVolume === 'number' && !isNaN(parsed.seVolume)
            ? clamp(Math.round(parsed.seVolume), 0, 100)
            : DEFAULT_SETTINGS.seVolume;
        this.controlType = this.validateControlType(parsed.controlType);
      } catch {
        console.warn(`${LOG_PREFIX} Settings data corrupted, using defaults`);
        this.bgmVolume = DEFAULT_SETTINGS.bgmVolume;
        this.seVolume = DEFAULT_SETTINGS.seVolume;
        this.controlType = DEFAULT_SETTINGS.controlType;
        this.save(); // BR-PS02: 破損データをデフォルト値で上書き修復
      }
    }
    this.applySettings();
  }

  // --- Getters ---

  getBGMVolume(): number {
    return this.bgmVolume;
  }

  getSEVolume(): number {
    return this.seVolume;
  }

  getControlType(): ControlType {
    return this.controlType;
  }

  // --- Setters（即時反映+永続化、BLM §1.2） ---

  setBGMVolume(value: number): void {
    this.bgmVolume = clamp(Math.round(value), 0, 100);
    this.audioManager.setBGMVolume(this.bgmVolume / 100);
    this.save();
  }

  setSEVolume(value: number): void {
    this.seVolume = clamp(Math.round(value), 0, 100);
    this.audioManager.setSEVolume(this.seVolume / 100);
    this.save();
  }

  setControlType(type: ControlType): void {
    this.controlType = type;
    this.inputHandler.setControlType(type);
    this.save();
  }

  // --- Preview（ドラッグ中: AudioManager反映のみ、save不要、A-NG-2-iter2対応） ---

  previewBGMVolume(value: number): void {
    this.bgmVolume = clamp(Math.round(value), 0, 100);
    this.audioManager.setBGMVolume(this.bgmVolume / 100);
  }

  previewSEVolume(value: number): void {
    this.seVolume = clamp(Math.round(value), 0, 100);
    this.audioManager.setSEVolume(this.seVolume / 100);
  }

  /** ドラッグ終了時に永続化 */
  save(): void {
    const data = {
      bgmVolume: this.bgmVolume,
      seVolume: this.seVolume,
      controlType: this.controlType,
    };
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // BR-PS03: localStorage非対応・QuotaExceededError等は無視
      console.warn(`${LOG_PREFIX} Failed to save settings to localStorage`);
    }
  }

  // --- Private ---

  private applySettings(): void {
    this.audioManager.setBGMVolume(this.bgmVolume / 100);
    this.audioManager.setSEVolume(this.seVolume / 100);
    this.inputHandler.setControlType(this.controlType);
  }

  private validateControlType(value: unknown): ControlType {
    if (typeof value === 'string' && VALID_CONTROL_TYPES.has(value)) {
      return value as ControlType;
    }
    return DEFAULT_SETTINGS.controlType;
  }

  private loadFromStorage(): string | null {
    try {
      return localStorage.getItem(SETTINGS_STORAGE_KEY);
    } catch {
      // BR-PS03: localStorage非対応環境
      return null;
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min; // NaN/Infinity防御
  return Math.max(min, Math.min(max, value));
}
