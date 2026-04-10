import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { EntityId } from '../ecs/Entity';
import { BulletComponent } from '../components/BulletComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { PositionComponent } from '../components/PositionComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { HitCountComponent } from '../components/HitCountComponent';
import { ItemDropComponent } from '../components/ItemDropComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { BuffComponent } from '../components/BuffComponent';
import { WeaponComponent } from '../components/WeaponComponent';
import { EntityFactory } from '../factories/EntityFactory';
import { AllyConversionSystem } from './AllyConversionSystem';
import { ScoreService } from '../game/ScoreService';
import { GAME_CONFIG } from '../config/gameConfig';
import { WEAPON_CONFIG } from '../config/weaponConfig';
import { EffectType, itemTypeToBuff, itemTypeToWeapon, ITEM_COLORS } from '../types';

/**
 * S-06: 衝突判定システム（優先度5）
 * business-logic-model セクション5
 * Iteration 2: ヒットカウント制・アイテム射撃破壊・仲間化
 */
export class CollisionSystem implements System {
  readonly priority = 5;
  private entityFactory: EntityFactory;
  private scoreService: ScoreService;
  private allyConversionSystem: AllyConversionSystem;

  constructor(
    entityFactory: EntityFactory,
    scoreService: ScoreService,
    allyConversionSystem: AllyConversionSystem,
  ) {
    this.entityFactory = entityFactory;
    this.scoreService = scoreService;
    this.allyConversionSystem = allyConversionSystem;
  }

  update(world: World, _dt: number): void {
    const bulletIds = world.query(BulletComponent, PositionComponent, ColliderComponent);
    const enemyIds = world.query(EnemyComponent, PositionComponent, ColliderComponent, HitCountComponent);
    const itemIds = world.query(ItemDropComponent, PositionComponent, ColliderComponent, HitCountComponent);

    // 撃破キュー: 衝突判定後にまとめて処理
    const defeatedEnemies: EntityId[] = [];
    const defeatedSet = new Set<EntityId>();

    // 破壊されたアイテムキュー
    const destroyedItems: EntityId[] = [];
    const destroyedItemSet = new Set<EntityId>();

    // 弾丸が破壊済みかのセット
    const destroyedBullets = new Set<EntityId>();

    for (const bulletId of bulletIds) {
      if (destroyedBullets.has(bulletId)) continue;

      const bullet = world.getComponent(bulletId, BulletComponent)!;
      const bPos = world.getComponent(bulletId, PositionComponent)!;
      const bCol = world.getComponent(bulletId, ColliderComponent)!;

      // 弾丸-敵 衝突判定
      let bulletDestroyed = false;
      for (const enemyId of enemyIds) {
        if (defeatedSet.has(enemyId)) continue;
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

      // 弾丸-アイテム 衝突判定（弾丸が破壊されていない場合のみ）
      if (!bulletDestroyed) {
        for (const itemId of itemIds) {
          if (destroyedItemSet.has(itemId)) continue;
          if (bullet.isPiercing && bullet.hitEntities.has(itemId)) continue;

          const iPos = world.getComponent(itemId, PositionComponent)!;
          const iCol = world.getComponent(itemId, ColliderComponent)!;

          if (this.checkCircleCollision(bPos, bCol.radius, iPos, iCol.radius)) {
            const hitCount = world.getComponent(itemId, HitCountComponent)!;
            hitCount.currentHits -= bullet.hitCountReduction;
            hitCount.flashTimer = 0.1;

            if (hitCount.currentHits <= 0) {
              destroyedItems.push(itemId);
              destroyedItemSet.add(itemId);
            }

            if (bullet.isPiercing) {
              bullet.hitEntities.add(itemId);
            } else {
              world.destroyEntity(bulletId);
              destroyedBullets.add(bulletId);
              break;
            }
          }
        }
      }
    }

    // 撃破キュー消費（敵）
    for (const enemyId of defeatedEnemies) {
      const ePos = world.getComponent(enemyId, PositionComponent);
      const enemy = world.getComponent(enemyId, EnemyComponent);
      if (!ePos || !enemy) continue;

      const position = { x: ePos.x, y: ePos.y };

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

    // 破壊キュー消費（アイテム）— バフ/武器効果を適用
    if (destroyedItems.length > 0) {
      const playerIds = world.query(PlayerComponent);
      if (playerIds.length > 0) {
        const playerId = playerIds[0];
        const buff = world.getComponent(playerId, BuffComponent);
        const weapon = world.getComponent(playerId, WeaponComponent);

        for (const itemId of destroyedItems) {
          const iPos = world.getComponent(itemId, PositionComponent);
          const itemDrop = world.getComponent(itemId, ItemDropComponent);
          if (!iPos || !itemDrop) continue;

          const position = { x: iPos.x, y: iPos.y };

          // パワーアップアイテム → バフ適用
          const buffType = itemTypeToBuff(itemDrop.itemType);
          if (buffType !== null && buff) {
            buff.applyBuff(buffType, GAME_CONFIG.buff.duration);
          }

          // 武器アイテム → 武器切り替え
          const weaponType = itemTypeToWeapon(itemDrop.itemType);
          if (weaponType !== null && weapon) {
            const weaponCfg = WEAPON_CONFIG[weaponType];
            if (weaponCfg) {
              weapon.weaponType = weaponType;
              weapon.fireInterval = weaponCfg.fireInterval;
            }
          }

          // バフ発動エフェクト
          const color = ITEM_COLORS[itemDrop.itemType] ?? '#FFFFFF';
          this.entityFactory.createEffect(world, EffectType.BUFF_ACTIVATE, position, color);

          // アイテムエンティティ破棄
          world.destroyEntity(itemId);
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
