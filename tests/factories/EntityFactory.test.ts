import { World } from '../../src/ecs/World';
import { EntityFactory } from '../../src/factories/EntityFactory';
import { PositionComponent } from '../../src/components/PositionComponent';
import { VelocityComponent } from '../../src/components/VelocityComponent';
import { SpriteComponent } from '../../src/components/SpriteComponent';
import { HealthComponent } from '../../src/components/HealthComponent';
import { ColliderComponent } from '../../src/components/ColliderComponent';
import { PlayerComponent } from '../../src/components/PlayerComponent';
import { EnemyComponent } from '../../src/components/EnemyComponent';
import { BulletComponent } from '../../src/components/BulletComponent';
import { WeaponComponent } from '../../src/components/WeaponComponent';
import { WeaponInventoryComponent } from '../../src/components/WeaponInventoryComponent';
import { AllyComponent } from '../../src/components/AllyComponent';
import { XPDropComponent } from '../../src/components/XPDropComponent';
import { EffectComponent } from '../../src/components/EffectComponent';
import { PassiveSkillsComponent } from '../../src/components/PassiveSkillsComponent';
import { EnemyType, WeaponType, EffectType, ColliderType } from '../../src/types';
import { GAME_CONFIG } from '../../src/config/gameConfig';

describe('EntityFactory', () => {
  let world: World;
  let factory: EntityFactory;

  beforeEach(() => {
    world = new World();
    factory = new EntityFactory();
  });

  describe('createPlayer', () => {
    it('should create entity with all required components', () => {
      const id = factory.createPlayer(world);

      expect(world.getComponent(id, PositionComponent)).toBeDefined();
      expect(world.getComponent(id, SpriteComponent)).toBeDefined();
      expect(world.getComponent(id, HealthComponent)).toBeDefined();
      expect(world.getComponent(id, ColliderComponent)).toBeDefined();
      expect(world.getComponent(id, PlayerComponent)).toBeDefined();
      expect(world.getComponent(id, PassiveSkillsComponent)).toBeDefined();
      expect(world.getComponent(id, WeaponInventoryComponent)).toBeDefined();
    });

    it('should set initial position from config', () => {
      const id = factory.createPlayer(world);
      const pos = world.getComponent(id, PositionComponent)!;
      expect(pos.x).toBe(GAME_CONFIG.player.startX);
      expect(pos.y).toBe(GAME_CONFIG.player.startY);
    });

    it('should set initial HP from config', () => {
      const id = factory.createPlayer(world);
      const health = world.getComponent(id, HealthComponent)!;
      expect(health.hp).toBe(GAME_CONFIG.player.baseHp);
      expect(health.maxHp).toBe(GAME_CONFIG.player.baseHp);
    });

    it('should have FORWARD weapon at level 1', () => {
      const id = factory.createPlayer(world);
      const inventory = world.getComponent(id, WeaponInventoryComponent)!;
      const weapon = inventory.findWeapon(WeaponType.FORWARD);
      expect(weapon).toBeDefined();
      expect(weapon!.level).toBe(1);
    });
  });

  describe('createEnemy', () => {
    it('should create entity with all required components', () => {
      const id = factory.createEnemy(world, EnemyType.NORMAL, { x: 100, y: 50 });

      expect(world.getComponent(id, PositionComponent)).toBeDefined();
      expect(world.getComponent(id, VelocityComponent)).toBeDefined();
      expect(world.getComponent(id, HealthComponent)).toBeDefined();
      expect(world.getComponent(id, ColliderComponent)).toBeDefined();
      expect(world.getComponent(id, EnemyComponent)).toBeDefined();
      expect(world.getComponent(id, SpriteComponent)).toBeDefined();
    });

    it('should set position correctly', () => {
      const id = factory.createEnemy(world, EnemyType.NORMAL, { x: 200, y: -30 });
      const pos = world.getComponent(id, PositionComponent)!;
      expect(pos.x).toBe(200);
      expect(pos.y).toBe(-30);
    });

    it('should apply HP multiplier', () => {
      const id = factory.createEnemy(world, EnemyType.NORMAL, { x: 100, y: 50 }, 2.0);
      const health = world.getComponent(id, HealthComponent)!;
      expect(health.hp).toBe(40); // NORMAL hp=20 * 2.0
    });

    it('should set correct enemy type', () => {
      const id = factory.createEnemy(world, EnemyType.FAST, { x: 100, y: 50 });
      const enemy = world.getComponent(id, EnemyComponent)!;
      expect(enemy.enemyType).toBe(EnemyType.FAST);
    });

    it('should use larger size for boss', () => {
      const id = factory.createEnemy(world, EnemyType.BOSS, { x: 100, y: 50 });
      const sprite = world.getComponent(id, SpriteComponent)!;
      expect(sprite.width).toBe(80);
      expect(sprite.height).toBe(80);
    });

    it('should use tank size for tank', () => {
      const id = factory.createEnemy(world, EnemyType.TANK, { x: 100, y: 50 });
      const sprite = world.getComponent(id, SpriteComponent)!;
      expect(sprite.width).toBe(40);
      expect(sprite.height).toBe(40);
    });
  });

  describe('createBoss', () => {
    it('should create entity with custom HP and damage', () => {
      const id = factory.createBoss(world, { x: 360, y: -50 }, 1000, 50, 300);

      const health = world.getComponent(id, HealthComponent)!;
      expect(health.hp).toBe(1000);
      expect(health.maxHp).toBe(1000);

      const enemy = world.getComponent(id, EnemyComponent)!;
      expect(enemy.breachDamage).toBe(50);
      expect(enemy.xpDrop).toBe(300);
      expect(enemy.enemyType).toBe(EnemyType.BOSS);
    });
  });

  describe('createBullet', () => {
    it('should create entity with all required components', () => {
      const id = factory.createBullet(world, { x: 100, y: 200 }, { vx: 0, vy: -600 }, 10, false, 1);

      expect(world.getComponent(id, PositionComponent)).toBeDefined();
      expect(world.getComponent(id, VelocityComponent)).toBeDefined();
      expect(world.getComponent(id, BulletComponent)).toBeDefined();
      expect(world.getComponent(id, ColliderComponent)).toBeDefined();
      expect(world.getComponent(id, SpriteComponent)).toBeDefined();
    });

    it('should set bullet properties correctly', () => {
      const id = factory.createBullet(world, { x: 100, y: 200 }, { vx: 0, vy: -600 }, 15, true, 42);

      const bullet = world.getComponent(id, BulletComponent)!;
      expect(bullet.damage).toBe(15);
      expect(bullet.isPiercing).toBe(true);
      expect(bullet.ownerId).toBe(42);
    });

    it('should set position and velocity correctly', () => {
      const id = factory.createBullet(world, { x: 100, y: 200 }, { vx: 50, vy: -600 }, 10, false, 1);

      const pos = world.getComponent(id, PositionComponent)!;
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(200);

      const vel = world.getComponent(id, VelocityComponent)!;
      expect(vel.vx).toBe(50);
      expect(vel.vy).toBe(-600);
    });
  });

  describe('createXPDrop', () => {
    it('should create entity with required components', () => {
      const id = factory.createXPDrop(world, { x: 300, y: 500 }, 25);

      expect(world.getComponent(id, PositionComponent)).toBeDefined();
      expect(world.getComponent(id, XPDropComponent)).toBeDefined();
      expect(world.getComponent(id, SpriteComponent)).toBeDefined();
    });

    it('should set XP amount correctly', () => {
      const id = factory.createXPDrop(world, { x: 300, y: 500 }, 25);
      const xp = world.getComponent(id, XPDropComponent)!;
      expect(xp.xpAmount).toBe(25);
    });
  });

  describe('createAlly', () => {
    it('should create entity with required components', () => {
      const playerId = factory.createPlayer(world);
      const id = factory.createAlly(world, playerId, 32);

      expect(world.getComponent(id, PositionComponent)).toBeDefined();
      expect(world.getComponent(id, AllyComponent)).toBeDefined();
      expect(world.getComponent(id, SpriteComponent)).toBeDefined();
      expect(world.getComponent(id, WeaponComponent)).toBeDefined();
    });

    it('should set ally offset and follow target', () => {
      const playerId = factory.createPlayer(world);
      const id = factory.createAlly(world, playerId, -32);

      const ally = world.getComponent(id, AllyComponent)!;
      expect(ally.offsetX).toBe(-32);
      expect(ally.followTarget).toBe(playerId);
    });

    it('should have FORWARD weapon at level 1', () => {
      const playerId = factory.createPlayer(world);
      const id = factory.createAlly(world, playerId, 32);

      const weapon = world.getComponent(id, WeaponComponent)!;
      expect(weapon.weaponType).toBe(WeaponType.FORWARD);
      expect(weapon.level).toBe(1);
    });
  });

  describe('createEffect', () => {
    it('should create muzzle flash effect', () => {
      const id = factory.createEffect(world, EffectType.MUZZLE_FLASH, { x: 100, y: 200 });

      expect(world.getComponent(id, PositionComponent)).toBeDefined();
      expect(world.getComponent(id, EffectComponent)).toBeDefined();
      expect(world.getComponent(id, SpriteComponent)).toBeDefined();

      const effect = world.getComponent(id, EffectComponent)!;
      expect(effect.effectType).toBe(EffectType.MUZZLE_FLASH);
      expect(effect.duration).toBe(0.1);
    });

    it('should create enemy destroy effect', () => {
      const id = factory.createEffect(world, EffectType.ENEMY_DESTROY, { x: 100, y: 200 });

      const effect = world.getComponent(id, EffectComponent)!;
      expect(effect.effectType).toBe(EffectType.ENEMY_DESTROY);
      expect(effect.duration).toBe(0.3);
    });
  });
});
