import type { EntityId } from '../ecs/Entity';
import type { World } from '../ecs/World';
import { PositionComponent } from '../components/PositionComponent';
import { VelocityComponent } from '../components/VelocityComponent';
import { SpriteComponent } from '../components/SpriteComponent';
import { HealthComponent } from '../components/HealthComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { BulletComponent } from '../components/BulletComponent';
import { WeaponComponent } from '../components/WeaponComponent';
import { AllyComponent } from '../components/AllyComponent';
import { HitCountComponent } from '../components/HitCountComponent';
import { ItemDropComponent } from '../components/ItemDropComponent';
import { BuffComponent } from '../components/BuffComponent';
import { EffectComponent } from '../components/EffectComponent';
import { GAME_CONFIG } from '../config/gameConfig';
import { ENEMY_CONFIG } from '../config/enemyConfig';
import { WEAPON_CONFIG } from '../config/weaponConfig';
import { EnemyType, WeaponType, EffectType, ItemType, ColliderType, ITEM_COLORS } from '../types';
import type { Position, SpriteType } from '../types';

/**
 * S-SVC-03: エンティティ生成ファクトリ（Iteration 2）
 */
export class EntityFactory {

  /** プレイヤーエンティティを生成（E-01） */
  createPlayer(world: World): EntityId {
    const id = world.createEntity();
    const cfg = GAME_CONFIG.player;

    world.addComponent(id, new PositionComponent(cfg.startX, cfg.startY));
    world.addComponent(id, new SpriteComponent('player', 192, 192, '#00FF00'));
    world.addComponent(id, new HealthComponent(cfg.baseHp, cfg.baseHp));
    world.addComponent(id, new ColliderComponent(cfg.colliderRadius, ColliderType.PLAYER));
    world.addComponent(id, new PlayerComponent(cfg.baseSpeed));
    world.addComponent(id, new BuffComponent());

    // 単一武器: FORWARD（BR-W02）
    const weaponCfg = WEAPON_CONFIG[WeaponType.FORWARD];
    world.addComponent(id, new WeaponComponent(WeaponType.FORWARD, weaponCfg.fireInterval));

    return id;
  }

  /** 敵エンティティを生成（E-02, BR-HC04: ヒット数スケーリング適用） */
  createEnemy(world: World, type: EnemyType, position: Position, hitCountMultiplier: number = 1.0): EntityId {
    const id = world.createEntity();
    const cfg = ENEMY_CONFIG[type];

    const actualHitCount = Math.ceil(cfg.hitCount * hitCountMultiplier);
    world.addComponent(id, new PositionComponent(position.x, position.y));
    world.addComponent(id, new VelocityComponent(0, cfg.speed));
    world.addComponent(id, new HitCountComponent(actualHitCount, actualHitCount));
    world.addComponent(id, new ColliderComponent(cfg.colliderRadius, ColliderType.ENEMY));
    world.addComponent(id, new EnemyComponent(
      type, cfg.breachDamage, cfg.itemDropRate, cfg.weaponDropRate, cfg.conversionRate,
    ));

    const spriteMap: Record<string, SpriteType> = {
      [EnemyType.NORMAL]: 'enemy_normal',
      [EnemyType.FAST]: 'enemy_fast',
      [EnemyType.TANK]: 'enemy_tank',
      [EnemyType.BOSS]: 'enemy_boss',
    };
    const spriteType = spriteMap[type] ?? 'enemy_normal';
    const size = type === EnemyType.BOSS ? 280 : type === EnemyType.TANK ? 200 : 150;
    const colors: Record<string, string> = {
      [EnemyType.NORMAL]: '#FF4444',
      [EnemyType.FAST]: '#FFAA00',
      [EnemyType.TANK]: '#884488',
      [EnemyType.BOSS]: '#FF0000',
    };
    world.addComponent(id, new SpriteComponent(spriteType, size, size, colors[type] ?? '#FF4444'));

    return id;
  }

