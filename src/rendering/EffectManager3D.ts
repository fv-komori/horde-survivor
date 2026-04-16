import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  PointLight,
  Vector3,
} from 'three';
import type { SceneManager } from './SceneManager';
import type { QualityManager } from './QualityManager';

/** 3Dエフェクト情報 */
interface ActiveEffect {
  object: Object3D;
  elapsed: number;
  duration: number;
  type: EffectKind;
  particles?: Particle[];
}

/** パーティクル */
interface Particle {
  mesh: Mesh;
  velocity: Vector3;
}

type EffectKind = 'muzzle_flash' | 'enemy_destroy' | 'buff_column' | 'item_rotate';

/** 3Dエフェクト管理（BL-08, BR-EF01〜EF04） */
export class EffectManager3D {
  private activeEffects: ActiveEffect[] = [];
  private readonly gravity = -9.8;

  constructor(
    private readonly sceneManager: SceneManager,
    private readonly qualityManager: QualityManager,
  ) {}

  /** マズルフラッシュ（BR-EF01） */
  spawnMuzzleFlash(worldPos: Vector3): void {
    const quality = this.qualityManager.getSettings();
    const group = new Group();
    group.position.copy(worldPos);

    if (quality.shadowEnabled) {
      // High品質: PointLight付き
      const light = new PointLight(0xffff00, 2.0, 1.0);
      group.add(light);
    }

    // 小さな発光パーティクル
    const flashGeo = new BoxGeometry(0.05, 0.05, 0.05);
    const flashMat = new MeshBasicMaterial({ color: 0xffff00 });
    const flashMesh = new Mesh(flashGeo, flashMat);
    group.add(flashMesh);

    this.sceneManager.addEntity(group);
    this.activeEffects.push({
      object: group,
      elapsed: 0,
      duration: 0.05,
      type: 'muzzle_flash',
    });
  }

  /** 敵撃破パーティクル（BR-EF02） */
  spawnEnemyDestroy(worldPos: Vector3, baseColor: string): void {
    const quality = this.qualityManager.getSettings();
    const count = Math.min(quality.maxParticles, 8);
    const color = new Color(baseColor);
    const group = new Group();
    group.position.copy(worldPos);

    const particles: Particle[] = [];
    const geo = new BoxGeometry(0.04, 0.04, 0.04);
    const mat = new MeshToonMaterial({ color });

    for (let i = 0; i < count; i++) {
      const mesh = new Mesh(geo, mat);
      const angle = (i / count) * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2;
      const velocity = new Vector3(
        Math.cos(angle) * speed,
        2 + Math.random() * 3,
        Math.sin(angle) * speed,
      );
      group.add(mesh);
      particles.push({ mesh, velocity });
    }

    this.sceneManager.addEntity(group);
    this.activeEffects.push({
      object: group,
      elapsed: 0,
      duration: 0.5,
      type: 'enemy_destroy',
      particles,
    });
  }

  /** バフ取得光の柱（BR-EF03） */
  spawnBuffColumn(worldPos: Vector3, buffColor: string): void {
    const group = new Group();
    group.position.copy(worldPos);

    const geo = new CylinderGeometry(0.15, 0.15, 0.01, 8);
    const mat = new MeshBasicMaterial({ color: new Color(buffColor), transparent: true, opacity: 0.8 });
    const pillar = new Mesh(geo, mat);
    group.add(pillar);

    this.sceneManager.addEntity(group);
    this.activeEffects.push({
      object: group,
      elapsed: 0,
      duration: 0.3,
      type: 'buff_column',
    });
  }

  /** エフェクト更新（毎フレーム） */
  updateEffects(dt: number): void {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      effect.elapsed += dt;

      if (effect.elapsed >= effect.duration) {
        // 完了 → 除去
        this.sceneManager.removeEntity(effect.object);
        this.disposeEffect(effect);
        this.activeEffects.splice(i, 1);
        continue;
      }

      // タイプ別アニメーション
      switch (effect.type) {
        case 'enemy_destroy':
          this.updateDestroyParticles(effect, dt);
          break;
        case 'buff_column':
          this.updateBuffColumn(effect);
          break;
      }
    }
  }

  private updateDestroyParticles(effect: ActiveEffect, dt: number): void {
    if (!effect.particles) return;
    for (const p of effect.particles) {
      p.velocity.y += this.gravity * dt;
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;
    }
    // フェードアウト
    const alpha = 1 - effect.elapsed / effect.duration;
    effect.object.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof MeshToonMaterial) {
        child.material.opacity = alpha;
        child.material.transparent = true;
      }
    });
  }

  private updateBuffColumn(effect: ActiveEffect): void {
    const progress = effect.elapsed / effect.duration;
    const targetHeight = 2.0;
    // 柱が上方向に伸びる
    effect.object.scale.set(1, 1 + progress * targetHeight, 1);
    // フェードアウト
    effect.object.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof MeshBasicMaterial) {
        child.material.opacity = 0.8 * (1 - progress);
      }
    });
  }

  private disposeEffect(effect: ActiveEffect): void {
    effect.object.traverse((child) => {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  /** 全エフェクトクリア */
  clearAll(): void {
    for (const effect of this.activeEffects) {
      this.sceneManager.removeEntity(effect.object);
      this.disposeEffect(effect);
    }
    this.activeEffects.length = 0;
  }
}
