import type { World } from '../ecs/World';
import type { EntityId } from '../ecs/Entity';
import { HealthComponent } from '../components/HealthComponent';
import { WeaponInventoryComponent } from '../components/WeaponInventoryComponent';
import { PassiveSkillsComponent } from '../components/PassiveSkillsComponent';
import { EntityFactory } from '../factories/EntityFactory';
import { GAME_CONFIG } from '../config/gameConfig';
import { XP_TABLE, XP_TABLE_OVERFLOW_INCREMENT } from '../config/waveConfig';
import { UpgradeCategory, WeaponType, GameState } from '../types';
import type { UpgradeChoice } from '../types';
import type { GameStateManager } from '../game/GameStateManager';

/**
 * M-04: レベルアップマネージャー
 * XP管理、レベルアップ判定、選択肢生成、選択検証・適用
 * business-logic-model セクション7, business-rules BR-G01〜G06
 */
export class LevelUpManager {
  private currentLevel: number = 1;
  private currentXP: number = 0;
  private generatedChoiceIds: Set<string> = new Set();
  private allyCount: number = 0;
  private entityFactory: EntityFactory;

  constructor(entityFactory: EntityFactory) {
    this.entityFactory = entityFactory;
  }

  /** XPを追加（BR-G01: パッシブ補正適用済みの値を受け取る） */
  addXP(amount: number): void {
    this.currentXP += amount;
  }

  /** レベルアップ判定（BR-G02） */
  checkLevelUp(): boolean {
    return this.currentXP >= this.getXPRequiredForLevel(this.currentLevel);
  }

  /** 指定レベルに到達するための必要累積XP */
  getXPRequiredForLevel(level: number): number {
    if (level <= 0) return 0;
    if (level - 1 < XP_TABLE.length) {
      return XP_TABLE[level - 1];
    }
    // Lv15以降: 最後のテーブル値 + 差分 × 超過分
    const lastTableXP = XP_TABLE[XP_TABLE.length - 1];
    const overflow = (level - 1) - XP_TABLE.length + 1;
    return lastTableXP + overflow * XP_TABLE_OVERFLOW_INCREMENT;
  }

  /** 強化選択肢を生成（BR-G03, business-logic-model 7.3） */
  generateChoices(world: World, playerId: EntityId): UpgradeChoice[] {
    const inventory = world.getComponent(playerId, WeaponInventoryComponent);
    const passives = world.getComponent(playerId, PassiveSkillsComponent);
    if (!inventory || !passives) return [];

    const candidates: UpgradeChoice[] = [];
    const maxLevel = GAME_CONFIG.weapon.maxLevel;
    const maxPassive = GAME_CONFIG.passiveSkills.maxLevel;

    // 1. 未取得武器（武器スロットに空きがある場合のみ）
    const ownedTypes = inventory.weaponSlots.map(w => w.weaponType);
    if (inventory.weaponSlots.length < GAME_CONFIG.weapon.maxSlots) {
      for (const wt of [WeaponType.SPREAD, WeaponType.PIERCING]) {
        if (!ownedTypes.includes(wt)) {
          candidates.push({
            id: '',
            category: UpgradeCategory.WEAPON,
            upgradeType: wt,
            currentLevel: 0,
            nextLevel: 1,
            description: this.getWeaponDescription(wt, 1),
          });
        }
      }
    }

    // 2. 既存武器の強化
    for (const slot of inventory.weaponSlots) {
      if (slot.level < maxLevel) {
        candidates.push({
          id: '',
          category: UpgradeCategory.WEAPON,
          upgradeType: slot.weaponType,
          currentLevel: slot.level,
          nextLevel: slot.level + 1,
          description: this.getWeaponDescription(slot.weaponType, slot.level + 1),
        });
      }
    }

    // 3. パッシブスキル
    const passiveTypes: { key: keyof PassiveSkillsComponent; name: string; desc: string }[] = [
      { key: 'speedLevel', name: 'speed', desc: '移動速度UP' },
      { key: 'maxHpLevel', name: 'maxHp', desc: '最大HP UP' },
      { key: 'attackLevel', name: 'attack', desc: '攻撃力UP' },
      { key: 'xpGainLevel', name: 'xpGain', desc: 'XP獲得量UP' },
    ];
    for (const pt of passiveTypes) {
      const level = passives[pt.key] as number;
      if (level < maxPassive) {
        candidates.push({
          id: '',
          category: UpgradeCategory.PASSIVE,
          upgradeType: pt.name,
          currentLevel: level,
          nextLevel: level + 1,
          description: `${pt.desc} Lv${level + 1}`,
        });
      }
    }

    // 4. 仲間追加（BR-A01）
    if (this.allyCount < GAME_CONFIG.ally.maxCount) {
      candidates.push({
        id: '',
        category: UpgradeCategory.ALLY,
        upgradeType: 'ally',
        currentLevel: this.allyCount,
        nextLevel: this.allyCount + 1,
        description: `仲間追加 (${this.allyCount + 1}/${GAME_CONFIG.ally.maxCount})`,
      });
    }

    // 5. 候補が3未満の場合: HP回復で埋める
    const count = GAME_CONFIG.levelUp.choiceCount;
    while (candidates.length < count) {
      candidates.push({
        id: '',
        category: UpgradeCategory.HEAL,
        upgradeType: 'heal',
        currentLevel: 0,
        nextLevel: 0,
        description: 'HP 30%���復',
      });
    }

    // 6. ランダムに3つ選択（重複なし）— Fisher-Yatesシャッフル
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const choices = candidates.slice(0, count);

    // 7. ユニークID付与
    this.generatedChoiceIds.clear();
    for (const choice of choices) {
      choice.id = this.generateUniqueId();
      this.generatedChoiceIds.add(choice.id);
    }

    return choices;
  }

