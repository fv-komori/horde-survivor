import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { EntityId } from '../ecs/Entity';
import { PlayerComponent } from '../components/PlayerComponent';
import { PositionComponent } from '../components/PositionComponent';
import { HealthComponent } from '../components/HealthComponent';
import { AllyComponent } from '../components/AllyComponent';
import { BuffComponent } from '../components/BuffComponent';
import { GateComponent } from '../components/GateComponent';
import type { SpawnManager } from '../managers/SpawnManager';
import type { BuffSystem } from './BuffSystem';
import { EventLogger } from '../services/EventLogger';
import { isValidGateAmount } from '../config/gateConfig';
import { GAME_CONFIG } from '../config/gameConfig';
import { GateType, BuffType } from '../types';
import type { ToastQueue } from '../ui/ToastQueue';
import { I18N_TOAST } from '../config/i18nStrings';

/**
 * C6-06 / Iter6: ゲート通過判定システム（priority 6）
 *
 * プレイヤーの Y がゲートの Y を跨いだ瞬間に発動する。仲間のみの通過はスルー。
 * consumed フラグで多重発火防止、次フレーム CleanupSystem で消滅。
 */
export class GateTriggerSystem implements System {
  readonly priority = 6;
  enabled = true;

  private prevPlayerY: number = 0;
  private playerInitialized: boolean = false;
  private readonly prevGateY: Map<EntityId, number> = new Map();
  private readonly initialized: Set<EntityId> = new Set();
  private elapsedTime: number = 0;

  private readonly spawnManager: SpawnManager;
  private readonly buffSystem: BuffSystem;
  private readonly eventLogger: EventLogger;
  private toastQueue: ToastQueue | null = null;

  constructor(spawnManager: SpawnManager, buffSystem: BuffSystem) {
    this.spawnManager = spawnManager;
    this.buffSystem = buffSystem;
    this.eventLogger = EventLogger.instance;
  }

  /** Iter6 Phase 5: ToastQueue 直接 DI (HTMLOverlayManager Facade 経由回避) */
  setToastQueue(toastQueue: ToastQueue): void {
    this.toastQueue = toastQueue;
  }

  setElapsedTime(t: number): void {
    this.elapsedTime = t;
  }

  /** EntityFactory.createGate 完了時に呼ぶ */
  onGateCreated(gateId: EntityId, initialY: number): void {
    this.prevGateY.set(gateId, initialY);
  }

  /** CleanupSystem.disposeGateEntity から呼ぶ（Map リーク防止） */
  onGateDisposed(gateId: EntityId): void {
    this.prevGateY.delete(gateId);
    this.initialized.delete(gateId);
  }

  update(world: World, _dt: number): void {
    if (!this.enabled) return;

    const playerIds = world.query(PlayerComponent, PositionComponent);
    if (playerIds.length === 0) return;
    const playerId = playerIds[0];
    const playerPos = world.getComponent(playerId, PositionComponent)!;
    const playerY = playerPos.y;

    if (!this.playerInitialized) {
      this.prevPlayerY = playerY;
      this.playerInitialized = true;
      return;
    }

    const gateIds = world.query(GateComponent, PositionComponent);
    for (const gateId of gateIds) {
      const gate = world.getComponent(gateId, GateComponent)!;
      if (gate.consumed) continue;

      const gatePos = world.getComponent(gateId, PositionComponent)!;
      const gY = gatePos.y;
      const inXRange = Math.abs(gatePos.x - playerPos.x) < gate.widthHalf;

      const prevGY = this.prevGateY.get(gateId);
      if (prevGY === undefined || !this.initialized.has(gateId)) {
        this.prevGateY.set(gateId, gY);
        this.initialized.add(gateId);
        continue;
      }

      // ゲート Y がプレイヤー Y を跨いだか（前フレームとの相対符号変化）
      const crossed = (prevGY > this.prevPlayerY) !== (gY > playerY);
      if (inXRange && crossed) {
        this.trigger(world, gateId, gate);
        gate.consumed = true;
      }
      this.prevGateY.set(gateId, gY);
    }
    this.prevPlayerY = playerY;
  }

  reset(): void {
    this.prevPlayerY = 0;
    this.playerInitialized = false;
    this.prevGateY.clear();
    this.initialized.clear();
    this.elapsedTime = 0;
  }

  private trigger(world: World, gateId: EntityId, gate: GateComponent): void {
    if (!isValidGateAmount(gate.amount)) {
      this.eventLogger.error('gate_invalid_amount', {
        gateId, type: gate.type, amount: gate.amount,
      });
      return;
    }

    switch (gate.type) {
      case GateType.ALLY_ADD: {
        const current = world.query(AllyComponent).length;
        const max = GAME_CONFIG.ally.maxCount;
        const target = Math.floor(gate.amount);
        const added = Math.max(0, Math.min(target, max - current));
        for (let i = 0; i < added; i++) this.spawnManager.spawnAlly(world, this.elapsedTime);
        if (added === 0) {
          this.toastQueue?.push({ kind: 'MAX', text: I18N_TOAST.allyMax });
        } else {
          this.toastQueue?.push({ kind: 'GAIN', text: I18N_TOAST.allyGain(added) });
        }
        this.eventLogger.info('ally_add', { count: added, total: current + added });
        break;
      }
      case GateType.HEAL: {
        const playerIds = world.query(PlayerComponent);
        if (playerIds.length === 0) break;
        const health = world.getComponent(playerIds[0], HealthComponent);
        if (!health) break;
        const before = health.hp;
        health.hp = Math.min(health.hp + gate.amount, health.maxHp);
        const actual = health.hp - before;
        if (actual === 0) {
          this.toastQueue?.push({ kind: 'MAX', text: I18N_TOAST.healMax });
        } else {
          this.toastQueue?.push({ kind: 'GAIN', text: I18N_TOAST.healGain(Math.round(actual)) });
        }
        this.eventLogger.info('heal', { amount: actual, hp: health.hp, maxHp: health.maxHp });
        break;
      }
      case GateType.ATTACK_UP:
      case GateType.SPEED_UP: {
        const duration = gate.durationSec ?? 10;
        const buffType = gate.type === GateType.ATTACK_UP ? BuffType.ATTACK_UP : BuffType.SPEED_UP;
        const playerIds = world.query(PlayerComponent, BuffComponent);
        if (playerIds.length > 0) {
          const buff = world.getComponent(playerIds[0], BuffComponent)!;
          this.buffSystem.applyOrExtend(buff, buffType, duration);
        }
        this.toastQueue?.push({
          kind: 'BUFF',
          text: I18N_TOAST.buffGain(gate.type, Math.round(gate.amount)),
        });
        this.eventLogger.info('gate_trigger', {
          type: gate.type, amount: gate.amount, duration,
        });
        break;
      }
    }
  }
}
