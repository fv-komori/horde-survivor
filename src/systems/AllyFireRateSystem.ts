import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { AllyComponent } from '../components/AllyComponent';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * S-11: 仲間連射ボーナスシステム（優先度11）
 * business-logic-model セクション7.6
 * 経過時間に応じて仲間の連射ボーナスを段階的に付与
 */
export class AllyFireRateSystem implements System {
  readonly priority = 11;
  private elapsedTime: number = 0;

  update(world: World, _dt: number): void {
    const allyIds = world.query(AllyComponent);

    for (const allyId of allyIds) {
      const ally = world.getComponent(allyId, AllyComponent)!;

      // 仲間化してからの経過時間に基づくボーナス計算
      const timeSinceJoin = this.elapsedTime - ally.joinTime;
      const bonusTicks = Math.floor(timeSinceJoin / GAME_CONFIG.ally.fireRateBonusInterval);
      const expectedBonus = Math.min(
        bonusTicks * GAME_CONFIG.ally.fireRateBonusPerTick,
        GAME_CONFIG.ally.maxFireRateBonus,
      );

      if (expectedBonus > ally.fireRateBonus) {
        ally.fireRateBonus = expectedBonus;
      }
    }
  }

  /** ゲーム経過時間を設定 */
  setElapsedTime(time: number): void {
    this.elapsedTime = time;
  }

  reset(): void {
    this.elapsedTime = 0;
  }
}
