import { World } from '../../src/ecs/World';
import { CollisionSystem } from '../../src/systems/CollisionSystem';
import { PositionComponent } from '../../src/components/PositionComponent';
import { ColliderComponent } from '../../src/components/ColliderComponent';
import { BulletComponent } from '../../src/components/BulletComponent';
import { EnemyComponent } from '../../src/components/EnemyComponent';
import { HealthComponent } from '../../src/components/HealthComponent';
import { EntityFactory } from '../../src/factories/EntityFactory';
import { ScoreService } from '../../src/game/ScoreService';
import { EnemyType, ColliderType } from '../../src/types';

describe('CollisionSystem', () => {
  let world: World;
  let system: CollisionSystem;
  let scoreService: ScoreService;

  beforeEach(() => {
    world = new World();
    scoreService = new ScoreService();
    system = new CollisionSystem(new EntityFactory(), scoreService);
  });

  function createBullet(x: number, y: number, damage: number, piercing = false): number {
    const id = world.createEntity();
    world.addComponent(id, new PositionComponent(x, y));
    world.addComponent(id, new ColliderComponent(4, ColliderType.BULLET));
    world.addComponent(id, new BulletComponent(damage, piercing, 1));
    return id;
  }

  function createEnemy(x: number, y: number, hp: number): number {
    const id = world.createEntity();
    world.addComponent(id, new PositionComponent(x, y));
    world.addComponent(id, new ColliderComponent(12, ColliderType.ENEMY));
    world.addComponent(id, new HealthComponent(hp, hp));
    world.addComponent(id, new EnemyComponent(EnemyType.NORMAL, 10, 10));
    return id;
  }

  describe('checkCircleCollision', () => {
    it('should detect overlapping circles', () => {
      expect(system.checkCircleCollision({ x: 0, y: 0 }, 10, { x: 15, y: 0 }, 10)).toBe(true);
    });

    it('should not detect non-overlapping circles', () => {
      expect(system.checkCircleCollision({ x: 0, y: 0 }, 5, { x: 20, y: 0 }, 5)).toBe(false);
    });
  });

  describe('bullet-enemy collision', () => {
    it('should damage enemy on hit', () => {
      createBullet(100, 100, 15);
      const enemyId = createEnemy(100, 100, 20);

      system.update(world, 0.016);

      const health = world.getComponent(enemyId, HealthComponent);
      expect(health!.hp).toBe(5);
    });

    it('should destroy enemy when HP reaches 0', () => {
      createBullet(100, 100, 25);
      const enemyId = createEnemy(100, 100, 20);

      system.update(world, 0.016);
      world.update(0); // flush destroy queue

      expect(world.hasEntity(enemyId)).toBe(false);
      expect(scoreService.getKillCount()).toBe(1);
    });

    it('should destroy non-piercing bullet on hit', () => {
      const bulletId = createBullet(100, 100, 5);
      createEnemy(100, 100, 20);

      system.update(world, 0.016);
      world.update(0);

      expect(world.hasEntity(bulletId)).toBe(false);
    });

    it('should keep piercing bullet alive after hit', () => {
      const bulletId = createBullet(100, 100, 5, true);
      createEnemy(100, 100, 20);

      system.update(world, 0.016);
      world.update(0);

      expect(world.hasEntity(bulletId)).toBe(true);
    });

    it('should not hit same enemy twice with piercing bullet', () => {
      const bulletId = createBullet(100, 100, 5, true);
      const enemyId = createEnemy(100, 100, 20);

      system.update(world, 0.016);
      system.update(world, 0.016); // second frame

      const health = world.getComponent(enemyId, HealthComponent);
      expect(health!.hp).toBe(15); // only hit once
    });
  });
});
