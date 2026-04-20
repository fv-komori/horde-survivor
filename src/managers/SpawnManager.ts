import type { World } from '../ecs/World';
import { EnemyComponent } from '../components/EnemyComponent';
import { EntityFactory } from '../factories/EntityFactory';
import { WaveManager } from './WaveManager';
import type { AudioManager } from '../audio/AudioManager';
import { GAME_CONFIG } from '../config/gameConfig';
import { EnemyType } from '../types';

/**
 * M-03: スポーンマネージャー（敵のみ）
 * Iter6 Phase 2a: 旧 itemSpawnTimer とアイテム降下処理を削除
 */
export class SpawnManager {
  static readonly MAX_ENEMIES = GAME_CONFIG.limits.maxEnemies;

  private spawnTimer: number = 0;
  private entityFactory: EntityFactory;
  private waveManager: WaveManager;
  private audioManager: AudioManager;

  constructor(entityFactory: EntityFactory, waveManager: WaveManager, audioManager: AudioManager) {
    this.entityFactory = entityFactory;
    this.waveManager = waveManager;
    this.audioManager = audioManager;
  }

  update(world: World, dt: number, elapsedTime: number): void {
    const spawnConfig = this.waveManager.getSpawnConfig(elapsedTime);

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

    if (this.waveManager.shouldSpawnBoss(dt, elapsedTime)) {
      const currentEnemyCount = this.getEnemyCount(world);
      if (currentEnemyCount < SpawnManager.MAX_ENEMIES) {
        const position = this.getRandomSpawnPosition();
        this.entityFactory.createEnemy(world, EnemyType.BOSS, position, spawnConfig.hitCountMultiplier);
        this.audioManager.playSE('boss_spawn');
      }
    }
  }

  getRandomSpawnPosition(): { x: number; y: number } {
    const minX = GAME_CONFIG.enemySpawn.marginX;
    const maxX = GAME_CONFIG.screen.logicalWidth - GAME_CONFIG.enemySpawn.marginX;
    const x = minX + Math.random() * (maxX - minX);
    const y = GAME_CONFIG.enemySpawn.minY + Math.random() * (GAME_CONFIG.enemySpawn.maxY - GAME_CONFIG.enemySpawn.minY);
    return { x, y };
  }

  private getEnemyCount(world: World): number {
    return world.query(EnemyComponent).length;
  }

  reset(): void {
    this.spawnTimer = 0;
  }
}
