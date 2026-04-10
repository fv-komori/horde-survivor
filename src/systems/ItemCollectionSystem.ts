import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { ItemDropComponent } from '../components/ItemDropComponent';
import { PositionComponent } from '../components/PositionComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { BuffComponent } from '../components/BuffComponent';
import { WeaponComponent } from '../components/WeaponComponent';
import { GAME_CONFIG } from '../config/gameConfig';
import { WEAPON_CONFIG } from '../config/weaponConfig';
import { itemTypeToBuff, itemTypeToWeapon } from '../types';

/**
 * S-08: アイテム回収システム（優先度8）
 * business-logic-model セクション7.1-7.2
 * アイテムのライフタイム管理・マグネット引き寄せ・回収処理
 */
export class ItemCollectionSystem implements System {
  readonly priority = 8;

  update(world: World, dt: number): void {
    // プレイヤー検索
    const playerIds = world.query(PlayerComponent, PositionComponent);
    if (playerIds.length === 0) return;

    const playerId = playerIds[0];
    const playerPos = world.getComponent(playerId, PositionComponent)!;
    const buff = world.getComponent(playerId, BuffComponent);
    const weapon = world.getComponent(playerId, WeaponComponent);

    const collectionRadiusSq = GAME_CONFIG.itemCollection.collectionRadius ** 2;
    const magnetRadiusSq = GAME_CONFIG.itemCollection.magnetRadius ** 2;
    const magnetSpeed = GAME_CONFIG.itemCollection.magnetSpeed;

    const itemIds = world.query(ItemDropComponent, PositionComponent);
    for (const itemId of itemIds) {
      const item = world.getComponent(itemId, ItemDropComponent)!;
      const itemPos = world.getComponent(itemId, PositionComponent)!;

      // ライフタイム管理
      item.remainingTime -= dt;
      if (item.remainingTime <= GAME_CONFIG.itemDrop.blinkStartTime) {
        item.isBlinking = true;
      }
      if (item.remainingTime <= 0) {
        world.destroyEntity(itemId);
        continue;
      }

      // プレイヤーとの距離計算
      const dx = itemPos.x - playerPos.x;
      const dy = itemPos.y - playerPos.y;
      const distSq = dx * dx + dy * dy;

      // 即座回収
      if (distSq <= collectionRadiusSq) {
        this.applyItemEffect(item, buff, weapon);
        world.destroyEntity(itemId);
        continue;
      }

      // マグネット引き寄せ
      if (distSq <= magnetRadiusSq && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const moveAmount = magnetSpeed * dt;
        const ratio = Math.min(moveAmount / dist, 1);
        itemPos.x -= dx * ratio;
        itemPos.y -= dy * ratio;
      }
    }
  }

  /** アイテム効果を適用 */
  private applyItemEffect(
    item: ItemDropComponent,
    buff: BuffComponent | undefined,
    weapon: WeaponComponent | undefined,
  ): void {
    // パワーアップアイテム → バフ適用
    const buffType = itemTypeToBuff(item.itemType);
    if (buffType !== null && buff) {
      buff.applyBuff(buffType, GAME_CONFIG.buff.duration);
      return;
    }

    // 武器アイテム → 武器切り替え
    const weaponType = itemTypeToWeapon(item.itemType);
    if (weaponType !== null && weapon) {
      const weaponCfg = WEAPON_CONFIG[weaponType];
      if (weaponCfg) {
        weapon.weaponType = weaponType;
        weapon.fireInterval = weaponCfg.fireInterval;
      }
    }
  }
}
