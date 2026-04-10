import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { EntityId } from '../ecs/Entity';
import { BulletComponent } from '../components/BulletComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { PositionComponent } from '../components/PositionComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { HitCountComponent } from '../components/HitCountComponent';
import { ItemDropComponent } from '../components/ItemDropComponent';
import { EntityFactory } from '../factories/EntityFactory';
import { ItemDropManager } from '../managers/ItemDropManager';
import { AllyConversionSystem } from './AllyConversionSystem';
import { ScoreService } from '../game/ScoreService';
import { EffectType } from '../types';

/**
 * S-06: 衝突判定システム（優先度5）
 * business-logic-model セクション5
 * Iteration 2: ヒットカウント制・アイテムドロップ・仲間化
 */
export class CollisionSystem implements System {
  readonly priority = 5;
  private entityFactory: EntityFactory;
  private scoreService: ScoreService;
  private itemDropManager: ItemDropManager;
  private allyConversionSystem: AllyConversionSystem;

  constructor(
    entityFactory: EntityFactory,
    scoreService: ScoreService,
    itemDropManager: ItemDropManager,
    allyConversionSystem: AllyConversionSystem,
  ) {
    this.entityFactory = entityFactory;
    this.scoreService = scoreService;
    this.itemDropManager = itemDropManager;
    this.allyConversionSystem = allyConversionSystem;
  }

  update(world: World, _dt: number): void {
    const bulletIds = world.query(BulletComponent, PositionComponent, ColliderComponent);
    const enemyIds = world.query(EnemyComponent, PositionComponent, ColliderComponent, HitCountComponent);

    // 撃破キュー: 衝突判定後にまとめて処理
    const defeatedEnemies: EntityId[] = [];
    const defeatedSet = new Set<EntityId>();

    for (const bulletId of bulletIds) {
      const bullet = world.getComponent(bulletId, BulletComponent)!;
      const bPos = world.getComponent(bulletId, PositionComponent)!;
      const bCol = world.getComponent(bulletId, ColliderComponent)!;

      for (const enemyId of enemyIds) {
        // 既に撃破キューに入っている敵はスキップ
        if (defeatedSet.has(enemyId)) continue;

        // 貫通弾: 同一敵への再ヒット防止（BR-W05）
        if (bullet.isPiercing && bullet.hitEntities.has(enemyId)) continue;

        const ePos = world.getComponent(enemyId, PositionComponent)!;
        const eCol = world.getComponent(enemyId, ColliderComponent)!;

        if (this.checkCircleCollision(bPos, bCol.radius, ePos, eCol.radius)) {
          const hitCount = world.getComponent(enemyId, HitCountComponent)!;

          // ヒットカウント減算
          hitCount.currentHits -= bullet.hitCountReduction;

          // 被弾フラッシュ
          hitCount.flashTimer = 0.1;

          // 撃破判定
          if (hitCount.currentHits <= 0) {
            defeatedEnemies.push(enemyId);
            defeatedSet.add(enemyId);
          }

          // 弾丸処理
          if (bullet.isPiercing) {
            bullet.hitEntities.add(enemyId);
          } else {
            world.destroyEntity(bulletId);
            break; // この弾丸はもう存在しない
          }
        }
      }
    }

    // 撃破キュー消費
    const currentItemCount = world.query(ItemDropComponent).length;
    let itemCount = currentItemCount;

    for (const enemyId of defeatedEnemies) {
      const ePos = world.getComponent(enemyId, PositionComponent);
      const enemy = world.getComponent(enemyId, EnemyComponent);
      if (!ePos || !enemy) continue;

      const position = { x: ePos.x, y: ePos.y };

      // アイテムドロップ判定
      const drops = this.itemDropManager.determineDrops(enemy.enemyType, itemCount);
      for (const itemType of drops) {
        this.entityFactory.createItemDrop(world, position, itemType);
        itemCount++;
      }

      // 仲間化判定
      this.allyConversionSystem.tryConvertToAlly(
        world,
        enemyId,
        position,
        this.scoreService.getElapsedTime(),
      );

      // スコア加算
      this.scoreService.incrementKills();

      // 撃破エフェクト
      this.entityFactory.createEffect(world, EffectType.ENEMY_DESTROY, position);

      // 敵エンティティ破棄
      world.destroyEntity(enemyId);
    }

    // キュークリア（ローカル変数なので自動）
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
