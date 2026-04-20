import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { BarrelItemComponent } from '../components/BarrelItemComponent';
import { EntityFactory } from '../factories/EntityFactory';
import type { WaveManager } from '../managers/WaveManager';
import { DeterministicRng } from '../services/DeterministicRng';
import { ForceSpawnApi } from '../services/ForceSpawnApi';
import { EventLogger } from '../services/EventLogger';
import { BARREL_SPAWN } from '../config/barrelConfig';
import { WAVE_BONUS_TIMES } from '../config/gateConfig';
import { GAME_CONFIG } from '../config/gameConfig';
import { BarrelItemType } from '../types';
import type { ToastQueue } from '../ui/ToastQueue';
import { I18N_TOAST } from '../config/i18nStrings';

const WAVE_AT: Record<number, number> = {
  45: 2,
  90: 3,
  180: 4,
};

const ALL_BARREL_TYPES: BarrelItemType[] = [
  BarrelItemType.WEAPON_RIFLE,
  BarrelItemType.WEAPON_SHOTGUN,
  BarrelItemType.WEAPON_MACHINEGUN,
];

/**
 * C6-04 / Iter6: 武器樽スポーナー（priority 3）
 *
 * 独立タイマーで 12〜15 秒ごとに樽を出現させる。
 * Wave 境目時刻（gateConfig WAVE_BONUS_TIMES[0] = 45s, [2] = 180s）で MACHINEGUN 樽を確定スポーン。
 * GAME_OVER / ポーズ時は enabled=false で呼出側が停止させる前提。
 */
export class ItemBarrelSpawner implements System {
  readonly priority = 3;
  enabled = true;

  private timer: number = BARREL_SPAWN.initialOffset;
  private elapsedTime: number = 0;
  private readonly entityFactory: EntityFactory;
  private readonly waveManager: WaveManager;
  private readonly eventLogger: EventLogger;
  private toastQueue: ToastQueue | null = null;

  constructor(entityFactory: EntityFactory, waveManager: WaveManager) {
    this.entityFactory = entityFactory;
    this.waveManager = waveManager;
    this.eventLogger = EventLogger.instance;
  }

  setElapsedTime(t: number): void {
    this.elapsedTime = t;
  }

  /** Iter6 Phase 6: Wave 境目ボーナス時の WAVE トースト発火 */
  setToastQueue(toastQueue: ToastQueue): void {
    this.toastQueue = toastQueue;
  }

  update(world: World, dt: number): void {
    if (!this.enabled) return;

    // 1. Wave 境目ボーナス（45s / 180s が樽担当、components-v6 Wave 境目ボーナス仕様）
    for (const t of [WAVE_BONUS_TIMES[0], WAVE_BONUS_TIMES[2]]) {
      if (this.elapsedTime >= t && !this.waveManager.hasBonusFired(t)) {
        this.spawn(world, BarrelItemType.WEAPON_MACHINEGUN, true);
        this.waveManager.markBonusFired(t);
        this.toastQueue?.push({
          kind: 'WAVE',
          text: I18N_TOAST.waveTransition(WAVE_AT[t] ?? 0),
          durationSec: 1.2,
        });
        this.eventLogger.info('wave_bonus_barrel', { t, type: 'MACHINEGUN' });
      }
    }

    // 2. 強制スポーン API（ForceSpawnApi）
    const forced = ForceSpawnApi.consumeForcedBarrel();
    if (forced && this.isValidBarrelType(forced)) {
      this.spawn(world, forced as BarrelItemType, false);
      return;
    }

    // 3. 通常タイマー
    this.timer -= dt;
    if (this.timer > 0) return;

    const currentCount = world.query(BarrelItemComponent).length;
    if (currentCount < BARREL_SPAWN.maxConcurrent) {
      const type = this.selectRandomType();
      this.spawn(world, type, false);
    }
    this.timer = this.nextInterval();
  }

  reset(): void {
    this.timer = BARREL_SPAWN.initialOffset;
    this.elapsedTime = 0;
  }

  private nextInterval(): number {
    const r = DeterministicRng.next();
    return BARREL_SPAWN.intervalMin + r * (BARREL_SPAWN.intervalMax - BARREL_SPAWN.intervalMin);
  }

  private selectRandomType(): BarrelItemType {
    const idx = Math.floor(DeterministicRng.next() * ALL_BARREL_TYPES.length);
    return ALL_BARREL_TYPES[Math.min(idx, ALL_BARREL_TYPES.length - 1)];
  }

  private randomSpawnPosition(): { x: number; y: number } {
    const margin = GAME_CONFIG.barrelSpawn.marginX;
    const minX = margin;
    const maxX = GAME_CONFIG.screen.logicalWidth - margin;
    const x = minX + DeterministicRng.next() * (maxX - minX);
    const y = GAME_CONFIG.enemySpawn.minY;
    return { x, y };
  }

  private spawn(world: World, type: BarrelItemType, isBonus: boolean): void {
    const pos = this.randomSpawnPosition();
    this.entityFactory.createBarrelItem(world, type, pos, isBonus);
  }

  private isValidBarrelType(v: string): boolean {
    return (Object.values(BarrelItemType) as string[]).includes(v);
  }
}
