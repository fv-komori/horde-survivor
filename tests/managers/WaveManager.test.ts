import { WaveManager } from '../../src/managers/WaveManager';
import { BOSS_CONFIG } from '../../src/config/enemyConfig';
import { WAVE_SCALING } from '../../src/config/waveConfig';

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

    it('should stay wave 1 before 45 seconds', () => {
      manager.update(44);
      expect(manager.getCurrentWave()).toBe(1);
    });

    it('should transition to wave 2 at 45 seconds', () => {
      manager.update(45);
      expect(manager.getCurrentWave()).toBe(2);
    });

    it('should transition to wave 3 at 90 seconds', () => {
      manager.update(90);
      expect(manager.getCurrentWave()).toBe(3);
    });

    it('should transition to wave 4+ at 180 seconds', () => {
      manager.update(180);
      expect(manager.getCurrentWave()).toBe(4);
    });
  });

  describe('getSpawnConfig', () => {
    it('should return NORMAL enemies only for wave 1', () => {
      manager.update(10);
      const config = manager.getSpawnConfig(10);
      expect(config.enemyTypes).toEqual(['NORMAL']);
      expect(config.interval).toBe(1.0);
      expect(config.simultaneousCount).toBe(1);
    });

    it('should return NORMAL+FAST for wave 2', () => {
      manager.update(50);
      const config = manager.getSpawnConfig(50);
      expect(config.enemyTypes).toEqual(['NORMAL', 'FAST']);
      expect(config.interval).toBe(0.7);
      expect(config.simultaneousCount).toBe(2);
    });

    it('should return NORMAL+FAST+TANK for wave 3', () => {
      manager.update(100);
      const config = manager.getSpawnConfig(100);
      expect(config.enemyTypes).toEqual(['NORMAL', 'FAST', 'TANK']);
      expect(config.interval).toBe(0.5);
      expect(config.simultaneousCount).toBe(3);
    });

    it('should include hitCountMultiplier in spawn config', () => {
      manager.update(60); // 2 scaling steps (60/30)
      const config = manager.getSpawnConfig(60);
      expect(config.hitCountMultiplier).toBeCloseTo(1.2); // 1.0 + 2*0.1
    });

    it('should scale spawn interval for wave 4+', () => {
      manager.update(240);
      const config = manager.getSpawnConfig(240);
      expect(config.interval).toBeLessThan(0.5);
      expect(config.hitCountMultiplier).toBeGreaterThan(1.0);
    });

    it('should respect minimum spawn interval', () => {
      manager.update(10000);
      const config = manager.getSpawnConfig(10000);
      expect(config.interval).toBeGreaterThanOrEqual(WAVE_SCALING.minSpawnInterval);
    });
  });

  describe('hitCountMultiplier', () => {
    it('should be 1.0 at start', () => {
      manager.update(0);
      expect(manager.getHitCountMultiplier()).toBe(1.0);
    });

    it('should increase by 0.1 every 30 seconds', () => {
      manager.update(30);
      expect(manager.getHitCountMultiplier()).toBeCloseTo(1.1);

      manager.update(60);
      expect(manager.getHitCountMultiplier()).toBeCloseTo(1.2);

      manager.update(90);
      expect(manager.getHitCountMultiplier()).toBeCloseTo(1.3);
    });
  });

  describe('boss spawning', () => {
    it('should not spawn boss before 90 seconds', () => {
      expect(manager.shouldSpawnBoss(1, 60)).toBe(false);
    });

    it('should spawn boss at 90 seconds via shouldSpawnBoss', () => {
      // bossTimer starts at BOSS_CONFIG.firstSpawnTime (90)
      // After subtracting 90 of dt, timer should go to 0 or below
      const result = manager.shouldSpawnBoss(90, 90);
      expect(result).toBe(true);
    });

    it('should have 90 second boss interval', () => {
      expect(BOSS_CONFIG.spawnInterval).toBe(90);
      expect(BOSS_CONFIG.firstSpawnTime).toBe(90);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      manager.update(200);
      manager.reset();

      manager.update(0);
      expect(manager.getCurrentWave()).toBe(1);
      expect(manager.getHitCountMultiplier()).toBe(1.0);
    });
  });
});
