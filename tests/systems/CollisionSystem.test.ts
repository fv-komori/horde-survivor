import { World } from '../../src/ecs/World';
import { CollisionSystem } from '../../src/systems/CollisionSystem';
import { PositionComponent } from '../../src/components/PositionComponent';
import { ColliderComponent } from '../../src/components/ColliderComponent';
import { BulletComponent } from '../../src/components/BulletComponent';
import { EnemyComponent } from '../../src/components/EnemyComponent';
import { HitCountComponent } from '../../src/components/HitCountComponent';
import { ItemDropComponent } from '../../src/components/ItemDropComponent';
import { EntityFactory } from '../../src/factories/EntityFactory';
import { ScoreService } from '../../src/game/ScoreService';
import { ItemDropManager } from '../../src/managers/ItemDropManager';
import { AllyConversionSystem } from '../../src/systems/AllyConversionSystem';
import { EnemyType, ColliderType } from '../../src/types';

describe('CollisionSystem', () => {
  let world: World;
  let system: CollisionSystem;
  let scoreService: ScoreService;
  let entityFactory: EntityFactory;
  let itemDropManager: ItemDropManager;
  let allyConversionSystem: AllyConversionSystem;

  beforeEach(() => {
    world = new World();
    entityFactory = new EntityFactory();
    scoreService = new ScoreService();
    itemDropManager = new ItemDropManager();
    allyConversionSystem = new AllyConversionSystem(entityFactory);

    // Mock itemDropManager and allyConversionSystem to avoid randomness
    jest.spyOn(itemDropManager, 'determineDrops').mockReturnValue([]);
    jest.spyOn(allyConversionSystem, 'tryConvertToAlly').mockReturnValue(false);

    system = new CollisionSystem(entityFactory, scoreService, itemDropManager, allyConversionSystem);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createBullet(x: number, y: number, hitCountReduction: number, piercing = false): number {
    const id = world.createEntity();
    world.addComponent(id, new PositionComponent(x, y));
    world.addComponent(id, new ColliderComponent(8, ColliderType.BULLET));
    world.addComponent(id, new BulletComponent(hitCountReduction, piercing, 1));
    return id;
  }

  function createEnemy(x: number, y: number, hitCount: number): number {
    const id = world.createEntity();
    world.addComponent(id, new PositionComponent(x, y));
    world.addComponent(id, new ColliderComponent(60, ColliderType.ENEMY));
    world.addComponent(id, new HitCountComponent(hitCount, hitCount));
    world.addComponent(id, new EnemyComponent(EnemyType.NORMAL, 10, 0.3, 0.05, 0.1));
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
    it('should reduce hit count on hit', () => {
      createBullet(100, 100, 1);
      const enemyId = createEnemy(100, 100, 5);

      system.update(world, 0.016);

      const hitCount = world.getComponent(enemyId, HitCountComponent);
      expect(hitCount!.currentHits).toBe(4);
    });

    it('should destroy enemy when hit count reaches 0', () => {
      createBullet(100, 100, 5);
      const enemyId = createEnemy(100, 100, 5);

      system.update(world, 0.016);
      world.update(0); // flush destroy queue

      expect(world.hasEntity(enemyId)).toBe(false);
      expect(scoreService.getKillCount()).toBe(1);
    });

    it('should destroy non-piercing bullet on hit', () => {
      const bulletId = createBullet(100, 100, 1);
      createEnemy(100, 100, 5);

      system.update(world, 0.016);
      world.update(0);

      expect(world.hasEntity(bulletId)).toBe(false);
    });

    it('should keep piercing bullet alive after hit', () => {
      const bulletId = createBullet(100, 100, 1, true);
      createEnemy(100, 100, 5);

      system.update(world, 0.016);
      world.update(0);

      expect(world.hasEntity(bulletId)).toBe(true);
    });

    it('should not hit same enemy twice with piercing bullet (hitEntities)', () => {
      const bulletId = createBullet(100, 100, 1, true);
      const enemyId = createEnemy(100, 100, 5);

      system.update(world, 0.016);
      system.update(world, 0.016); // second frame

      const hitCount = world.getComponent(enemyId, HitCountComponent);
      expect(hitCount!.currentHits).toBe(4); // only hit once
    });

    it('should reduce hit count by hitCountReduction=2 (ATTACK_UP buff)', () => {
      createBullet(100, 100, 2);
      const enemyId = createEnemy(100, 100, 5);

      system.update(world, 0.016);

      const hitCount = world.getComponent(enemyId, HitCountComponent);
      expect(hitCount!.currentHits).toBe(3);
    });

    it('should process defeat queue with drops and score', () => {
      createBullet(100, 100, 10);
      createEnemy(100, 100, 5);

      system.update(world, 0.016);
      world.update(0);

      // itemDropManager.determineDrops should have been called
      expect(itemDropManager.determineDrops).toHaveBeenCalled();
      // allyConversionSystem.tryConvertToAlly should have been called
      expect(allyConversionSystem.tryConvertToAlly).toHaveBeenCalled();
      expect(scoreService.getKillCount()).toBe(1);
    });
  });
});
