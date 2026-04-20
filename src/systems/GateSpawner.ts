import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { GateComponent } from '../components/GateComponent';
import { EntityFactory } from '../factories/EntityFactory';
import type { WaveManager } from '../managers/WaveManager';
import { DeterministicRng } from '../services/DeterministicRng';
import { ForceSpawnApi } from '../services/ForceSpawnApi';
import { EventLogger } from '../services/EventLogger';
import { GATE_SPAWN, WAVE_BONUS_TIMES } from '../config/gateConfig';
import { GAME_CONFIG } from '../config/gameConfig';
import { GateType } from '../types';

const ALL_GATE_TYPES: GateType[] = [
  GateType.ALLY_ADD,
  GateType.ATTACK_UP,
  GateType.SPEED_UP,
  GateType.HEAL,
];

/**
 * C6-05 / Iter6: ゲートスポーナー（priority 4）
 *
 * 独立タイマーで 8〜10 秒ごとにゲートを出現させる。
 * Wave 境目（90 秒）で強化ゲートを確定スポーン（components-v6 Wave 境目ボーナス仕様）。
 */
export class GateSpawner implements System {
  readonly priority = 4;
  enabled = true;

  private timer: number = GATE_SPAWN.initialOffset;
  private elapsedTime: number = 0;
  private readonly entityFactory: EntityFactory;
  private readonly waveManager: WaveManager;
  private readonly eventLogger: EventLogger;

  constructor(entityFactory: EntityFactory, waveManager: WaveManager) {
    this.entityFactory = entityFactory;
    this.waveManager = waveManager;
    this.eventLogger = EventLogger.instance;
  }

  setElapsedTime(t: number): void {
    this.elapsedTime = t;
  }

  update(world: World, dt: number): void {
    if (!this.enabled) return;

    // Wave 境目: 90s がゲート担当
    const t90 = WAVE_BONUS_TIMES[1];
    if (this.elapsedTime >= t90 && !this.waveManager.hasBonusFired(t90)) {
      this.spawn(world, this.selectRandomType(), true);
      this.waveManager.markBonusFired(t90);
      this.eventLogger.info('wave_bonus_gate', { t: t90 });
    }

    const forced = ForceSpawnApi.consumeForcedGate();
    if (forced && this.isValidGateType(forced)) {
      this.spawn(world, forced as GateType, false);
      return;
    }

    this.timer -= dt;
    if (this.timer > 0) return;

    const currentCount = world.query(GateComponent).length;
    if (currentCount < GATE_SPAWN.maxConcurrent) {
      const type = this.selectRandomType();
      this.spawn(world, type, false);
    }
    this.timer = this.nextInterval();
  }

  reset(): void {
    this.timer = GATE_SPAWN.initialOffset;
    this.elapsedTime = 0;
  }

  private nextInterval(): number {
    const r = DeterministicRng.next();
    return GATE_SPAWN.intervalMin + r * (GATE_SPAWN.intervalMax - GATE_SPAWN.intervalMin);
  }

  private selectRandomType(): GateType {
    const idx = Math.floor(DeterministicRng.next() * ALL_GATE_TYPES.length);
    return ALL_GATE_TYPES[Math.min(idx, ALL_GATE_TYPES.length - 1)];
  }

  private randomSpawnPosition(): { x: number; y: number } {
    const margin = GAME_CONFIG.gateSpawn.marginX;
    const minX = margin;
    const maxX = GAME_CONFIG.screen.logicalWidth - margin;
    const x = minX + DeterministicRng.next() * (maxX - minX);
    const y = GAME_CONFIG.enemySpawn.minY;
    return { x, y };
  }

  private spawn(world: World, type: GateType, isBonus: boolean): void {
    const pos = this.randomSpawnPosition();
    this.entityFactory.createGate(world, type, pos, isBonus);
  }

  private isValidGateType(v: string): boolean {
    return (Object.values(GateType) as string[]).includes(v);
  }
}
