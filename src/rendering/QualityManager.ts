import type { WebGLRenderer } from 'three';
import { GAME_CONFIG } from '../config/gameConfig';
import type { PostFXManager } from './PostFXManager';
import type { SceneManager } from './SceneManager';

/** 品質ティア */
export type QualityTier = 'high' | 'low';

/** 品質プリセット（BL-06, BR-Q01〜Q03, Iter4: outline/hemi/fog切替追加） */
export interface QualitySettings {
  shadowEnabled: boolean;
  shadowMapSize: number;
  maxParticles: number;
  maxBulletInstances: number;
  postProcessEnabled: boolean;
  /** Iter4: Outline（反転ハル）表示 */
  outlineEnabled: boolean;
  /** Iter4: HemisphereLight バウンス */
  hemisphereEnabled: boolean;
  /** Iter4: Fog（霧） */
  fogEnabled: boolean;
}

const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  high: {
    shadowEnabled: true,
    shadowMapSize: 1024,
    maxParticles: 50,
    maxBulletInstances: 200,
    postProcessEnabled: true,
    outlineEnabled: true,
    hemisphereEnabled: true,
    fogEnabled: true,
  },
  low: {
    shadowEnabled: false,
    shadowMapSize: 0,
    maxParticles: 15,
    maxBulletInstances: 100,
    postProcessEnabled: false,
    outlineEnabled: false,
    hemisphereEnabled: false,
    fogEnabled: false,
  },
};

/** 欠損フィールドをデフォルト値で補完（NFR-04 LocalStorageマイグレーション） */
export function migrateQualitySettings(tier: QualityTier, partial: Partial<QualitySettings>): QualitySettings {
  const defaults = QUALITY_PRESETS[tier];
  return {
    shadowEnabled: partial.shadowEnabled ?? defaults.shadowEnabled,
    shadowMapSize: partial.shadowMapSize ?? defaults.shadowMapSize,
    maxParticles: partial.maxParticles ?? defaults.maxParticles,
    maxBulletInstances: partial.maxBulletInstances ?? defaults.maxBulletInstances,
    postProcessEnabled: partial.postProcessEnabled ?? defaults.postProcessEnabled,
    outlineEnabled: partial.outlineEnabled ?? defaults.outlineEnabled,
    hemisphereEnabled: partial.hemisphereEnabled ?? defaults.hemisphereEnabled,
    fogEnabled: partial.fogEnabled ?? defaults.fogEnabled,
  };
}

/** Iter4: 品質プリセット取得（SettingsManager向け公開） */
export function getQualityPreset(tier: QualityTier): QualitySettings {
  return { ...QUALITY_PRESETS[tier] };
}

/** 品質ティア自動切替管理（BL-06, Iter4: PostFX/Outline/Hemi/Fog連携 + getRenderStats） */
export class QualityManager {
  private fpsHistory: number[] = [];
  private currentTier: QualityTier = 'high';
  private lastSwitchTime = 0;
  private sustainStart = 0;
  private sustainDirection: 'upgrade' | 'downgrade' | null = null;

  /** 外部からの手動設定をロック（SettingsManagerからの指定を優先） */
  private manualOverride: QualityTier | null = null;

  private readonly cfg = GAME_CONFIG.three.quality;

  /** Iter4: PostFXManager参照（未設定可、初期化失敗時はnull） */
  private postFXManager: PostFXManager | null = null;

  /** Iter4: Renderer参照（getRenderStats用） */
  private renderer: WebGLRenderer | null = null;

  constructor(private sceneManager: SceneManager) {}

  /** Iter4: 依存注入（GameService初期化後に呼ぶ） */
  setPostFXManager(postFX: PostFXManager | null): void {
    this.postFXManager = postFX;
  }

  setRenderer(renderer: WebGLRenderer): void {
    this.renderer = renderer;
  }

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

  /** Iter4: レンダ統計（?debug=1 表示用、NFR-01検証用） */
  getRenderStats(): { fps: number; drawCalls: number; triangles: number } {
    return {
      fps: this.getAverageFPS(),
      drawCalls: this.renderer?.info.render.calls ?? 0,
      triangles: this.renderer?.info.render.triangles ?? 0,
    };
  }

  private setQuality(tier: QualityTier): void {
    if (this.currentTier === tier) return;
    this.currentTier = tier;
    const settings = QUALITY_PRESETS[tier];
    // 各 setter は独立して try/catch、fail-open（A-NG-1-iter2対応）
    this.trySafe(() => this.sceneManager.setShadowEnabled(settings.shadowEnabled), 'shadow');
    this.trySafe(() => this.sceneManager.setHemisphereEnabled(settings.hemisphereEnabled), 'hemi');
    this.trySafe(() => this.sceneManager.setFogEnabled(settings.fogEnabled), 'fog');
    this.trySafe(() => this.sceneManager.setOutlineEnabled(settings.outlineEnabled), 'outline');
    this.trySafe(() => this.postFXManager?.setEnabled(settings.postProcessEnabled), 'postFX');
    this.fpsHistory.length = 0;
  }

  private trySafe(fn: () => void, label: string): void {
    try {
      fn();
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.warn(`${GAME_CONFIG.logPrefix} [Quality] ${label} setter failed: ${reason}`);
    }
  }
}
