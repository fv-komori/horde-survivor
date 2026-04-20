import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { EntityId } from '../ecs/Entity';
import { BulletComponent } from '../components/BulletComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { PositionComponent } from '../components/PositionComponent';
import { VelocityComponent } from '../components/VelocityComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { HitCountComponent } from '../components/HitCountComponent';
import { EntityFactory } from '../factories/EntityFactory';
import { AnimationSystem } from './AnimationSystem';
import { ScoreService } from '../game/ScoreService';
import { AnimationStateComponent } from '../components/AnimationStateComponent';
import type { AudioManager } from '../audio/AudioManager';
import { EffectType } from '../types';

/**
 * S-06: 衝突判定システム（優先度5）
 * Iter6 Phase 2a: 旧アイテム射撃破壊ロジックと仲間化（AllyConversion）を削除
 */
export class CollisionSystem implements System {
  readonly priority = 5;
  private entityFactory: EntityFactory;
  private scoreService: ScoreService;
  private audioManager: AudioManager;
  private animationSystem: AnimationSystem | null;

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

  update(world: World, _dt: number): void {
    const bulletIds = world.query(BulletComponent, PositionComponent, ColliderComponent);
    const enemyIds = world.query(EnemyComponent, PositionComponent, ColliderComponent, HitCountComponent);

    const defeatedEnemies: EntityId[] = [];
    const defeatedSet = new Set<EntityId>();
    const destroyedBullets = new Set<EntityId>();

    for (const bulletId of bulletIds) {
      if (destroyedBullets.has(bulletId)) continue;

      const bullet = world.getComponent(bulletId, BulletComponent)!;
      const bPos = world.getComponent(bulletId, PositionComponent)!;
      const bCol = world.getComponent(bulletId, ColliderComponent)!;

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
            break;
          }
        }
      }
    }

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
