import { World } from '../../src/ecs/World';
import { DefenseLineSystem } from '../../src/systems/DefenseLineSystem';
import { PositionComponent } from '../../src/components/PositionComponent';
import { EnemyComponent } from '../../src/components/EnemyComponent';
import { HealthComponent } from '../../src/components/HealthComponent';
import { PlayerComponent } from '../../src/components/PlayerComponent';
import { GAME_CONFIG } from '../../src/config/gameConfig';
import { EnemyType } from '../../src/types';

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
    world.addComponent(id, new EnemyComponent(EnemyType.NORMAL, breachDamage, 10));
    return id;
  }

  beforeEach(() => {
    world = new World();
    system = new DefenseLineSystem();
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

  it('should not damage player during invincibility', () => {
    const playerId = createPlayer();
    const player = world.getComponent(playerId, PlayerComponent)!;
    player.isInvincible = true;
    player.invincibleTimer = 1.0;

    createEnemy(GAME_CONFIG.defenseLine.y, 10);
    system.update(world, 0.016);

    const health = world.getComponent(playerId, HealthComponent);
    expect(health!.hp).toBe(100); // no damage
  });

  it('should apply invincibility after damage', () => {
    const playerId = createPlayer();
    createEnemy(GAME_CONFIG.defenseLine.y, 10);

    system.update(world, 0.016);

    const player = world.getComponent(playerId, PlayerComponent);
    expect(player!.isInvincible).toBe(true);
    expect(player!.invincibleTimer).toBe(GAME_CONFIG.player.invincibleDuration);
  });

  it('should not damage if enemy is above defense line', () => {
    const playerId = createPlayer();
    createEnemy(GAME_CONFIG.defenseLine.y - 100, 10);

    system.update(world, 0.016);

    const health = world.getComponent(playerId, HealthComponent);
    expect(health!.hp).toBe(100);
  });
});
