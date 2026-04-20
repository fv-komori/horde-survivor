import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Sprite,
  SpriteMaterial,
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
  /** Iter4: Smoke/MuzzleFlash など Factory キャッシュ由来の素材を使うエフェクトの dispose をスキップ */
  skipMeshDispose?: boolean;
}

/** パーティクル */
interface Particle {
  mesh: Mesh;
  velocity: Vector3;
}

type EffectKind = 'muzzle_flash' | 'enemy_destroy' | 'buff_column' | 'item_rotate' | 'smoke_puff';

/** 3Dエフェクト管理（BL-08, BR-EF01〜EF04, Iter4: MuzzleFlash強化 + SmokePuff追加） */
export class EffectManager3D {
  private activeEffects: ActiveEffect[] = [];
  private readonly gravity = -9.8;

  /** Iter4: Smoke用共有SpriteMaterialキャッシュ（CanvasTexture含む） */
  private smokeMaterial: SpriteMaterial | null = null;

  /** Iter5: マズルフラッシュ共有 Geometry / Material（Option B 移設、旧ProceduralMeshFactory由来） */
  private muzzleFlashGeo: PlaneGeometry | null = null;
  private muzzleFlashMat: MeshBasicMaterial | null = null;

  constructor(
    private readonly sceneManager: SceneManager,
    private readonly qualityManager: QualityManager,
  ) {}

  /** マズルフラッシュ（BR-EF01, Iter4: 平面放射+emissive+Bloom映え） */
  spawnMuzzleFlash(worldPos: Vector3): void {
    const quality = this.qualityManager.getSettings();
    const group = new Group();
    group.position.copy(worldPos);

    // High品質: PointLightで周囲を照らす
    if (quality.shadowEnabled) {
      const light = new PointLight(0xffee58, 3.0, 1.5);
      group.add(light);
    }

    const flash = this.createMuzzleFlashMesh();
    flash.lookAt(new Vector3(worldPos.x, worldPos.y + 10, worldPos.z));
    group.add(flash);

    this.sceneManager.addEntity(group);
    this.activeEffects.push({
      object: group,
      elapsed: 0,
      duration: 0.08,
      type: 'muzzle_flash',
      skipMeshDispose: true, // 共有 geometry/material のため dispose 不要
    });
  }

  /** マズルフラッシュメッシュ（Iter5 Option B 移設、共有 geometry+material 使用） */
  private createMuzzleFlashMesh(): Mesh {
    if (!this.muzzleFlashGeo) {
      this.muzzleFlashGeo = new PlaneGeometry(0.25, 0.25);
    }
    if (!this.muzzleFlashMat) {
      this.muzzleFlashMat = new MeshBasicMaterial({
        color: 0xffee58,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
    }
    const mesh = new Mesh(this.muzzleFlashGeo, this.muzzleFlashMat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }

  /** Iter4: 着弾・撃破時の煙パフ（Sprite + 共有Material、ビルボード自動、LRU運用） */
  spawnSmokePuff(worldPos: Vector3): void {
    const quality = this.qualityManager.getSettings();
    // maxParticles 上限を超える場合は最古を即座にクリア（LRU: S-NG-3-iter2対応）
    const currentSmokeCount = this.activeEffects.filter(e => e.type === 'smoke_puff').length;
    if (currentSmokeCount >= quality.maxParticles) {
      const idx = this.activeEffects.findIndex(e => e.type === 'smoke_puff');
      if (idx >= 0) {
        const old = this.activeEffects[idx];
        this.sceneManager.removeEntity(old.object);
        this.disposeEffect(old);
        this.activeEffects.splice(idx, 1);
      }
    }

    const mat = this.getSmokeMaterial();
    const sprite = new Sprite(mat);
    sprite.scale.set(0.4, 0.4, 1);
    sprite.position.copy(worldPos);
    this.sceneManager.addEntity(sprite);
    this.activeEffects.push({
      object: sprite,
      elapsed: 0,
      duration: 0.5,
      type: 'smoke_puff',
      skipMeshDispose: true, // SpriteMaterialはキャッシュ共有
    });
  }

  /** Smoke用SpriteMaterial取得（CanvasTextureで白グラデ円、キャッシュ共有） */
  private getSmokeMaterial(): SpriteMaterial {
    if (this.smokeMaterial) return this.smokeMaterial;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new CanvasTexture(canvas);
    this.smokeMaterial = new SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    return this.smokeMaterial;
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

    // Iter4: 撃破時に煙パフも追加
    this.spawnSmokePuff(worldPos);
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
        this.sceneManager.removeEntity(effect.object);
        this.disposeEffect(effect);
        this.activeEffects.splice(i, 1);
        continue;
      }

      switch (effect.type) {
        case 'enemy_destroy':
          this.updateDestroyParticles(effect, dt);
          break;
        case 'buff_column':
          this.updateBuffColumn(effect);
          break;
        case 'smoke_puff':
          this.updateSmokePuff(effect);
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
    effect.object.scale.set(1, 1 + progress * targetHeight, 1);
    effect.object.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof MeshBasicMaterial) {
        child.material.opacity = 0.8 * (1 - progress);
      }
    });
  }

  private updateSmokePuff(effect: ActiveEffect): void {
    const progress = effect.elapsed / effect.duration;
    // 上昇しつつフェードアウト&膨張
    const sprite = effect.object as Sprite;
    sprite.position.y += 0.6 * 0.016; // おおよそ 0.6 m/s
    const scale = 0.4 + progress * 0.6;
    sprite.scale.set(scale, scale, 1);
    if (sprite.material instanceof SpriteMaterial) {
      sprite.material.opacity = 1 - progress;
    }
  }

  /** Iter4: Factoryキャッシュ由来のmesh/materialはスキップし、per-effect生成物のみdispose */
  private disposeEffect(effect: ActiveEffect): void {
    if (effect.skipMeshDispose) {
      // Factoryキャッシュ共有のためスキップ（二重破棄防止）
      return;
    }
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

  /** リソース解放（Smoke共有Material含む） */
  dispose(): void {
    this.clearAll();
    if (this.smokeMaterial) {
      if (this.smokeMaterial.map) this.smokeMaterial.map.dispose();
      this.smokeMaterial.dispose();
      this.smokeMaterial = null;
    }
    if (this.muzzleFlashGeo) {
      this.muzzleFlashGeo.dispose();
      this.muzzleFlashGeo = null;
    }
    if (this.muzzleFlashMat) {
      this.muzzleFlashMat.dispose();
      this.muzzleFlashMat = null;
    }
  }
}
