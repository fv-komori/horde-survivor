import { World } from '../../src/ecs/World';
import { CleanupSystem } from '../../src/systems/CleanupSystem';
import { PositionComponent } from '../../src/components/PositionComponent';
import { BulletComponent } from '../../src/components/BulletComponent';
import { ItemDropComponent } from '../../src/components/ItemDropComponent';
import { GAME_CONFIG } from '../../src/config/gameConfig';
import { ItemType } from '../../src/types';

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

  function createItemDrop(x: number, y: number, remainingTime: number = 10.0): number {
    const id = world.createEntity();
    world.addComponent(id, new PositionComponent(x, y));
    world.addComponent(id, new ItemDropComponent(ItemType.ATTACK_UP, remainingTime));
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

  describe('ItemDrop lifetime', () => {
    it('should destroy ItemDrop when remainingTime expires', () => {
      const itemId = createItemDrop(100, 100, 0.5);

      system.update(world, 0.6); // exceeds remaining time
      world.update(0);

      expect(world.hasEntity(itemId)).toBe(false);
    });

    it('should keep ItemDrop with remaining time', () => {
      const itemId = createItemDrop(100, 100, 10.0);

      system.update(world, 0.016);
      world.update(0);

      expect(world.hasEntity(itemId)).toBe(true);
    });

    it('should start blinking when remainingTime <= blinkStartTime', () => {
      const itemId = createItemDrop(100, 100, 3.5);

      system.update(world, 1.0); // remainingTime becomes 2.5, which is <= 3.0
      const item = world.getComponent(itemId, ItemDropComponent)!;
      expect(item.isBlinking).toBe(true);
    });
  });

  describe('ItemDrop limit', () => {
    it('should remove items with least remaining time when exceeding maxItems', () => {
      const maxItems = GAME_CONFIG.limits.maxItems;
      const itemIds: number[] = [];

      // Create max + 5 items with varying remaining times
      for (let i = 0; i < maxItems + 5; i++) {
        // Items created later have more remaining time
        itemIds.push(createItemDrop(100, 100, 5.0 + i * 0.01));
      }

      system.update(world, 0.016);
      world.update(0);

      // The 5 items with least remaining time should be destroyed
      for (let i = 0; i < 5; i++) {
        expect(world.hasEntity(itemIds[i])).toBe(false);
      }

      // The rest should remain
      for (let i = 5; i < maxItems + 5; i++) {
        expect(world.hasEntity(itemIds[i])).toBe(true);
      }
    });

    it('should not remove items when under max limit', () => {
      const itemIds: number[] = [];
      for (let i = 0; i < 5; i++) {
        itemIds.push(createItemDrop(100, 100, 10.0));
      }

      system.update(world, 0.016);
      world.update(0);

      for (const id of itemIds) {
        expect(world.hasEntity(id)).toBe(true);
      }
    });
  });
});
