import type { World } from '../ecs/World';
import { EnemyComponent } from '../components/EnemyComponent';
import { EntityFactory } from '../factories/EntityFactory';
import { WaveManager } from './WaveManager';
import { GAME_CONFIG } from '../config/gameConfig';
import { EnemyType } from '../types';

/**
 * M-03: スポーンマネージャー
 * 敵エンティティの生成とスポーン間隔管理
 */
export class SpawnManager {
  static readonly MAX_ENEMIES = GAME_CONFIG.limits.maxEnemies;

  private spawnTimer: number = 0;
  private entityFactory: EntityFactory;
  private waveManager: WaveManager;

  constructor(entityFactory: EntityFactory, waveManager: WaveManager) {
    this.entityFactory = entityFactory;
    this.waveManager = waveManager;
  }

  /** 毎フレーム呼び出し（business-logic-model 8.4） */
  update(world: World, dt: number, elapsedTime: number): void {
    const spawnConfig = this.waveManager.getSpawnConfig(elapsedTime);

    // 通常敵スポーン
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const currentEnemyCount = this.getEnemyCount(world);
      if (currentEnemyCount < SpawnManager.MAX_ENEMIES) {
        const typeStr = this.waveManager.selectEnemyType(spawnConfig.enemyTypes);
        const enemyType = typeStr as EnemyType;
        const position = this.getRandomSpawnPosition();
        this.entityFactory.createEnemy(world, enemyType, position, spawnConfig.hpMultiplier);
      }
      this.spawnTimer = spawnConfig.interval;
    }

    // ボススポーン
    if (this.waveManager.shouldSpawnBoss(dt, elapsedTime)) {
      const position = this.getRandomSpawnPosition();
      const bossParams = this.waveManager.getBossParams();
      this.entityFactory.createBoss(world, position, bossParams.hp, bossParams.damage, bossParams.xpDrop);
    }
  }

  /** ランダムなスポーン位置を生成 */
  getRandomSpawnPosition(): { x: number; y: number } {
    const margin = 20; // コリジョン半径分のマージン
    const x = margin + Math.random() * (GAME_CONFIG.screen.logicalWidth - margin * 2);
    const y = GAME_CONFIG.enemySpawn.minY + Math.random() * (GAME_CONFIG.enemySpawn.maxY - GAME_CONFIG.enemySpawn.minY);
    return { x, y };
  }

  /** 現在の敵エンティティ数を取得 */
  private getEnemyCount(world: World): number {
    return world.query(EnemyComponent).length;
  }

  reset(): void {
    this.spawnTimer = 0;
  }
}
