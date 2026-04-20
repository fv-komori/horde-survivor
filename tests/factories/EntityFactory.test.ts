import { World } from '../../src/ecs/World';
import { EntityFactory } from '../../src/factories/EntityFactory';
import { PositionComponent } from '../../src/components/PositionComponent';
import { VelocityComponent } from '../../src/components/VelocityComponent';
import { MeshComponent } from '../../src/components/MeshComponent';
import { HealthComponent } from '../../src/components/HealthComponent';
import { ColliderComponent } from '../../src/components/ColliderComponent';
import { PlayerComponent } from '../../src/components/PlayerComponent';
import { EnemyComponent } from '../../src/components/EnemyComponent';
import { BulletComponent } from '../../src/components/BulletComponent';
import { WeaponComponent } from '../../src/components/WeaponComponent';
import { AllyComponent } from '../../src/components/AllyComponent';
import { HitCountComponent } from '../../src/components/HitCountComponent';
import { BuffComponent } from '../../src/components/BuffComponent';
import { EffectComponent } from '../../src/components/EffectComponent';
import { EnemyType, WeaponType, EffectType } from '../../src/types';
import { GAME_CONFIG } from '../../src/config/gameConfig';
import { ENEMY_CONFIG } from '../../src/config/enemyConfig';
import { WEAPON_CONFIG } from '../../src/config/weaponConfig';

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
      expect(world.getComponent(id, MeshComponent)).toBeDefined();
      expect(world.getComponent(id, HealthComponent)).toBeDefined();
      expect(world.getComponent(id, ColliderComponent)).toBeDefined();
      expect(world.getComponent(id, PlayerComponent)).toBeDefined();
      expect(world.getComponent(id, BuffComponent)).toBeDefined();
      expect(world.getComponent(id, WeaponComponent)).toBeDefined();
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

    it('should have FORWARD weapon with correct fire interval', () => {
      const id = factory.createPlayer(world);
      const weapon = world.getComponent(id, WeaponComponent)!;
      expect(weapon.weaponType).toBe(WeaponType.FORWARD);
      expect(weapon.fireInterval).toBe(WEAPON_CONFIG[WeaponType.FORWARD].fireInterval);
    });

    it('should have empty BuffComponent', () => {
      const id = factory.createPlayer(world);
      const buffs = world.getComponent(id, BuffComponent)!;
      expect(buffs.activeBuffs.size).toBe(0);
    });
  });

  describe('createEnemy', () => {
    it('should create entity with all required components', () => {
      const id = factory.createEnemy(world, EnemyType.NORMAL, { x: 100, y: 50 });

      expect(world.getComponent(id, PositionComponent)).toBeDefined();
      expect(world.getComponent(id, VelocityComponent)).toBeDefined();
      expect(world.getComponent(id, HitCountComponent)).toBeDefined();
      expect(world.getComponent(id, ColliderComponent)).toBeDefined();
      expect(world.getComponent(id, EnemyComponent)).toBeDefined();
      expect(world.getComponent(id, MeshComponent)).toBeDefined();
    });

    it('should set position correctly', () => {
      const id = factory.createEnemy(world, EnemyType.NORMAL, { x: 200, y: -30 });
      const pos = world.getComponent(id, PositionComponent)!;
      expect(pos.x).toBe(200);
      expect(pos.y).toBe(-30);
    });

    it('should set base hit count from config', () => {
      const id = factory.createEnemy(world, EnemyType.NORMAL, { x: 100, y: 50 });
      const hitCount = world.getComponent(id, HitCountComponent)!;
      expect(hitCount.currentHits).toBe(ENEMY_CONFIG.NORMAL.hitCount);
      expect(hitCount.maxHits).toBe(ENEMY_CONFIG.NORMAL.hitCount);
    });

    it('should apply hitCountMultiplier', () => {
      const id = factory.createEnemy(world, EnemyType.NORMAL, { x: 100, y: 50 }, 2.0);
      const hitCount = world.getComponent(id, HitCountComponent)!;
      expect(hitCount.currentHits).toBe(Math.ceil(ENEMY_CONFIG.NORMAL.hitCount * 2.0));
    });

    it('should set correct enemy type and breach damage', () => {
      const id = factory.createEnemy(world, EnemyType.FAST, { x: 100, y: 50 });
      const enemy = world.getComponent(id, EnemyComponent)!;
      expect(enemy.enemyType).toBe(EnemyType.FAST);
      expect(enemy.breachDamage).toBe(ENEMY_CONFIG.FAST.breachDamage);
    });

    it('should use larger size for boss', () => {
      const id = factory.createEnemy(world, EnemyType.BOSS, { x: 100, y: 50 });
      const sprite = world.getComponent(id, MeshComponent)!;
      expect(sprite.logicalWidth).toBe(280);
      expect(sprite.logicalHeight).toBe(280);
    });

    it('should use tank size for tank', () => {
      const id = factory.createEnemy(world, EnemyType.TANK, { x: 100, y: 50 });
      const sprite = world.getComponent(id, MeshComponent)!;
      expect(sprite.logicalWidth).toBe(200);
      expect(sprite.logicalHeight).toBe(200);
    });
  });

  describe('createBullet', () => {
    it('should create entity with all required components', () => {
      const id = factory.createBullet(world, { x: 100, y: 200 }, { vx: 0, vy: -600 }, 1, false, 1);

      expect(world.getComponent(id, PositionComponent)).toBeDefined();
      expect(world.getComponent(id, VelocityComponent)).toBeDefined();
      expect(world.getComponent(id, BulletComponent)).toBeDefined();
      expect(world.getComponent(id, ColliderComponent)).toBeDefined();
      expect(world.getComponent(id, MeshComponent)).toBeDefined();
    });

    it('should set bullet properties correctly', () => {
      const id = factory.createBullet(world, { x: 100, y: 200 }, { vx: 0, vy: -600 }, 2, true, 42);

      const bullet = world.getComponent(id, BulletComponent)!;
      expect(bullet.hitCountReduction).toBe(2);
      expect(bullet.isPiercing).toBe(true);
      expect(bullet.ownerId).toBe(42);
    });

    it('should set position and velocity correctly', () => {
      const id = factory.createBullet(world, { x: 100, y: 200 }, { vx: 50, vy: -600 }, 1, false, 1);

      const pos = world.getComponent(id, PositionComponent)!;
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(200);

      const vel = world.getComponent(id, VelocityComponent)!;
      expect(vel.vx).toBe(50);
      expect(vel.vy).toBe(-600);
    });
  });

  describe('createAlly', () => {
    it('should create entity with required components', () => {
      const playerId = factory.createPlayer(world);
      const id = factory.createAlly(world, playerId, 0, 10.0);

      expect(world.getComponent(id, PositionComponent)).toBeDefined();
      expect(world.getComponent(id, AllyComponent)).toBeDefined();
      expect(world.getComponent(id, MeshComponent)).toBeDefined();
      expect(world.getComponent(id, WeaponComponent)).toBeDefined();
    });

    it('should set ally index, follow target and join time', () => {
      const playerId = factory.createPlayer(world);
      const id = factory.createAlly(world, playerId, 2, 45.0);

      const ally = world.getComponent(id, AllyComponent)!;
      expect(ally.allyIndex).toBe(2);
      expect(ally.followTarget).toBe(playerId);
      expect(ally.joinTime).toBe(45.0);
    });

    it('should have FORWARD weapon', () => {
      const playerId = factory.createPlayer(world);
      const id = factory.createAlly(world, playerId, 0, 10.0);

      const weapon = world.getComponent(id, WeaponComponent)!;
      expect(weapon.weaponType).toBe(WeaponType.FORWARD);
      expect(weapon.fireInterval).toBe(WEAPON_CONFIG[WeaponType.FORWARD].fireInterval);
    });
  });

  describe('createEffect', () => {
    it('should create muzzle flash effect', () => {
      const id = factory.createEffect(world, EffectType.MUZZLE_FLASH, { x: 100, y: 200 });

      expect(world.getComponent(id, PositionComponent)).toBeDefined();
      expect(world.getComponent(id, EffectComponent)).toBeDefined();
      expect(world.getComponent(id, MeshComponent)).toBeDefined();

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

    it('should create buff activate effect', () => {
      const id = factory.createEffect(world, EffectType.BUFF_ACTIVATE, { x: 100, y: 200 }, '#FF4444');

      const effect = world.getComponent(id, EffectComponent)!;
      expect(effect.effectType).toBe(EffectType.BUFF_ACTIVATE);
      expect(effect.duration).toBe(GAME_CONFIG.buff.effectDuration);
    });
  });
});
