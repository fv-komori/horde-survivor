import { WaveManager } from '../../src/managers/WaveManager';

describe('WaveManager', () => {
  let manager: WaveManager;

  beforeEach(() => {
    manager = new WaveManager();
  });

  describe('getCurrentWave', () => {
    it('should be wave 1 at start', () => {
      manager.update(0);
      expect(manager.getCurrentWave()).toBe(1);
    });

    it('should transition to wave 2 at 60 seconds', () => {
      manager.update(60);
      expect(manager.getCurrentWave()).toBe(2);
    });

    it('should transition to wave 3 at 150 seconds', () => {
      manager.update(150);
      expect(manager.getCurrentWave()).toBe(3);
    });

    it('should transition to wave 4+ at 270 seconds', () => {
      manager.update(270);
      expect(manager.getCurrentWave()).toBe(4);
    });
  });

  describe('getSpawnConfig', () => {
    it('should return NORMAL enemies only for wave 1', () => {
      const config = manager.getSpawnConfig(30);
      expect(config.enemyTypes).toEqual(['NORMAL']);
      expect(config.interval).toBe(2.0);
    });

    it('should return NORMAL+FAST for wave 2', () => {
      const config = manager.getSpawnConfig(90);
      expect(config.enemyTypes).toEqual(['NORMAL', 'FAST']);
      expect(config.interval).toBe(1.5);
    });

    it('should scale spawn interval for wave 4+', () => {
      const config = manager.getSpawnConfig(300); // 30s into wave 4
      expect(config.interval).toBeLessThan(1.0);
      expect(config.hpMultiplier).toBeGreaterThan(1.0);
    });

    it('should respect minimum spawn interval', () => {
      const config = manager.getSpawnConfig(10000); // far future
      expect(config.interval).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('boss spawning', () => {
    it('should not spawn boss before 120 seconds', () => {
      expect(manager.shouldSpawnBoss(1, 60)).toBe(false);
    });

    it('should return boss params with scaling', () => {
      const params1 = manager.getBossParams();
      expect(params1.hp).toBe(500);
      expect(params1.damage).toBe(30);

      const params2 = manager.getBossParams();
      expect(params2.hp).toBe(750); // 500 * (1 + 0.5)
      expect(params2.damage).toBe(39); // 30 * (1 + 0.3)
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      manager.update(200);
      manager.getBossParams(); // increment boss count
      manager.reset();

      manager.update(0);
      expect(manager.getCurrentWave()).toBe(1);
      const params = manager.getBossParams();
      expect(params.hp).toBe(500); // first boss again
    });
  });
});
