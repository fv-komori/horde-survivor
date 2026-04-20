import { World } from '../../src/ecs/World';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import { EntityFactory } from '../../src/factories/EntityFactory';
import { PositionComponent } from '../../src/components/PositionComponent';
import { PlayerComponent } from '../../src/components/PlayerComponent';
import { EnemyComponent } from '../../src/components/EnemyComponent';
import { BulletComponent } from '../../src/components/BulletComponent';
import { BuffComponent } from '../../src/components/BuffComponent';
import { ColliderComponent } from '../../src/components/ColliderComponent';
import { HitCountComponent } from '../../src/components/HitCountComponent';
import { WeaponComponent } from '../../src/components/WeaponComponent';
import { AllyComponent } from '../../src/components/AllyComponent';
import { MeshComponent } from '../../src/components/MeshComponent';
import { EnemyType, WeaponGenre, BuffType, ColliderType } from '../../src/types';
import { GAME_CONFIG } from '../../src/config/gameConfig';
import { WEAPON_PARAMS } from '../../src/config/weaponConfig';

/** AudioManagerモック（テスト用） */
const mockAudioManager = { playSE: jest.fn(), playBGM: jest.fn(), reset: jest.fn() } as any;

describe('WeaponSystem', () => {
  let world: World;
  let system: WeaponSystem;
  let entityFactory: EntityFactory;

  beforeEach(() => {
    world = new World();
    entityFactory = new EntityFactory();
    system = new WeaponSystem(entityFactory, mockAudioManager);
    jest.clearAllMocks();
  });

  function createPlayer(x: number, y: number): number {
    const id = world.createEntity();
    world.addComponent(id, new PositionComponent(x, y));
    world.addComponent(id, new PlayerComponent(200));
    world.addComponent(id, new BuffComponent());
    world.addComponent(id, new MeshComponent('player', 192, 192));
    const weaponCfg = WEAPON_PARAMS[WeaponGenre.RIFLE];
    world.addComponent(id, new WeaponComponent(WeaponGenre.RIFLE, weaponCfg.fireInterval));
    return id;
  }

  function createEnemy(x: number, y: number): number {
    const id = world.createEntity();
    world.addComponent(id, new PositionComponent(x, y));
    world.addComponent(id, new ColliderComponent(60, ColliderType.ENEMY));
    world.addComponent(id, new HitCountComponent(5, 5));
    world.addComponent(id, new EnemyComponent(EnemyType.NORMAL, 10));
    return id;
  }

  describe('bullet generation', () => {
    it('should create bullet when fire interval has elapsed', () => {
      createPlayer(360, 1200);
      createEnemy(360, 400);

      system.setGameTime(0);
      system.update(world, 0.2); // RIFLE fireInterval = 0.15

      const bullets = world.query(BulletComponent);
      expect(bullets.length).toBeGreaterThanOrEqual(1);
    });

    it('should not create bullet before fire interval', () => {
      createPlayer(360, 1200);
      createEnemy(360, 400);

      system.setGameTime(0);
      system.update(world, 0.05); // less than 0.15

      const bullets = world.query(BulletComponent);
      expect(bullets.length).toBe(0);
    });

    it('should not exceed max bullet limit (200)', () => {
      createPlayer(360, 1200);
      createEnemy(360, 400);

      // Pre-fill bullets to max
      for (let i = 0; i < GAME_CONFIG.limits.maxBullets; i++) {
        const bid = world.createEntity();
        world.addComponent(bid, new BulletComponent(1, false, 0));
      }

      system.setGameTime(0);
      system.update(world, 1.0);

      const bullets = world.query(BulletComponent);
      expect(bullets.length).toBe(GAME_CONFIG.limits.maxBullets);
    });

    it('should have maxBullets = 200', () => {
      expect(GAME_CONFIG.limits.maxBullets).toBe(200);
    });
  });

  describe('buff effects', () => {
    it('FIRE_RATE_UP should halve fire interval (multiplier 0.5)', () => {
      const playerId = createPlayer(360, 1200);
      createEnemy(360, 400);
      const buffs = world.getComponent(playerId, BuffComponent)!;
      buffs.applyBuff(BuffType.FIRE_RATE_UP, 5.0);

      // Normal interval = 0.15, with buff = 0.075
      system.setGameTime(0);
      system.update(world, 0.08); // should fire with buff

      const bullets = world.query(BulletComponent);
      expect(bullets.length).toBeGreaterThanOrEqual(1);
    });

    it('ATTACK_UP should set hitCountReduction to 2', () => {
      const playerId = createPlayer(360, 1200);
      createEnemy(360, 400);
      const buffs = world.getComponent(playerId, BuffComponent)!;
      buffs.applyBuff(BuffType.ATTACK_UP, 5.0);

      system.setGameTime(0);
      system.update(world, 0.2);

      const bullets = world.query(BulletComponent);
      expect(bullets.length).toBeGreaterThanOrEqual(1);

      const bulletComp = world.getComponent(bullets[0], BulletComponent)!;
      expect(bulletComp.hitCountReduction).toBe(GAME_CONFIG.buff.attackUpReduction);
    });

    it('BARRAGE should triple bullet count', () => {
      const playerId = createPlayer(360, 1200);
      createEnemy(360, 400);
      const buffs = world.getComponent(playerId, BuffComponent)!;
      buffs.applyBuff(BuffType.BARRAGE, 5.0);

      system.setGameTime(0);
      system.update(world, 0.2);

      const bullets = world.query(BulletComponent);
      // RIFLE base bulletCount = 1, with BARRAGE = 1 * 3 = 3
      expect(bullets.length).toBe(WEAPON_PARAMS[WeaponGenre.RIFLE].bulletCount * GAME_CONFIG.buff.barrageBulletMultiplier);
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
      world.addComponent(allyId, new AllyComponent(0, playerId, 10.0));
      world.addComponent(allyId, new MeshComponent('ally', 150, 150));
      const weaponCfg = WEAPON_PARAMS[WeaponGenre.RIFLE];
      world.addComponent(allyId, new WeaponComponent(WeaponGenre.RIFLE, weaponCfg.fireInterval));

      system.setGameTime(0);
      system.update(world, 0.2);

      const bullets = world.query(BulletComponent);
      // Both player and ally should have fired
      expect(bullets.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('reset', () => {
    it('should reset game time to 0', () => {
      system.setGameTime(10);
      system.reset();

      createPlayer(360, 1200);
      createEnemy(360, 400);
      system.update(world, 0.01);

      const bullets = world.query(BulletComponent);
      expect(bullets.length).toBe(0);
    });
  });
});
