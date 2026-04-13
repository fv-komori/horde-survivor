import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { AllyComponent } from '../components/AllyComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { PositionComponent } from '../components/PositionComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { EntityFactory } from '../factories/EntityFactory';
import type { AudioManager } from '../audio/AudioManager';
import { GAME_CONFIG } from '../config/gameConfig';
import { EffectType } from '../types';
import type { EntityId } from '../ecs/Entity';
import type { Position } from '../types';

/**
 * S-10: 仲間化システム（優先度10）
 * business-logic-model セクション7.5
 * 敵撃破時の仲間化判定と仲間エンティティ生成
 */
export class AllyConversionSystem implements System {
  readonly priority = 10;
  private entityFactory: EntityFactory;
  private audioManager: AudioManager;

  constructor(entityFactory: EntityFactory, audioManager: AudioManager) {
    this.entityFactory = entityFactory;
    this.audioManager = audioManager;
  }

  update(_world: World, _dt: number): void {
    // 本システムはイベント駆動（tryConvertToAlly）のため、毎フレーム処理なし
  }

  /** 敵撃破時に仲間化を試みる */
  tryConvertToAlly(
    world: World,
    enemyEntity: EntityId,
    defeatPosition: Position,
    elapsedTime: number,
  ): boolean {
    // 仲間上限チェック
    const allyCount = world.query(AllyComponent).length;
    if (allyCount >= GAME_CONFIG.ally.maxCount) {
      return false;
    }

    // 仲間化確率判定
    const enemy = world.getComponent(enemyEntity, EnemyComponent);
    if (!enemy) return false;

    if (Math.random() >= enemy.conversionRate) {
      return false;
    }

    // プレイヤー検索
    const playerIds = world.query(PlayerComponent, PositionComponent);
    if (playerIds.length === 0) return false;
    const playerId = playerIds[0];

    // 仲間エンティティ生成
    const allyIndex = allyCount;
    this.entityFactory.createAlly(world, playerId, allyIndex, elapsedTime);

    // 仲間化エフェクト生成
    this.entityFactory.createEffect(world, EffectType.ALLY_CONVERT, defeatPosition);

    // 仲間化SE（BR-EV01）
    this.audioManager.playSE('ally_convert');

    return true;
  }
}