  /** 弾丸エンティティを生成（E-03） */
  createBullet(
    world: World,
    origin: Position,
    velocity: { vx: number; vy: number },
    hitCountReduction: number,
    piercing: boolean,
    ownerId: EntityId,
  ): EntityId {
    const id = world.createEntity();

    world.addComponent(id, new PositionComponent(origin.x, origin.y));
    world.addComponent(id, new VelocityComponent(velocity.vx, velocity.vy));
    world.addComponent(id, new BulletComponent(hitCountReduction, piercing, ownerId));
    world.addComponent(id, new ColliderComponent(GAME_CONFIG.bullet.colliderRadius, ColliderType.BULLET));
    world.addComponent(id, new SpriteComponent('bullet', 16, 16, '#FFFF00'));

    return id;
  }

  /** アイテムドロップエンティティを生成（E-04: 画面上部から降下、射撃で破壊） */
  createItemDrop(world: World, position: Position, itemType: ItemType): EntityId {
    const id = world.createEntity();
    const cfg = GAME_CONFIG.itemSpawn;

    world.addComponent(id, new PositionComponent(position.x, position.y));
    world.addComponent(id, new VelocityComponent(0, cfg.speed));
    world.addComponent(id, new HitCountComponent(cfg.hitCount, cfg.hitCount));
    world.addComponent(id, new ItemDropComponent(itemType, Infinity));
    world.addComponent(id, new ColliderComponent(cfg.colliderRadius, ColliderType.ITEM));

    const color = ITEM_COLORS[itemType] ?? '#FFFFFF';
    world.addComponent(id, new SpriteComponent('item_drop', cfg.spriteSize, cfg.spriteSize, color));

    return id;
  }

  /** 仲間エンティティを生成（E-05） */
  createAlly(world: World, playerEntity: EntityId, allyIndex: number, elapsedTime: number): EntityId {
    const id = world.createEntity();

    world.addComponent(id, new PositionComponent(0, 0)); // AllyFollowSystemで更新
    world.addComponent(id, new AllyComponent(allyIndex, playerEntity, elapsedTime));
    world.addComponent(id, new SpriteComponent('ally', 150, 150, '#00CC00'));

    // 仲間の武器: FORWARD固定（BR-AL03）
    const weaponCfg = WEAPON_CONFIG[WeaponType.FORWARD];
    world.addComponent(id, new WeaponComponent(WeaponType.FORWARD, weaponCfg.fireInterval));

    return id;
  }

  /** エフェクトエンティティを生成（E-06） */
  createEffect(world: World, type: EffectType, position: Position, color?: string): EntityId {
    const id = world.createEntity();

    let duration: number;
    let totalFrames: number;
    let spriteType: SpriteType;
    let size: number;
    let effectColor: string;

    switch (type) {
      case EffectType.MUZZLE_FLASH:
        duration = 0.1;
        totalFrames = 2;
        spriteType = 'effect_muzzle';
        size = 16;
        effectColor = '#FFFF88';
        break;
      case EffectType.ENEMY_DESTROY:
        duration = 0.3;
        totalFrames = 4;
        spriteType = 'effect_destroy';
        size = 32;
        effectColor = '#FF8800';
        break;
      case EffectType.BUFF_ACTIVATE:
        duration = GAME_CONFIG.buff.effectDuration;
        totalFrames = 3;
        spriteType = 'effect_buff';
        size = GAME_CONFIG.buff.effectMaxRadius * 2;
        effectColor = color ?? '#FFFFFF';
        break;
      case EffectType.ALLY_CONVERT:
        duration = GAME_CONFIG.allyConversion.shrinkDuration + GAME_CONFIG.allyConversion.appearDuration;
        totalFrames = 4;
        spriteType = 'effect_ally_convert';
        size = 48;
        effectColor = color ?? '#00CC00';
        break;
    }

    const frameInterval = duration / totalFrames;
    world.addComponent(id, new PositionComponent(position.x, position.y));
    world.addComponent(id, new EffectComponent(type, duration, totalFrames, frameInterval));
    world.addComponent(id, new SpriteComponent(spriteType, size, size, effectColor));

    return id;
  }
}
