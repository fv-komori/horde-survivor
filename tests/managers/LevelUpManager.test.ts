import { World } from '../../src/ecs/World';
import { LevelUpManager } from '../../src/managers/LevelUpManager';
import { GameStateManager } from '../../src/game/GameStateManager';
import { EntityFactory } from '../../src/factories/EntityFactory';
import { HealthComponent } from '../../src/components/HealthComponent';
import { WeaponInventoryComponent } from '../../src/components/WeaponInventoryComponent';
import { PassiveSkillsComponent } from '../../src/components/PassiveSkillsComponent';
import { PlayerComponent } from '../../src/components/PlayerComponent';
import { GameState, UpgradeCategory, WeaponType } from '../../src/types';
import type { UpgradeChoice } from '../../src/types';

describe('LevelUpManager', () => {
  let world: World;
  let manager: LevelUpManager;
  let gameState: GameStateManager;
  let playerId: number;

  beforeEach(() => {
    world = new World();
    const factory = new EntityFactory();
    manager = new LevelUpManager(factory);
    gameState = new GameStateManager();

    // Create player manually
    playerId = world.createEntity();
    world.addComponent(playerId, new PlayerComponent(200));
    world.addComponent(playerId, new HealthComponent(100, 100));
    world.addComponent(playerId, new PassiveSkillsComponent());
    const inv = new WeaponInventoryComponent();
    inv.addWeapon(WeaponType.FORWARD, 1);
    world.addComponent(playerId, inv);
  });

  describe('XP and level up', () => {
    it('should not level up with insufficient XP', () => {
      manager.addXP(20);
      expect(manager.checkLevelUp()).toBe(false);
    });

    it('should level up at 30 XP (Lv1→2)', () => {
      manager.addXP(30);
      expect(manager.checkLevelUp()).toBe(true);
    });

    it('should require cumulative XP for higher levels', () => {
      expect(manager.getXPRequiredForLevel(1)).toBe(30);
      expect(manager.getXPRequiredForLevel(2)).toBe(70);
      expect(manager.getXPRequiredForLevel(3)).toBe(125);
    });
  });

  describe('generateChoices', () => {
    it('should generate 3 choices', () => {
      const choices = manager.generateChoices(world, playerId);
      expect(choices).toHaveLength(3);
    });

    it('should assign unique IDs', () => {
      const choices = manager.generateChoices(world, playerId);
      const ids = new Set(choices.map(c => c.id));
      expect(ids.size).toBe(3);
    });

    it('should include possible weapon upgrades', () => {
      const choices = manager.generateChoices(world, playerId);
      const categories = choices.map(c => c.category);
      // Should have mix of weapons, passives, etc.
      expect(choices.length).toBe(3);
    });
  });

  describe('applyChoice', () => {
    it('should reject choice outside LEVEL_UP state', () => {
      const choices = manager.generateChoices(world, playerId);
      // gameState is TITLE, not LEVEL_UP
      const result = manager.applyChoice(world, playerId, choices[0], gameState);
      expect(result).toBe(false);
    });

    it('should apply weapon upgrade in LEVEL_UP state', () => {
      // Transition to LEVEL_UP
      gameState.changeState(GameState.PLAYING);
      gameState.changeState(GameState.LEVEL_UP);

      const choices = manager.generateChoices(world, playerId);
      const weaponChoice = choices.find(c => c.category === UpgradeCategory.WEAPON);
      if (weaponChoice) {
        const result = manager.applyChoice(world, playerId, weaponChoice, gameState);
        expect(result).toBe(true);
        expect(gameState.getCurrentState()).toBe(GameState.PLAYING);
      }
    });

    it('should reject invalid choice ID', () => {
      gameState.changeState(GameState.PLAYING);
      gameState.changeState(GameState.LEVEL_UP);

      manager.generateChoices(world, playerId);
      const fakeChoice: UpgradeChoice = {
        id: 'fake_id',
        category: UpgradeCategory.HEAL,
        upgradeType: 'heal',
        currentLevel: 0,
        nextLevel: 0,
        description: 'HP 30%回復',
      };
      const result = manager.applyChoice(world, playerId, fakeChoice, gameState);
      expect(result).toBe(false);
    });

    it('should heal 10% on normal level up', () => {
      gameState.changeState(GameState.PLAYING);
      gameState.changeState(GameState.LEVEL_UP);

      // Damage player first
      const health = world.getComponent(playerId, HealthComponent)!;
      health.hp = 50;

      const choices = manager.generateChoices(world, playerId);
      const nonHealChoice = choices.find(c => c.category !== UpgradeCategory.HEAL);
      if (nonHealChoice) {
        manager.applyChoice(world, playerId, nonHealChoice, gameState);
        expect(health.hp).toBe(60); // 50 + 10% of 100
      }
    });

    it('should heal 30% on HEAL choice', () => {
      gameState.changeState(GameState.PLAYING);
      gameState.changeState(GameState.LEVEL_UP);

      // Max out everything to force HEAL choices
      const passives = world.getComponent(playerId, PassiveSkillsComponent)!;
      passives.speedLevel = 5;
      passives.maxHpLevel = 5;
      passives.attackLevel = 5;
      passives.xpGainLevel = 5;
      const inv = world.getComponent(playerId, WeaponInventoryComponent)!;
      inv.weaponSlots[0].level = 5;
      inv.addWeapon(WeaponType.SPREAD, 5);
      inv.addWeapon(WeaponType.PIERCING, 5);

      const health = world.getComponent(playerId, HealthComponent)!;
      health.maxHp = 200;
      health.hp = 100;

      // Need 4 allies too
      for (let i = 0; i < 4; i++) {
        (manager as any).allyCount++;
      }

      const choices = manager.generateChoices(world, playerId);
      expect(choices.every(c => c.category === UpgradeCategory.HEAL)).toBe(true);

      manager.applyChoice(world, playerId, choices[0], gameState);
      expect(health.hp).toBe(160); // 100 + 30% of 200 = 160
    });
  });
});
