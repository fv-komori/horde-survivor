import { Vector3 } from 'three';
import { GAME_CONFIG } from '../config/gameConfig';
import type { SpriteType } from '../types';

/**
 * 2D論理座標 ⇔ 3Dワールド座標変換（FR-09, BL-01）
 *
 * カメラが+Z方向を向くため、画面右 = -worldX。
 * X軸を反転: worldX = (GAME_WIDTH - gameX) * SCALE
 * これにより gameX増加(右移動) → worldX減少 → 画面右 に正しくマッピングされる。
 */
export class CoordinateMapper {
  private static readonly SCALE = GAME_CONFIG.three.coordinate.scale;
  private static readonly GAME_WIDTH = GAME_CONFIG.screen.logicalWidth;

  /** 再利用用ベクトル（GC負荷軽減） */
  private static readonly _tempVec = new Vector3();

  /** 2D論理座標 → 3Dワールド座標（Y=0、高さなし） */
  static toWorld(gameX: number, gameY: number): Vector3 {
    return this._tempVec.set(
      (this.GAME_WIDTH - gameX) * this.SCALE,
      0,
      -(gameY * this.SCALE),
    );
  }

  /** 2D論理座標 → 3Dワールド座標（エンティティ高さ付き） */
  static toWorldWithHeight(gameX: number, gameY: number, spriteType: SpriteType, time?: number): Vector3 {
    const vec = this.toWorld(gameX, gameY);
    vec.y = this.getEntityHeight(spriteType, time);
    return vec;
  }

  /** 3Dワールド座標 → 2D論理座標 */
  static toLogical(worldX: number, worldZ: number): { gameX: number; gameY: number } {
    return {
      gameX: this.GAME_WIDTH - worldX / this.SCALE,
      gameY: -worldZ / this.SCALE,
    };
  }

  /** エンティティタイプ別Y高さ（BL-01） */
  static getEntityHeight(spriteType: SpriteType, _time?: number): number {
    const h = GAME_CONFIG.three.entityHeight;
    switch (spriteType) {
      case 'player': return h.player;
      case 'ally': return h.ally;
      case 'enemy_normal': return h.enemyNormal;
      case 'enemy_fast': return h.enemyFast;
      case 'enemy_tank': return h.enemyTank;
      case 'enemy_boss': return h.enemyBoss;
      case 'bullet': return h.bullet;
      case 'barrel': return h.barrel;
      case 'gate': return h.gate;
      default: return 0;
    }
  }
}
