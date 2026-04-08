import { World } from '../../src/ecs/World';
import { CleanupSystem } from '../../src/systems/CleanupSystem';
import { PositionComponent } from '../../src/components/PositionComponent';
import { BulletComponent } from '../../src/components/BulletComponent';
import { XPDropComponent } from '../../src/components/XPDropComponent';
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
    world.addComponent(id, new BulletComponent(10, false, 0));
    return id;
  }

  function createXPDrop(x: number, y: number, lifetime: number = 15.0, createdAt: number = 0): number {
    const id = world.createEntity();
    world.addComponent(id, new PositionComponent(x, y));
    const xp = new XPDropComponent(10, createdAt);
    xp.lifetime = lifetime;
    world.addComponent(id, xp);
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

  describe('XPDrop lifetime', () => {
    it('should destroy XPDrop when lifetime expires', () => {
      const xpId = createXPDrop(100, 100, 0.5);

      system.update(world, 0.6); // exceeds remaining lifetime
      world.update(0);

      expect(world.hasEntity(xpId)).toBe(false);
    });

    it('should keep XPDrop with remaining lifetime', () => {
      const xpId = createXPDrop(100, 100, 10.0);

      system.update(world, 0.016);
      world.update(0);

      expect(world.hasEntity(xpId)).toBe(true);
    });
  });

  describe('XPDrop limit', () => {
    it('should remove oldest XPDrops when exceeding max limit', () => {
      const maxDrops = GAME_CONFIG.limits.maxXPDrops;
      const xpIds: number[] = [];

      // Create max + 5 XPDrops with different createdAt times
      for (let i = 0; i < maxDrops + 5; i++) {
        xpIds.push(createXPDrop(100, 100, 15.0, i));
      }

      system.update(world, 0.016);
      world.update(0);

      // The oldest 5 should be destroyed
      for (let i = 0; i < 5; i++) {
        expect(world.hasEntity(xpIds[i])).toBe(false);
      }

      // The rest should remain
      for (let i = 5; i < maxDrops + 5; i++) {
        expect(world.hasEntity(xpIds[i])).toBe(true);
      }
    });

    it('should not remove XPDrops when under max limit', () => {
      const xpIds: number[] = [];
      for (let i = 0; i < 5; i++) {
        xpIds.push(createXPDrop(100, 100, 15.0, i));
      }

      system.update(world, 0.016);
      world.update(0);

      for (const id of xpIds) {
        expect(world.hasEntity(id)).toBe(true);
      }
    });
  });
});
