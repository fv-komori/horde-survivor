import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { MeshComponent } from '../components/MeshComponent';
import { AnimationStateComponent } from '../components/AnimationStateComponent';
import { VelocityComponent } from '../components/VelocityComponent';
import { LoopOnce, LoopRepeat, type AnimationAction } from 'three';
import { ANIM_DURATIONS, HITREACT_DURATION } from '../config/BoneAttachmentConfig';

/**
 * S-ANIM-01: アニメーションシステム（Iter5, priority=50、Cleanup/Render より前）
 *
 * 責務:
 *   1. 各エンティティの AnimationMixer を毎フレーム update
 *   2. AnimationStateComponent.current の変化に追従して clip を切替
 *   3. HitReact / Death のワンショット残り時間を減算
 *   4. Velocity と state から走行/静止アニメを自動推定（Run <-> Idle）
 *
 * ワンショット優先度: Death > HitReact > Run_Shoot/Idle_Shoot > Run > Idle
 */
export class AnimationSystem implements System {
  readonly priority = 50;

  /** 現在再生中の action を entity 毎にキャッシュ（clip 切替時に stop() 呼び出し用） */
  private currentActions = new Map<number, AnimationAction>();

  update(world: World, dt: number): void {
    const ids = world.query(MeshComponent, AnimationStateComponent);

    for (const id of ids) {
      const mesh = world.getComponent(id, MeshComponent)!;
      const anim = world.getComponent(id, AnimationStateComponent)!;

      if (!mesh.mixer || !mesh.animations) continue;

      // ワンショット残り時間更新（Death/HitReact）
      if (anim.oneShotRemaining > 0) {
        anim.oneShotRemaining = Math.max(0, anim.oneShotRemaining - dt);
        if (anim.oneShotRemaining === 0 && anim.current === 'HitReact') {
          // HitReact 終了 → Run/Idle に戻す（velocity で判定）
          anim.current = this.idleOrRunFor(world, id);
        }
        // Death の残り 0 は deathComplete フラグ立てて保持（静止ポーズ）
        if (anim.current === 'Death' && anim.oneShotRemaining === 0 && !anim.deathComplete) {
          anim.deathComplete = true;
        }
      } else {
        // 非ワンショット中: 速度から Run/Idle を自動推定（HealthSystem 等がHit/Death を立てたら上書きされる）
        if (anim.current !== 'Death' && anim.current !== 'HitReact') {
          anim.current = this.idleOrRunFor(world, id);
        }
      }

      // 遷移判定
      if (anim.current !== anim.previous) {
        this.transitionTo(id, mesh, anim);
        anim.previous = anim.current;
      }

      mesh.mixer.update(dt);
    }
  }

  /** Velocity から Idle/Run を推定（速度小=Idle、速度あり=Run） */
  private idleOrRunFor(world: World, id: number): 'Idle' | 'Run' {
    const vel = world.getComponent(id, VelocityComponent);
    if (!vel) return 'Idle';
    const sq = vel.vx * vel.vx + vel.vy * vel.vy;
    return sq > 0.01 ? 'Run' : 'Idle';
  }

  /** clip 遷移（前の action を停止、新 action を再生） */
  private transitionTo(id: number, mesh: MeshComponent, anim: AnimationStateComponent): void {
    if (!mesh.mixer || !mesh.animations) return;
    const clip = mesh.animations.get(anim.current);
    if (!clip) return;

    const prev = this.currentActions.get(id);
    prev?.fadeOut(0.1);

    const action = mesh.mixer.clipAction(clip);
    const oneShot = anim.current === 'HitReact' || anim.current === 'Death';
    action.reset();
    action.setLoop(oneShot ? LoopOnce : LoopRepeat, Infinity);
    action.clampWhenFinished = oneShot;
    action.fadeIn(0.1).play();
    this.currentActions.set(id, action);
  }

  /** 外部からのワンショット要求（HealthSystem/CombatSystem から呼ぶ） */
  playHitReact(world: World, id: number): void {
    const anim = world.getComponent(id, AnimationStateComponent);
    if (!anim || anim.current === 'Death') return;
    anim.current = 'HitReact';
    anim.oneShotRemaining = HITREACT_DURATION;
  }

  playDeath(world: World, id: number): void {
    const anim = world.getComponent(id, AnimationStateComponent);
    if (!anim) return;
    anim.current = 'Death';
    anim.oneShotRemaining = ANIM_DURATIONS.Death;
    anim.deathComplete = false;
  }

  /** 内部キャッシュクリア（world.clear() / reset 時に呼ぶ） */
  reset(): void {
    this.currentActions.clear();
  }
}
