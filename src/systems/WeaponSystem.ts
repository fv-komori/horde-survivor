import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { PositionComponent } from '../components/PositionComponent';
import { WeaponComponent } from '../components/WeaponComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { AllyComponent } from '../components/AllyComponent';
import { BulletComponent } from '../components/BulletComponent';
import { BuffComponent } from '../components/BuffComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { MeshComponent } from '../components/MeshComponent';
import { EntityFactory } from '../factories/EntityFactory';
import type { AudioManager } from '../audio/AudioManager';
import { GAME_CONFIG } from '../config/gameConfig';
import { WEAPON_PARAMS } from '../config/weaponConfig';
import { WeaponGenre, BuffType, EffectType } from '../types';
import type { EntityId } from '../ecs/Entity';

/**
 * S-05: 武器システム（優先度4）
 * business-logic-model セクション4
 * Iteration 2: 単一WeaponComponent・バフ適用・ヒットカウント減算
 */
export class WeaponSystem implements System {
  readonly priority = 4;
  private entityFactory: EntityFactory;
  private audioManager: AudioManager;
  private gameTime: number = 0;

  constructor(entityFactory: EntityFactory, audioManager: AudioManager) {
    this.entityFactory = entityFactory;
    this.audioManager = audioManager;
  }

  update(world: World, dt: number): void {
    this.gameTime += dt;

    // プレイヤーの武器処理（単一WeaponComponent）
    const playerIds = world.query(PlayerComponent, PositionComponent, WeaponComponent);
    for (const playerId of playerIds) {
      const pos = world.getComponent(playerId, PositionComponent)!;
      const weapon = world.getComponent(playerId, WeaponComponent)!;
      const buffs = world.getComponent(playerId, BuffComponent);
      this.processPlayerWeapon(world, playerId, pos, weapon, buffs);
    }

    // 仲間の武器処理（WeaponComponent直接）
    const allyIds = world.query(AllyComponent, PositionComponent, WeaponComponent);
    for (const allyId of allyIds) {
      const pos = world.getComponent(allyId, PositionComponent)!;
      const weapon = world.getComponent(allyId, WeaponComponent)!;
      const ally = world.getComponent(allyId, AllyComponent)!;
      this.processAllyWeapon(world, allyId, pos, weapon, ally);
    }
  }

  private processPlayerWeapon(
    world: World,
    ownerId: EntityId,
    pos: PositionComponent,
    weapon: WeaponComponent,
    buffs: BuffComponent | undefined,
  ): void {
    const config = WEAPON_PARAMS[weapon.weaponGenre];
    if (!config) return;

    // バフ適用: 発射間隔
    let fireInterval = config.fireInterval;
    if (buffs?.hasBuff(BuffType.FIRE_RATE_UP)) {
      fireInterval *= GAME_CONFIG.buff.fireRateMultiplier;
    }

    // 発射間隔チェック
    if (this.gameTime - weapon.lastFiredAt < fireInterval) return;

    // 弾丸数上限チェック（BR-W04）
    if (this.getBulletCount(world) >= GAME_CONFIG.limits.maxBullets) return;

    // バフ適用: 弾数
    let bulletCount = config.bulletCount;
    if (buffs?.hasBuff(BuffType.BARRAGE)) {
      bulletCount *= GAME_CONFIG.buff.barrageBulletMultiplier;
    }

    // バフ適用: ヒットカウント減算（ATTACK_UP: 2, 通常: 1）
    const hitCountReduction = buffs?.hasBuff(BuffType.ATTACK_UP)
      ? GAME_CONFIG.buff.attackUpReduction
      : 1;

    // 銃口位置を計算（描画と合わせる）
    const mesh = world.getComponent(ownerId, MeshComponent);
    const half = mesh ? mesh.logicalWidth / 2 : 32;
    const muzzle = { x: pos.x + half * 0.45, y: pos.y - half * 0.91 };

    // 弾丸生成
    const useBarrageSpread = buffs?.hasBuff(BuffType.BARRAGE) ?? false;
    this.fireBullets(
      world, ownerId, muzzle, weapon.weaponGenre,
      bulletCount, config.bulletSpeed, config.isPiercing,
      config.spreadAngle, config.bulletOffset,
      hitCountReduction, useBarrageSpread,
    );

    weapon.lastFiredAt = this.gameTime;

    // 射撃SE（BR-EV01）
    this.audioManager.playSE('shoot', { isAlly: false });

    // 射撃エフェクト
    this.entityFactory.createEffect(world, EffectType.MUZZLE_FLASH, muzzle);
  }

