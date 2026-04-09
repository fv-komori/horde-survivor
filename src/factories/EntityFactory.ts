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
import { WeaponInventoryComponent } from '../components/WeaponInventoryComponent';
import { AllyComponent } from '../components/AllyComponent';
import { XPDropComponent } from '../components/XPDropComponent';
import { EffectComponent } from '../components/EffectComponent';
import { PassiveSkillsComponent } from '../components/PassiveSkillsComponent';
import { GAME_CONFIG } from '../config/gameConfig';
import { ENEMY_CONFIG } from '../config/enemyConfig';
import { WEAPON_CONFIG } from '../config/weaponConfig';
import { EnemyType, WeaponType, EffectType, ColliderType } from '../types';
import type { Position, SpriteType } from '../types';

/**
 * S-SVC-03: エンティティ生成ファクトリ
 * コンポーネントの組み合わせをカプセル化
 */
export class EntityFactory {

  /** プレイヤーエンティティを生成（domain-entities E-01） */
  createPlayer(world: World): EntityId {
    const id = world.createEntity();
    const cfg = GAME_CONFIG.player;

    world.addComponent(id, new PositionComponent(cfg.startX, cfg.startY));
    world.addComponent(id, new SpriteComponent('player', 192, 192, '#00FF00'));
    world.addComponent(id, new HealthComponent(cfg.baseHp, cfg.baseHp));
    world.addComponent(id, new ColliderComponent(cfg.colliderRadius, ColliderType.PLAYER));
    world.addComponent(id, new PlayerComponent(cfg.baseSpeed));
    world.addComponent(id, new PassiveSkillsComponent());

    // 武器インベントリ（初期武器: FORWARD Lv1）
    const inventory = new WeaponInventoryComponent();
    inventory.addWeapon(WeaponType.FORWARD, 1);
    world.addComponent(id, inventory);

    return id;
  }

  /** 敵エンティティを生成（domain-entities E-02） */
  createEnemy(world: World, type: EnemyType, position: Position, hpMultiplier: number = 1.0): EntityId {
    const id = world.createEntity();
    const cfg = ENEMY_CONFIG[type];

    const hp = Math.round(cfg.hp * hpMultiplier);
    world.addComponent(id, new PositionComponent(position.x, position.y));
    world.addComponent(id, new VelocityComponent(0, cfg.speed));
    world.addComponent(id, new HealthComponent(hp, hp));
    world.addComponent(id, new ColliderComponent(cfg.colliderRadius, ColliderType.ENEMY));
    world.addComponent(id, new EnemyComponent(type, cfg.breachDamage, cfg.xpDrop));

    // スプライトタイプを敵タイプに応じて設定
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

  /** ボスエンティティを生成（BR-E03: スケーリング適用済みHP/ダメージ） */
  createBoss(world: World, position: Position, hp: number, damage: number, xpDrop: number): EntityId {
    const id = world.createEntity();
    const cfg = ENEMY_CONFIG[EnemyType.BOSS];

    world.addComponent(id, new PositionComponent(position.x, position.y));
    world.addComponent(id, new VelocityComponent(0, cfg.speed));
    world.addComponent(id, new HealthComponent(hp, hp));
    world.addComponent(id, new ColliderComponent(cfg.colliderRadius, ColliderType.ENEMY));
    world.addComponent(id, new EnemyComponent(EnemyType.BOSS, damage, xpDrop));
    world.addComponent(id, new SpriteComponent('enemy_boss', 280, 280, '#FF0000'));

    return id;
  }

  /** 弾丸エンティティを生成（domain-entities E-03） */
  createBullet(
    world: World,
    origin: Position,
    velocity: { vx: number; vy: number },
    damage: number,
    piercing: boolean,
    ownerId: EntityId,
  ): EntityId {
    const id = world.createEntity();

    world.addComponent(id, new PositionComponent(origin.x, origin.y));
    world.addComponent(id, new VelocityComponent(velocity.vx, velocity.vy));
    world.addComponent(id, new BulletComponent(damage, piercing, ownerId));
    world.addComponent(id, new ColliderComponent(GAME_CONFIG.bullet.colliderRadius, ColliderType.BULLET));
    world.addComponent(id, new SpriteComponent('bullet', 16, 16, '#FFFF00'));

    return id;
  }

  /** XPドロップエンティティを生成（domain-entities E-04） */
  createXPDrop(world: World, position: Position, amount: number): EntityId {
    const id = world.createEntity();

    world.addComponent(id, new PositionComponent(position.x, position.y));
    world.addComponent(id, new XPDropComponent(amount));
    world.addComponent(id, new SpriteComponent('xp_drop', 12, 12, '#00FFFF'));

    return id;
  }

  /** 仲間エンティティを生成（domain-entities E-05） */
  createAlly(world: World, playerEntity: EntityId, offsetX: number): EntityId {
    const id = world.createEntity();

    world.addComponent(id, new PositionComponent(0, 0)); // AllyFollowSystemで更新
    world.addComponent(id, new AllyComponent(offsetX, playerEntity));
    world.addComponent(id, new SpriteComponent('ally', 150, 150, '#00CC00'));

    // 仲間の武器: 前方射撃Lv1固定（BR-A03）
    const weaponCfg = WEAPON_CONFIG[WeaponType.FORWARD].levels[0];
    world.addComponent(id, new WeaponComponent(WeaponType.FORWARD, 1, weaponCfg.fireInterval));

    return id;
  }

  /** エフェクトエンティティを生成（domain-entities E-06, NFR-04） */
  createEffect(world: World, type: EffectType, position: Position): EntityId {
    const id = world.createEntity();

    const isMuzzle = type === EffectType.MUZZLE_FLASH;
    const duration = isMuzzle ? 0.1 : 0.3;
    const totalFrames = isMuzzle ? 2 : 4;
    const frameInterval = duration / totalFrames;
    const spriteType = isMuzzle ? 'effect_muzzle' as const : 'effect_destroy' as const;
    const size = isMuzzle ? 16 : 32;
    const color = isMuzzle ? '#FFFF88' : '#FF8800';

    world.addComponent(id, new PositionComponent(position.x, position.y));
    world.addComponent(id, new EffectComponent(type, duration, totalFrames, frameInterval));
    world.addComponent(id, new SpriteComponent(spriteType, size, size, color));

    return id;
  }
}
