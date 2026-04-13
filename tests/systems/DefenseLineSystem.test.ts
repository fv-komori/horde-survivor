import { World } from '../../src/ecs/World';
import { DefenseLineSystem } from '../../src/systems/DefenseLineSystem';
import { PositionComponent } from '../../src/components/PositionComponent';
import { EnemyComponent } from '../../src/components/EnemyComponent';
import { HealthComponent } from '../../src/components/HealthComponent';
import { PlayerComponent } from '../../src/components/PlayerComponent';
import { GAME_CONFIG } from '../../src/config/gameConfig';
import { EnemyType } from '../../src/types';

/** AudioManagerモック（テスト用） */
const mockAudioManager = { playSE: jest.fn(), playBGM: jest.fn(), reset: jest.fn() } as any;

describe('DefenseLineSystem', () => {
  let world: World;
  let system: DefenseLineSystem;

  function createPlayer(): number {
    const id = world.createEntity();
    world.addComponent(id, new PlayerComponent(200));
    world.addComponent(id, new HealthComponent(100, 100));
    return id;
  }

  function createEnemy(y: number, breachDamage: number): number {
    const id = world.createEntity();
    world.addComponent(id, new PositionComponent(360, y));
    world.addComponent(id, new EnemyComponent(EnemyType.NORMAL, breachDamage, 0.3, 0.05, 0.1));
    return id;
  }

  beforeEach(() => {
    world = new World();
    system = new DefenseLineSystem(mockAudioManager);
    jest.clearAllMocks();
  });

  it('should damage player when enemy reaches defense line', () => {
    const playerId = createPlayer();
    createEnemy(GAME_CONFIG.defenseLine.y, 10);

    system.update(world, 0.016);

    const health = world.getComponent(playerId, HealthComponent);
    expect(health!.hp).toBe(90);
  });

  it('should destroy enemy after breach', () => {
    createPlayer();
    const enemyId = createEnemy(GAME_CONFIG.defenseLine.y + 10, 10);

    system.update(world, 0.016);
    world.update(0); // flush

    expect(world.hasEntity(enemyId)).toBe(false);
  });

  it('should always apply damage (no invincibility)', () => {
    const playerId = createPlayer();

    // Create two enemies at the defense line
    createEnemy(GAME_CONFIG.defenseLine.y, 10);
    createEnemy(GAME_CONFIG.defenseLine.y, 10);

    system.update(world, 0.016);

    const health = world.getComponent(playerId, HealthComponent);
    expect(health!.hp).toBe(80); // both enemies deal damage
  });

  it('should not damage if enemy is above defense line', () => {
    const playerId = createPlayer();
    createEnemy(GAME_CONFIG.defenseLine.y - 100, 10);

    system.update(world, 0.016);

    const health = world.getComponent(playerId, HealthComponent);
    expect(health!.hp).toBe(100);
  });

  it('should clamp HP to 0 minimum', () => {
    const playerId = createPlayer();
    createEnemy(GAME_CONFIG.defenseLine.y, 150); // more than 100 HP

    system.update(world, 0.016);

    const health = world.getComponent(playerId, HealthComponent);
    expect(health!.hp).toBe(0);
  });
});
