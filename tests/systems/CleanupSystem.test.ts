import { World } from '../../src/ecs/World';
import { CleanupSystem } from '../../src/systems/CleanupSystem';
import { PositionComponent } from '../../src/components/PositionComponent';
import { BulletComponent } from '../../src/components/BulletComponent';
import { GAME_CONFIG } from '../../src/config/gameConfig';

describe('CleanupSystem', () => {
  let world: World;
  let system: CleanupSystem;

  beforeEach(() => {
    world = new World();
    system = new CleanupSystem();
  });

  function createBullet(x: number, y: number): number {
    const id = world.createEntity();
    world.addComponent(id, new PositionComponent(x, y));
    world.addComponent(id, new BulletComponent(1, false, 0));
    return id;
  }

  describe('bullet cleanup', () => {
    it('should destroy bullet outside screen left', () => {
      const margin = GAME_CONFIG.bullet.screenMargin;
      const bulletId = createBullet(-margin - 1, 100);

      system.update(world, 0.016);
      world.update(0);

      expect(world.hasEntity(bulletId)).toBe(false);
    });

    it('should destroy bullet outside screen right', () => {
      const w = GAME_CONFIG.screen.logicalWidth;
      const margin = GAME_CONFIG.bullet.screenMargin;
      const bulletId = createBullet(w + margin + 1, 100);

      system.update(world, 0.016);
      world.update(0);

      expect(world.hasEntity(bulletId)).toBe(false);
    });

    it('should destroy bullet outside screen top', () => {
      const margin = GAME_CONFIG.bullet.screenMargin;
      const bulletId = createBullet(100, -margin - 1);

      system.update(world, 0.016);
      world.update(0);

      expect(world.hasEntity(bulletId)).toBe(false);
    });

    it('should destroy bullet outside screen bottom', () => {
      const h = GAME_CONFIG.screen.logicalHeight;
      const margin = GAME_CONFIG.bullet.screenMargin;
      const bulletId = createBullet(100, h + margin + 1);

      system.update(world, 0.016);
      world.update(0);

      expect(world.hasEntity(bulletId)).toBe(false);
    });

    it('should keep bullet inside screen', () => {
      const bulletId = createBullet(360, 640);

      system.update(world, 0.016);
      world.update(0);

      expect(world.hasEntity(bulletId)).toBe(true);
    });
  });
});
