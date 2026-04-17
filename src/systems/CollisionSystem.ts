import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { EntityId } from '../ecs/Entity';
import { BulletComponent } from '../components/BulletComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { PositionComponent } from '../components/PositionComponent';
import { VelocityComponent } from '../components/VelocityComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { HitCountComponent } from '../components/HitCountComponent';
import { ItemDropComponent } from '../components/ItemDropComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { BuffComponent } from '../components/BuffComponent';
import { WeaponComponent } from '../components/WeaponComponent';
import { EntityFactory } from '../factories/EntityFactory';
import { AllyConversionSystem } from './AllyConversionSystem';
import { AnimationSystem } from './AnimationSystem';
import { ScoreService } from '../game/ScoreService';
import { AnimationStateComponent } from '../components/AnimationStateComponent';
import type { AudioManager } from '../audio/AudioManager';
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
  private audioManager: AudioManager;
  private animationSystem: AnimationSystem | null;

  constructor(
    entityFactory: EntityFactory,
    scoreService: ScoreService,
    allyConversionSystem: AllyConversionSystem,
    audioManager: AudioManager,
    animationSystem: AnimationSystem | null = null,
  ) {
    this.entityFactory = entityFactory;
    this.scoreService = scoreService;
    this.allyConversionSystem = allyConversionSystem;
    this.audioManager = audioManager;
    this.animationSystem = animationSystem;
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
        // Iter5: 既に Death anim 再生中の敵は当たり判定から除外
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
            // Iter5: 被弾 HitReact ワンショット
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

      // 敵撃破SE（BR-EV01）
      this.audioManager.playSE('enemy_destroy');

      // 撃破エフェクト
      this.entityFactory.createEffect(world, EffectType.ENEMY_DESTROY, position);

      // Iter5: AnimationStateComponent を持つ敵は Death anim を再生し、
      //        deathComplete になるまで破棄を CleanupSystem に委ねる
      const hasAnim = world.getComponent(enemyId, AnimationStateComponent) != null;
      if (hasAnim && this.animationSystem) {
        this.animationSystem.playDeath(world, enemyId);
        const vel = world.getComponent(enemyId, VelocityComponent);
        if (vel) { vel.vx = 0; vel.vy = 0; }
      } else {
        world.destroyEntity(enemyId);
      }
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

          // アイテム破壊SE（BR-EV01）
          this.audioManager.playSE('item_destroy');

          // パワーアップアイテム → バフ適用
          const buffType = itemTypeToBuff(itemDrop.itemType);
          if (buffType !== null && buff) {
            buff.applyBuff(buffType, GAME_CONFIG.buff.duration);
            // バフ発動SE（BR-EV01）
            this.audioManager.playSE('buff_activate');
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
