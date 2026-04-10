import { EnemyType, ItemType } from '../types';
import { GAME_CONFIG } from '../config/gameConfig';
import { ENEMY_CONFIG } from '../config/enemyConfig';
import { BOSS_CONFIG } from '../config/enemyConfig';
import { POWERUP_DROP_WEIGHTS, WEAPON_DROP_TYPES } from '../config/itemConfig';

/**
 * M-04: アイテムドロップマネージャー
 * business-logic-model セクション7.4
 * 敵撃破時のアイテムドロップ判定とアイテムタイプ選択
 */
export class ItemDropManager {

  /** 敵タイプと現在のアイテム数に基づきドロップアイテムを決定 */
  determineDrops(enemyType: EnemyType, currentItemCount: number): ItemType[] {
    const drops: ItemType[] = [];

    // アイテム上限チェック（ボスは例外）
    if (currentItemCount >= GAME_CONFIG.limits.maxItems && enemyType !== EnemyType.BOSS) {
      return drops;
    }

    const enemyCfg = ENEMY_CONFIG[enemyType];

    // 武器ドロップ判定（BR-ID03）
    if (Math.random() < enemyCfg.weaponDropRate) {
      drops.push(this.selectWeaponType());
    }

    // パワーアップドロップ判定（BR-ID02）
    if (Math.random() < enemyCfg.itemDropRate) {
      drops.push(this.selectPowerUpType());
    }

    // ボス追加ドロップ（BR-ID04: 合計2-3個）
    if (enemyType === EnemyType.BOSS) {
      const extraCount = BOSS_CONFIG.bossDropCount.min - 1 +
        Math.floor(Math.random() * (BOSS_CONFIG.bossDropCount.max - BOSS_CONFIG.bossDropCount.min + 1));
      for (let i = 0; i < extraCount; i++) {
        drops.push(this.selectPowerUpType());
      }
    }

    return drops;
  }

  /** 武器タイプをランダム選択（BR-ID03） */
  private selectWeaponType(): ItemType {
    const types = WEAPON_DROP_TYPES;
    const index = Math.floor(Math.random() * types.length);
    return types[index] as unknown as ItemType;
  }

  /** パワーアップタイプを重み付きランダム選択（BR-ID02） */
  private selectPowerUpType(): ItemType {
    const entries = Object.entries(POWERUP_DROP_WEIGHTS);
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * totalWeight;

    for (const [type, weight] of entries) {
      roll -= weight;
      if (roll <= 0) {
        return type as unknown as ItemType;
      }
    }

    // フォールバック（浮動小数点誤差対策）
    return entries[entries.length - 1][0] as unknown as ItemType;
  }
}
