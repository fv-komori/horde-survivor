import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { XPDropComponent } from '../components/XPDropComponent';
import { PositionComponent } from '../components/PositionComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { PassiveSkillsComponent } from '../components/PassiveSkillsComponent';
import { LevelUpManager } from '../managers/LevelUpManager';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * S-09: XP回収システム（優先度8）
 * business-logic-model セクション7.1
 */
export class XPCollectionSystem implements System {
  readonly priority = 8;
  private levelUpManager: LevelUpManager;

  constructor(levelUpManager: LevelUpManager) {
    this.levelUpManager = levelUpManager;
  }

  update(world: World, dt: number): void {
    const playerIds = world.query(PlayerComponent, PositionComponent);
    if (playerIds.length === 0) return;

    const playerId = playerIds[0];
    const playerPos = world.getComponent(playerId, PositionComponent)!;
    const passives = world.getComponent(playerId, PassiveSkillsComponent);
    const xpGainMultiplier = 1 + (passives?.xpGainLevel ?? 0) * GAME_CONFIG.passiveSkills.xpGain.perLevel;
    const collectionRadiusSq = GAME_CONFIG.xpCollection.collectionRadius ** 2;
    const magnetRadiusSq = GAME_CONFIG.xpCollection.magnetRadius ** 2;
    const magnetSpeed = GAME_CONFIG.xpCollection.magnetSpeed;

    const xpIds = world.query(XPDropComponent, PositionComponent);
    for (const xpId of xpIds) {
      const xpPos = world.getComponent(xpId, PositionComponent)!;
      const dx = xpPos.x - playerPos.x;
      const dy = xpPos.y - playerPos.y;
      const distSq = dx * dx + dy * dy;

      // 即座に回収
      if (distSq <= collectionRadiusSq) {
        const xpDrop = world.getComponent(xpId, XPDropComponent)!;
        const actualXP = Math.round(xpDrop.xpAmount * xpGainMultiplier);
        this.levelUpManager.addXP(actualXP);
        world.destroyEntity(xpId);
        continue;
      }

      // 引き寄せ（マグネット範囲内）
      if (distSq <= magnetRadiusSq && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const moveAmount = magnetSpeed * dt;
        const ratio = Math.min(moveAmount / dist, 1);
        xpPos.x -= dx * ratio;
        xpPos.y -= dy * ratio;
      }
    }
  }
}
