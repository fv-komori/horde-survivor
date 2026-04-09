import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { PositionComponent } from '../components/PositionComponent';
import { WeaponComponent } from '../components/WeaponComponent';
import { WeaponInventoryComponent } from '../components/WeaponInventoryComponent';
import type { WeaponSlot } from '../components/WeaponInventoryComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { AllyComponent } from '../components/AllyComponent';
import { BulletComponent } from '../components/BulletComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { PassiveSkillsComponent } from '../components/PassiveSkillsComponent';
import { SpriteComponent } from '../components/SpriteComponent';
import { EntityFactory } from '../factories/EntityFactory';
import { GAME_CONFIG } from '../config/gameConfig';
import { WEAPON_CONFIG } from '../config/weaponConfig';
import { WeaponType, EffectType } from '../types';
import type { EntityId } from '../ecs/Entity';

/**
 * S-05: 武器システム（優先度4）
 * business-logic-model セクション4
 */
export class WeaponSystem implements System {
  readonly priority = 4;
  private entityFactory: EntityFactory;
  private gameTime: number = 0;

  constructor(entityFactory: EntityFactory) {
    this.entityFactory = entityFactory;
  }

  update(world: World, dt: number): void {
    this.gameTime += dt;

    // プレイヤーの武器処理（WeaponInventoryComponent経由）
    const playerIds = world.query(PlayerComponent, PositionComponent, WeaponInventoryComponent);
    for (const playerId of playerIds) {
      const pos = world.getComponent(playerId, PositionComponent)!;
      const inventory = world.getComponent(playerId, WeaponInventoryComponent)!;
      const passives = world.getComponent(playerId, PassiveSkillsComponent);
      const attackMultiplier = 1 + (passives?.attackLevel ?? 0) * GAME_CONFIG.passiveSkills.attack.perLevel;

      for (const slot of inventory.weaponSlots) {
        this.processWeaponSlot(world, playerId, pos, slot, attackMultiplier);
      }
    }

    // 仲間の武器処理（WeaponComponent直接）
    const allyIds = world.query(AllyComponent, PositionComponent, WeaponComponent);
    for (const allyId of allyIds) {
      const pos = world.getComponent(allyId, PositionComponent)!;
      const weapon = world.getComponent(allyId, WeaponComponent)!;
      this.processAllyWeapon(world, allyId, pos, weapon);
    }
  }

  private processWeaponSlot(
    world: World,
    ownerId: EntityId,
    pos: PositionComponent,
    slot: WeaponSlot,
    attackMultiplier: number,
  ): void {
    const config = WEAPON_CONFIG[slot.weaponType];
    if (!config) return;

    const levelConfig = config.levels[slot.level - 1];
    if (!levelConfig) return;

    // 発射間隔チェック
    if (this.gameTime - slot.lastFiredAt < levelConfig.fireInterval) return;

    // 弾丸数上限チェック（BR-W04）
    if (this.getBulletCount(world) >= GAME_CONFIG.limits.maxBullets) return;

    const damage = Math.round(levelConfig.damage * attackMultiplier);

    // 銃口位置を計算（描画と合わせる）
    const sprite = world.getComponent(ownerId, SpriteComponent);
    const half = sprite ? sprite.width / 2 : 32;
    const muzzle = { x: pos.x + half * 0.45, y: pos.y - half * 0.91 };

    // 弾丸生成
    this.fireBullets(world, ownerId, muzzle, slot.weaponType, levelConfig, damage, config.bulletOffset);

    slot.lastFiredAt = this.gameTime;

    // 射撃エフェクト
    this.entityFactory.createEffect(world, EffectType.MUZZLE_FLASH, muzzle);
  }

  private processAllyWeapon(
    world: World,
    allyId: EntityId,
    pos: PositionComponent,
    weapon: WeaponComponent,
  ): void {
    const config = WEAPON_CONFIG[weapon.weaponType];
    if (!config) return;

    const levelConfig = config.levels[weapon.level - 1];
    if (!levelConfig) return;

    if (this.gameTime - weapon.lastFiredAt < levelConfig.fireInterval) return;
    if (this.getBulletCount(world) >= GAME_CONFIG.limits.maxBullets) return;

    // 銃口位置を計算
    const sprite = world.getComponent(allyId, SpriteComponent);
    const half = sprite ? sprite.width / 2 : 24;
    const muzzle = { x: pos.x + half * 0.42, y: pos.y - half * 0.78 };

    // 仲間は攻撃力UPパッシブ適用なし（BR-W07, BR-A03）
    this.fireBullets(world, allyId, muzzle, weapon.weaponType, levelConfig, levelConfig.damage, config.bulletOffset);

    weapon.lastFiredAt = this.gameTime;
  }

  private fireBullets(
    world: World,
    ownerId: EntityId,
    origin: { x: number; y: number },
    weaponType: WeaponType,
    levelConfig: { bulletCount: number; bulletSpeed: number; piercing: boolean; spreadAngle?: number },
    damage: number,
    bulletOffset: number,
  ): void {
    const count = levelConfig.bulletCount;

    // 発射方向: 常に真上（BR-W06）
    const targetDirX = 0;
    const targetDirY = -1;

    if (weaponType === WeaponType.SPREAD && levelConfig.spreadAngle) {
      // 拡散射撃: 扇状に均等配置
      const angleRad = (levelConfig.spreadAngle * Math.PI) / 180;
      const baseAngle = Math.atan2(targetDirY, targetDirX);

      for (let i = 0; i < count; i++) {
        if (this.getBulletCount(world) >= GAME_CONFIG.limits.maxBullets) break;

        const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
        const angle = baseAngle + t * angleRad;
        const vx = Math.cos(angle) * levelConfig.bulletSpeed;
        const vy = Math.sin(angle) * levelConfig.bulletSpeed;
        this.entityFactory.createBullet(world, { x: origin.x, y: origin.y }, { vx, vy }, damage, levelConfig.piercing, ownerId);
      }
    } else {
      // 前方射撃 / 貫通弾: 水平オフセット並列発射
      for (let i = 0; i < count; i++) {
        if (this.getBulletCount(world) >= GAME_CONFIG.limits.maxBullets) break;

        const offsetIndex = i - (count - 1) / 2;
        const ox = offsetIndex * bulletOffset;
        const vx = targetDirX * levelConfig.bulletSpeed;
        const vy = targetDirY * levelConfig.bulletSpeed;
        this.entityFactory.createBullet(world, { x: origin.x + ox, y: origin.y }, { vx, vy }, damage, levelConfig.piercing, ownerId);
      }
    }
  }

  /** 最近接敵を検索（BR-W06） */
  findNearestEnemy(world: World, pos: PositionComponent): { x: number; y: number } | null {
    const enemyIds = world.query(EnemyComponent, PositionComponent);
    let nearest: { x: number; y: number } | null = null;
    let minDistSq = Infinity;

    for (const id of enemyIds) {
      const ePos = world.getComponent(id, PositionComponent)!;
      const dx = ePos.x - pos.x;
      const dy = ePos.y - pos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = { x: ePos.x, y: ePos.y };
      }
    }

    return nearest;
  }

  private getBulletCount(world: World): number {
    return world.query(BulletComponent).length;
  }

  setGameTime(time: number): void {
    this.gameTime = time;
  }

  reset(): void {
    this.gameTime = 0;
  }
}