  /** 選択を検証して適用（BR-G05, business-logic-model 7.4） */
  applyChoice(
    world: World,
    playerId: EntityId,
    choice: UpgradeChoice,
    gameStateManager: GameStateManager,
  ): boolean {
    // 状態ガード
    if (gameStateManager.getCurrentState() !== GameState.LEVEL_UP) {
      console.warn(`${GAME_CONFIG.logPrefix}[WARN][LevelUpManager] applyChoice called outside LEVEL_UP state`);
      return false;
    }

    // ID検証
    if (!this.generatedChoiceIds.has(choice.id)) {
      console.warn(`${GAME_CONFIG.logPrefix}[WARN][LevelUpManager] Invalid choice ID: ${choice.id}`);
      return false;
    }

    const inventory = world.getComponent(playerId, WeaponInventoryComponent);
    const passives = world.getComponent(playerId, PassiveSkillsComponent);
    const health = world.getComponent(playerId, HealthComponent);
    if (!inventory || !passives || !health) return false;

    switch (choice.category) {
      case UpgradeCategory.WEAPON: {
        const weaponType = choice.upgradeType as WeaponType;
        if (choice.currentLevel === 0) {
          inventory.addWeapon(weaponType, 1);
        } else {
          const slot = inventory.findWeapon(weaponType);
          if (slot && slot.level < GAME_CONFIG.weapon.maxLevel) {
            slot.level++;
          } else {
            console.warn(`${GAME_CONFIG.logPrefix}[WARN][LevelUpManager] Choice already at max level: ${choice.upgradeType}`);
            return false;
          }
        }
        break;
      }

      case UpgradeCategory.PASSIVE: {
        const key = `${choice.upgradeType}Level` as keyof PassiveSkillsComponent;
        const currentVal = passives[key] as number;
        if (currentVal >= GAME_CONFIG.passiveSkills.maxLevel) {
          console.warn(`${GAME_CONFIG.logPrefix}[WARN][LevelUpManager] Choice already at max level: ${choice.upgradeType}`);
          return false;
        }
        (passives[key] as number) = currentVal + 1;

        // 最大HP UPの場合: maxHp += 20, hp += 20（BR-G06）
        if (choice.upgradeType === 'maxHp') {
          const hpIncrease = GAME_CONFIG.passiveSkills.maxHp.perLevel;
          health.maxHp += hpIncrease;
          health.hp = Math.min(health.hp + hpIncrease, health.maxHp);
        }
        break;
      }

      case UpgradeCategory.ALLY: {
        if (this.allyCount < GAME_CONFIG.ally.maxCount) {
          const offset = GAME_CONFIG.ally.offsets[this.allyCount];
          this.entityFactory.createAlly(world, playerId, offset);
          this.allyCount++;
        }
        break;
      }

      case UpgradeCategory.HEAL: {
        const healAmount = Math.floor(health.maxHp * GAME_CONFIG.levelUp.fullHealPercent);
        health.hp = Math.min(health.hp + healAmount, health.maxHp);
        break;
      }
    }

    // 通常レベルアップ時のHP回復（HEAL以外）（BR-G04）
    if (choice.category !== UpgradeCategory.HEAL) {
      const healAmount = Math.floor(health.maxHp * GAME_CONFIG.levelUp.normalHealPercent);
      health.hp = Math.min(health.hp + healAmount, health.maxHp);
    }

    // レベルアップ完了
    this.currentLevel++;
    this.generatedChoiceIds.clear();
    gameStateManager.changeState(GameState.PLAYING);

    return true;
  }

  getCurrentLevel(): number {
    return this.currentLevel;
  }

  getXPProgress(): { current: number; required: number } {
    const prevRequired = this.currentLevel <= 1 ? 0 : this.getXPRequiredForLevel(this.currentLevel - 1);
    const nextRequired = this.getXPRequiredForLevel(this.currentLevel);
    return {
      current: this.currentXP - prevRequired,
      required: nextRequired - prevRequired,
    };
  }

  getCurrentXP(): number {
    return this.currentXP;
  }

  getAllyCount(): number {
    return this.allyCount;
  }

  reset(): void {
    this.currentLevel = 1;
    this.currentXP = 0;
    this.generatedChoiceIds.clear();
    this.allyCount = 0;
  }

  private getWeaponDescription(type: WeaponType, level: number): string {
    const names: Record<string, string> = {
      [WeaponType.FORWARD]: '前方射撃',
      [WeaponType.SPREAD]: '拡散射撃',
      [WeaponType.PIERCING]: '貫通弾',
    };
    return level === 1 && type !== WeaponType.FORWARD
      ? `${names[type]} 新規取得`
      : `${names[type]} Lv${level}`;
  }

  private generateUniqueId(): string {
    return `choice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
