import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { EffectComponent } from '../components/EffectComponent';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * S-12: エフェクトシステム（優先度97）
 * エフェクトのライフサイクル管理とアニメーション更新
 */
export class EffectSystem implements System {
  readonly priority = 97;

  update(world: World, dt: number): void {
    const ids = world.query(EffectComponent);

    // 同時エフェクト上限チェック（NFR-04）
    if (ids.length > GAME_CONFIG.limits.maxEffects) {
      // 最古のエフェクトから破棄
      const excess = ids.length - GAME_CONFIG.limits.maxEffects;
      for (let i = 0; i < excess; i++) {
        world.destroyEntity(ids[i]);
      }
    }

    for (const id of ids) {
      const effect = world.getComponent(id, EffectComponent);
      if (!effect) continue;

      effect.elapsed += dt;

      // アニメーションフレーム進行
      if (effect.frameInterval > 0) {
        effect.currentFrame = Math.min(
          Math.floor(effect.elapsed / effect.frameInterval),
          effect.totalFrames - 1,
        );
      }

      // 表示時間超過で自動破棄
      if (effect.elapsed >= effect.duration) {
        world.destroyEntity(id);
      }
    }
  }
}
