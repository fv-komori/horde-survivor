import type { World } from '../ecs/World';
import { EnemyComponent } from '../components/EnemyComponent';
import { ItemDropComponent } from '../components/ItemDropComponent';
import { EntityFactory } from '../factories/EntityFactory';
import { WaveManager } from './WaveManager';
import type { AudioManager } from '../audio/AudioManager';
import { GAME_CONFIG } from '../config/gameConfig';
import { EnemyType, ItemType } from '../types';

/** 全ItemTypeの配列（スポーン時のランダム選択用） */
const ALL_ITEM_TYPES: ItemType[] = [
  ItemType.ATTACK_UP,
  ItemType.FIRE_RATE_UP,
  ItemType.SPEED_UP,
  ItemType.BARRAGE,
  ItemType.WEAPON_SPREAD,
  ItemType.WEAPON_PIERCING,
];

/**
 * M-03: スポーンマネージャー
 * 敵エンティティ・アイテムエンティティの生成とスポーン間隔管理
 * Iteration 2: 同時スポーン・ヒットカウントスケーリング・ボスもcreateEnemy統一・アイテムスポーン
 */
export class SpawnManager {
  static readonly MAX_ENEMIES = GAME_CONFIG.limits.maxEnemies; // 300

  private spawnTimer: number = 0;
  private itemSpawnTimer: number = GAME_CONFIG.itemSpawn.interval;
  private entityFactory: EntityFactory;
  private waveManager: WaveManager;
  private audioManager: AudioManager;

  constructor(entityFactory: EntityFactory, waveManager: WaveManager, audioManager: AudioManager) {
    this.entityFactory = entityFactory;
    this.waveManager = waveManager;
    this.audioManager = audioManager;
  }

  /** 毎フレーム呼び出し（business-logic-model 8.4） */
  update(world: World, dt: number, elapsedTime: number): void {
    const spawnConfig = this.waveManager.getSpawnConfig(elapsedTime);

    // 通常敵スポーン（同時スポーン対応）
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const currentEnemyCount = this.getEnemyCount(world);
      const availableSlots = SpawnManager.MAX_ENEMIES - currentEnemyCount;

      if (availableSlots > 0) {
        const spawnCount = Math.min(spawnConfig.simultaneousCount, availableSlots);
        for (let i = 0; i < spawnCount; i++) {
          const typeStr = this.waveManager.selectEnemyType(spawnConfig.enemyTypes);
          const enemyType = typeStr as EnemyType;
          const position = this.getRandomSpawnPosition();
          this.entityFactory.createEnemy(world, enemyType, position, spawnConfig.hitCountMultiplier);
        }
      }
      this.spawnTimer = spawnConfig.interval;
    }

    // ボススポーン（90秒間隔、createEnemyで統一）
    if (this.waveManager.shouldSpawnBoss(dt, elapsedTime)) {
      const currentEnemyCount = this.getEnemyCount(world);
      if (currentEnemyCount < SpawnManager.MAX_ENEMIES) {
        const position = this.getRandomSpawnPosition();
        this.entityFactory.createEnemy(world, EnemyType.BOSS, position, spawnConfig.hitCountMultiplier);
        // ボス出現SE（BR-EV01）
        this.audioManager.playSE('boss_spawn');
      }
    }

    // アイテムスポーン（画面上部から降下するアイテム）
    this.itemSpawnTimer -= dt;
    if (this.itemSpawnTimer <= 0) {
      const currentItemCount = world.query(ItemDropComponent).length;
      if (currentItemCount < GAME_CONFIG.limits.maxItems) {
        const itemType = ALL_ITEM_TYPES[Math.floor(Math.random() * ALL_ITEM_TYPES.length)];
        const position = this.getRandomSpawnPosition();
        this.entityFactory.createItemDrop(world, position, itemType);
      }
      this.itemSpawnTimer = GAME_CONFIG.itemSpawn.interval;
    }
  }

  /** ランダムなスポーン位置を生成 */
  getRandomSpawnPosition(): { x: number; y: number } {
    const minX = GAME_CONFIG.enemySpawn.marginX;
    const maxX = GAME_CONFIG.screen.logicalWidth - GAME_CONFIG.enemySpawn.marginX;
    const x = minX + Math.random() * (maxX - minX);
    const y = GAME_CONFIG.enemySpawn.minY + Math.random() * (GAME_CONFIG.enemySpawn.maxY - GAME_CONFIG.enemySpawn.minY);
    return { x, y };
  }

  /** 現在の敵エンティティ数を取得 */
  private getEnemyCount(world: World): number {
    return world.query(EnemyComponent).length;
  }

  reset(): void {
    this.spawnTimer = 0;
    this.itemSpawnTimer = GAME_CONFIG.itemSpawn.interval;
  }
}
