import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { EntityId } from '../ecs/Entity';
import { BulletComponent } from '../components/BulletComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { PositionComponent } from '../components/PositionComponent';
import { VelocityComponent } from '../components/VelocityComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { HitCountComponent } from '../components/HitCountComponent';
import { BarrelItemComponent } from '../components/BarrelItemComponent';
import { EntityFactory } from '../factories/EntityFactory';
import { AnimationSystem } from './AnimationSystem';
import type { WeaponSwitchSystem } from './WeaponSwitchSystem';
import { ScoreService } from '../game/ScoreService';
import { AnimationStateComponent } from '../components/AnimationStateComponent';
import type { AudioManager } from '../audio/AudioManager';
import { EffectType } from '../types';

/**
 * S-06: 衝突判定システム（priority 5）
 * Iter6 Phase 4: BULLET↔BARREL 衝突を追加、HP=0 で WeaponSwitchSystem.enqueueSwitch を呼ぶ。
 */
export class CollisionSystem implements System {
  readonly priority = 5;
  private readonly entityFactory: EntityFactory;
  private readonly scoreService: ScoreService;
  private readonly audioManager: AudioManager;
  private readonly animationSystem: AnimationSystem | null;
  private weaponSwitchSystem: WeaponSwitchSystem | null = null;

  constructor(
    entityFactory: EntityFactory,
    scoreService: ScoreService,
    audioManager: AudioManager,
    animationSystem: AnimationSystem | null = null,
  ) {
    this.entityFactory = entityFactory;
    this.scoreService = scoreService;
    this.audioManager = audioManager;
    this.animationSystem = animationSystem;
  }

  setWeaponSwitchSystem(ws: WeaponSwitchSystem): void {
    this.weaponSwitchSystem = ws;
  }

  update(world: World, _dt: number): void {
    const bulletIds = world.query(BulletComponent, PositionComponent, ColliderComponent);
    const enemyIds = world.query(EnemyComponent, PositionComponent, ColliderComponent, HitCountComponent);
    const barrelIds = world.query(BarrelItemComponent, PositionComponent, ColliderComponent);

    const defeatedEnemies: EntityId[] = [];
    const defeatedSet = new Set<EntityId>();
    const destroyedBullets = new Set<EntityId>();
    const destroyedBarrels = new Set<EntityId>();

    for (const bulletId of bulletIds) {
      if (destroyedBullets.has(bulletId)) continue;

      const bullet = world.getComponent(bulletId, BulletComponent)!;
      const bPos = world.getComponent(bulletId, PositionComponent)!;
      const bCol = world.getComponent(bulletId, ColliderComponent)!;

      let bulletDestroyed = false;

      // --- 弾 vs 敵 ---
      for (const enemyId of enemyIds) {
        if (defeatedSet.has(enemyId)) continue;
        const enemyAnim = world.getComponent(enemyId, AnimationStateComponent);
        if (enemyAnim?.current === 'Death') continue;
        if (bullet.isPiercing && bullet.hitEntities.has(enemyId)) continue;

        const ePos = world.getComponent(enemyId, PositionComponent)!;
        const eCol = world.getComponent(enemyId, ColliderComponent)!;

        if (this.checkCircleCollision(bPos, bCol.radius, ePos, eCol.radius)) {
          const hitCount = world.getComponent(enemyId, HitCountComponent)!;
          hitCount.currentHits -= bullet.hitCountReduction;
          hitCount.flashTimer = 0.1;

          if (hitCount.currentHits <= 0) {
            defeatedEnemies.push(enemyId);
            defeatedSet.add(enemyId);
          } else {
            this.animationSystem?.playHitReact(world, enemyId);
          }

          if (bullet.isPiercing) {
            bullet.hitEntities.add(enemyId);
          } else {
            world.destroyEntity(bulletId);
            destroyedBullets.add(bulletId);
            bulletDestroyed = true;
            break;
          }
        }
      }

      if (bulletDestroyed) continue;

      // --- 弾 vs 樽（Iter6） ---
      for (const barrelId of barrelIds) {
        if (destroyedBarrels.has(barrelId)) continue;
        if (bullet.isPiercing && bullet.hitEntities.has(barrelId)) continue;

        const bpos2 = world.getComponent(barrelId, PositionComponent)!;
        const bcol2 = world.getComponent(barrelId, ColliderComponent)!;
        if (!this.checkCircleCollision(bPos, bCol.radius, bpos2, bcol2.radius)) continue;

        const barrel = world.getComponent(barrelId, BarrelItemComponent)!;
        const hc = world.getComponent(barrelId, HitCountComponent);
        barrel.hp -= bullet.hitCountReduction;
        if (hc) {
          hc.currentHits = barrel.hp;
          hc.flashTimer = 0.1;
        }

        if (barrel.hp <= 0) {
          destroyedBarrels.add(barrelId);
          this.weaponSwitchSystem?.enqueueSwitch(barrelId, barrel.type);
        }

        if (bullet.isPiercing) {
          bullet.hitEntities.add(barrelId);
        } else {
          world.destroyEntity(bulletId);
          destroyedBullets.add(bulletId);
          break;
        }
      }
    }

    // 敵撃破キュー消費
    for (const enemyId of defeatedEnemies) {
      const ePos = world.getComponent(enemyId, PositionComponent);
      const enemy = world.getComponent(enemyId, EnemyComponent);
      if (!ePos || !enemy) continue;

      const position = { x: ePos.x, y: ePos.y };
      this.scoreService.incrementKills();
      this.audioManager.playSE('enemy_destroy');
      this.entityFactory.createEffect(world, EffectType.ENEMY_DESTROY, position);

      const hasAnim = world.getComponent(enemyId, AnimationStateComponent) != null;
      if (hasAnim && this.animationSystem) {
        this.animationSystem.playDeath(world, enemyId);
        const vel = world.getComponent(enemyId, VelocityComponent);
        if (vel) { vel.vx = 0; vel.vy = 0; }
      } else {
        world.destroyEntity(enemyId);
      }
    }

    // 樽破壊後の entity 破棄は WeaponSwitchSystem 側に委ねる（transferWeaponMesh が mesh 参照を必要とするため）
  }

  checkCircleCollision(
    a: { x: number; y: number }, aRadius: number,
    b: { x: number; y: number }, bRadius: number,
  ): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const distSq = dx * dx + dy * dy;
    const radiusSum = aRadius + bRadius;
    return distSq < radiusSum * radiusSum;
  }
}
