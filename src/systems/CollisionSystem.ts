import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { BulletComponent } from '../components/BulletComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { PositionComponent } from '../components/PositionComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { HealthComponent } from '../components/HealthComponent';
import { EntityFactory } from '../factories/EntityFactory';
import { ScoreService } from '../game/ScoreService';
import { EffectType } from '../types';

/**
 * S-06: 衝突判定システム（優先度5）
 * business-logic-model セクション5
 */
export class CollisionSystem implements System {
  readonly priority = 5;
  private entityFactory: EntityFactory;
  private scoreService: ScoreService;

  constructor(entityFactory: EntityFactory, scoreService: ScoreService) {
    this.entityFactory = entityFactory;
    this.scoreService = scoreService;
  }

  update(world: World, _dt: number): void {
    const bulletIds = world.query(BulletComponent, PositionComponent, ColliderComponent);
    const enemyIds = world.query(EnemyComponent, PositionComponent, ColliderComponent, HealthComponent);

    for (const bulletId of bulletIds) {
      const bullet = world.getComponent(bulletId, BulletComponent)!;
      const bPos = world.getComponent(bulletId, PositionComponent)!;
      const bCol = world.getComponent(bulletId, ColliderComponent)!;

      for (const enemyId of enemyIds) {
        // 貫通弾: 同一敵への再ヒット防止（BR-W05）
        if (bullet.isPiercing && bullet.piercedEntities.has(enemyId)) continue;

        const ePos = world.getComponent(enemyId, PositionComponent)!;
        const eCol = world.getComponent(enemyId, ColliderComponent)!;

        if (this.checkCircleCollision(bPos, bCol.radius, ePos, eCol.radius)) {
          const eHealth = world.getComponent(enemyId, HealthComponent)!;
          const enemy = world.getComponent(enemyId, EnemyComponent)!;

          // ダメージ適用
          eHealth.hp -= bullet.damage;

          if (eHealth.hp <= 0) {
            // 敵撃破
            this.entityFactory.createEffect(world, EffectType.ENEMY_DESTROY, { x: ePos.x, y: ePos.y });
            this.entityFactory.createXPDrop(world, { x: ePos.x, y: ePos.y }, enemy.xpDrop);
            this.scoreService.incrementKills();
            world.destroyEntity(enemyId);
          }

          // 弾丸処理
          if (bullet.isPiercing) {
            bullet.piercedEntities.add(enemyId);
          } else {
            world.destroyEntity(bulletId);
            break; // この弾丸はもう存在しない
          }
        }
      }
    }
  }

  /** 円-円衝突判定（距離二乗比較で最適化） */
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
