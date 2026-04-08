import { World } from '../../src/ecs/World';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import { EntityFactory } from '../../src/factories/EntityFactory';
import { PositionComponent } from '../../src/components/PositionComponent';
import { WeaponInventoryComponent } from '../../src/components/WeaponInventoryComponent';
import { PlayerComponent } from '../../src/components/PlayerComponent';
import { EnemyComponent } from '../../src/components/EnemyComponent';
import { BulletComponent } from '../../src/components/BulletComponent';
import { PassiveSkillsComponent } from '../../src/components/PassiveSkillsComponent';
import { ColliderComponent } from '../../src/components/ColliderComponent';
import { HealthComponent } from '../../src/components/HealthComponent';
import { WeaponComponent } from '../../src/components/WeaponComponent';
import { AllyComponent } from '../../src/components/AllyComponent';
import { EnemyType, WeaponType, ColliderType } from '../../src/types';
import { GAME_CONFIG } from '../../src/config/gameConfig';

describe('WeaponSystem', () => {
  let world: World;
  let system: WeaponSystem;
  let entityFactory: EntityFactory;

  beforeEach(() => {
    world = new World();
    entityFactory = new EntityFactory();
    system = new WeaponSystem(entityFactory);
  });

  function createPlayer(x: number, y: number): number {
    const id = world.createEntity();
    world.addComponent(id, new PositionComponent(x, y));
    world.addComponent(id, new PlayerComponent(200));
    world.addComponent(id, new PassiveSkillsComponent());
    const inventory = new WeaponInventoryComponent();
    inventory.addWeapon(WeaponType.FORWARD, 1);
    world.addComponent(id, inventory);
    return id;
  }

  function createEnemy(x: number, y: number): number {
    const id = world.createEntity();
    world.addComponent(id, new PositionComponent(x, y));
    world.addComponent(id, new ColliderComponent(12, ColliderType.ENEMY));
    world.addComponent(id, new HealthComponent(20, 20));
    world.addComponent(id, new EnemyComponent(EnemyType.NORMAL, 10, 10));
    return id;
  }

  describe('bullet generation', () => {
    it('should create bullet when fire interval has elapsed', () => {
      createPlayer(360, 1200);
      createEnemy(360, 400);

      // Advance game time past fire interval (FORWARD Lv1 = 0.5s)
      system.setGameTime(0);
      system.update(world, 0.6);

      const bullets = world.query(BulletComponent);
      expect(bullets.length).toBeGreaterThanOrEqual(1);
    });

    it('should not create bullet before fire interval', () => {
      createPlayer(360, 1200);
      createEnemy(360, 400);

      system.setGameTime(0);
      system.update(world, 0.1);

      const bullets = world.query(BulletComponent);
      expect(bullets.length).toBe(0);
    });

    it('should not exceed max bullet limit', () => {
      createPlayer(360, 1200);
      createEnemy(360, 400);

      // Pre-fill bullets to max
      for (let i = 0; i < GAME_CONFIG.limits.maxBullets; i++) {
        const bid = world.createEntity();
        world.addComponent(bid, new BulletComponent(10, false, 0));
      }

      system.setGameTime(0);
      system.update(world, 1.0);

      const bullets = world.query(BulletComponent);
      expect(bullets.length).toBe(GAME_CONFIG.limits.maxBullets);
    });
  });

  describe('targeting', () => {
    it('should find nearest enemy', () => {
      const pos = new PositionComponent(360, 1200);

      // Create far enemy
      createEnemy(100, 100);
      // Create near enemy
      createEnemy(360, 1000);

      const target = system.findNearestEnemy(world, pos);
      expect(target).not.toBeNull();
      expect(target!.x).toBe(360);
      expect(target!.y).toBe(1000);
    });

    it('should return null when no enemies exist', () => {
      const pos = new PositionComponent(360, 1200);
      const target = system.findNearestEnemy(world, pos);
      expect(target).toBeNull();
    });
  });

  describe('ally weapon', () => {
    it('should fire ally weapon independently', () => {
      const playerId = createPlayer(360, 1200);
      createEnemy(360, 400);

      // Create ally with weapon
      const allyId = world.createEntity();
      world.addComponent(allyId, new PositionComponent(392, 1200));
      world.addComponent(allyId, new AllyComponent(32, playerId));
      world.addComponent(allyId, new WeaponComponent(WeaponType.FORWARD, 1, 0.5));

      system.setGameTime(0);
      system.update(world, 0.6);

      const bullets = world.query(BulletComponent);
      // Both player and ally should have fired
      expect(bullets.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('reset', () => {
    it('should reset game time to 0', () => {
      system.setGameTime(10);
      system.reset();

      // After reset, should not fire immediately (gameTime = 0, lastFiredAt = 0, interval not elapsed)
      createPlayer(360, 1200);
      createEnemy(360, 400);
      system.update(world, 0.01);

      const bullets = world.query(BulletComponent);
      expect(bullets.length).toBe(0);
    });
  });
});