  private processAllyWeapon(
    world: World,
    allyId: EntityId,
    pos: PositionComponent,
    weapon: WeaponComponent,
    ally: AllyComponent,
  ): void {
    const config = WEAPON_PARAMS[weapon.weaponGenre];
    if (!config) return;

    // 仲間の連射ボーナス適用（BR-AL04）
    const fireInterval = config.fireInterval / (1 + ally.fireRateBonus / 100);

    if (this.gameTime - weapon.lastFiredAt < fireInterval) return;
    if (this.getBulletCount(world) >= GAME_CONFIG.limits.maxBullets) return;

    // 銃口位置を計算
    const mesh = world.getComponent(allyId, MeshComponent);
    const half = mesh ? mesh.logicalWidth / 2 : 24;
    const muzzle = { x: pos.x + half * 0.42, y: pos.y - half * 0.78 };

    // 仲間弾丸は常にhitCountReduction = 1（BR-AL03）
    this.fireBullets(
      world, allyId, muzzle, weapon.weaponGenre,
      config.bulletCount, config.bulletSpeed, config.isPiercing,
      config.spreadAngle, config.bulletOffset,
      1, false,
    );

    weapon.lastFiredAt = this.gameTime;

    // 仲間射撃SE（BR-EV02: 音量50%、クールダウン0.2秒）
    this.audioManager.playSE('shoot', { isAlly: true });
  }

  private fireBullets(
    world: World,
    ownerId: EntityId,
    origin: { x: number; y: number },
    weaponGenre: WeaponGenre,
    bulletCount: number,
    bulletSpeed: number,
    isPiercing: boolean,
    spreadAngle: number,
    bulletOffset: number,
    hitCountReduction: number,
    useBarrageSpread: boolean,
  ): void {
    const count = bulletCount;

    // 発射方向: 常に真上（BR-W06）
    const targetDirX = 0;
    const targetDirY = -1;

    // BARRAGE時は扇状発射に切り替え
    const effectiveSpreadAngle = useBarrageSpread
      ? (GAME_CONFIG.buff.barrageSpread[weaponGenre] ?? 30)
      : spreadAngle;

    if (effectiveSpreadAngle > 0 || (weaponGenre === WeaponGenre.SHOTGUN && spreadAngle > 0)) {
      // 拡散射撃 / BARRAGE: 扇状に均等配置
      const angleRad = (effectiveSpreadAngle * Math.PI) / 180;
      const baseAngle = Math.atan2(targetDirY, targetDirX);

      for (let i = 0; i < count; i++) {
        if (this.getBulletCount(world) >= GAME_CONFIG.limits.maxBullets) break;

        const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
        const angle = baseAngle + t * angleRad;
        const vx = Math.cos(angle) * bulletSpeed;
        const vy = Math.sin(angle) * bulletSpeed;
        this.entityFactory.createBullet(world, { x: origin.x, y: origin.y }, { vx, vy }, hitCountReduction, isPiercing, ownerId);
      }
    } else {
      // 前方射撃 / 貫通弾: 水平オフセット並列発射
      for (let i = 0; i < count; i++) {
        if (this.getBulletCount(world) >= GAME_CONFIG.limits.maxBullets) break;

        const offsetIndex = i - (count - 1) / 2;
        const ox = offsetIndex * bulletOffset;
        const vx = targetDirX * bulletSpeed;
        const vy = targetDirY * bulletSpeed;
        this.entityFactory.createBullet(world, { x: origin.x + ox, y: origin.y }, { vx, vy }, hitCountReduction, isPiercing, ownerId);
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
