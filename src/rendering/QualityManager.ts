import { GAME_CONFIG } from '../config/gameConfig';
import type { SceneManager } from './SceneManager';

/** 品質ティア */
export type QualityTier = 'high' | 'low';

/** 品質プリセット（BL-06, BR-Q01〜Q03） */
export interface QualitySettings {
  shadowEnabled: boolean;
  shadowMapSize: number;
  maxParticles: number;
  maxBulletInstances: number;
  postProcessEnabled: boolean;
}

const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  high: { shadowEnabled: true, shadowMapSize: 1024, maxParticles: 50, maxBulletInstances: 200, postProcessEnabled: true },
  low: { shadowEnabled: false, shadowMapSize: 0, maxParticles: 15, maxBulletInstances: 100, postProcessEnabled: false },
};

/** 品質ティア自動切替管理（BL-06） */
export class QualityManager {
  private fpsHistory: number[] = [];
  private currentTier: QualityTier = 'high';
  private lastSwitchTime = 0;
  private sustainStart = 0;
  private sustainDirection: 'upgrade' | 'downgrade' | null = null;

  /** 外部からの手動設定をロック（SettingsManagerからの指定を優先） */
  private manualOverride: QualityTier | null = null;

  private readonly cfg = GAME_CONFIG.three.quality;

  constructor(private sceneManager: SceneManager) {}

  /** FPS計測（毎フレーム呼び出し） */
  measureFPS(dt: number): void {
    if (dt <= 0) return;
    const fps = 1 / dt;
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > this.cfg.fpsSampleWindow) {
      this.fpsHistory.shift();
    }
  }

  /** 品質切替チェック（毎フレーム呼び出し） */
  checkQualitySwitch(): void {
    if (this.manualOverride !== null) return;
    if (this.fpsHistory.length < this.cfg.fpsSampleWindow) return;

    const now = performance.now();
    if (now - this.lastSwitchTime < this.cfg.switchCooldownMs) return;

    const avgFps = this.getAverageFPS();

    if (this.currentTier === 'high' && avgFps < this.cfg.fpsThresholdForDowngrade) {
      if (this.sustainDirection !== 'downgrade') {
        this.sustainDirection = 'downgrade';
        this.sustainStart = now;
      } else if (now - this.sustainStart >= this.cfg.sustainDurationMs) {
        this.setQuality('low');
        this.lastSwitchTime = now;
        this.sustainDirection = null;
      }
    } else if (this.currentTier === 'low' && avgFps > this.cfg.fpsThresholdForUpgrade) {
      if (this.sustainDirection !== 'upgrade') {
        this.sustainDirection = 'upgrade';
        this.sustainStart = now;
      } else if (now - this.sustainStart >= this.cfg.sustainDurationMs) {
        this.setQuality('high');
        this.lastSwitchTime = now;
        this.sustainDirection = null;
      }
    } else {
      this.sustainDirection = null;
    }
  }

  /** 平均FPS取得 */
  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 60;
    let sum = 0;
    for (const fps of this.fpsHistory) {
      sum += fps;
    }
    return sum / this.fpsHistory.length;
  }

  /** 現在の品質ティア */
  getCurrentTier(): QualityTier {
    return this.currentTier;
  }

  /** 品質設定取得 */
  getSettings(): QualitySettings {
    return QUALITY_PRESETS[this.currentTier];
  }

  /** 品質を手動設定（SettingsManager連携） */
  setManualOverride(tier: QualityTier | null): void {
    this.manualOverride = tier;
    if (tier !== null) {
      this.setQuality(tier);
    }
  }

  private setQuality(tier: QualityTier): void {
    if (this.currentTier === tier) return;
    this.currentTier = tier;
    const settings = QUALITY_PRESETS[tier];
    this.sceneManager.setShadowEnabled(settings.shadowEnabled);
    this.fpsHistory.length = 0;
  }
}
