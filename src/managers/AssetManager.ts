import { AnimationClip, Group, Mesh, MeshStandardMaterial, Object3D, Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GAME_CONFIG } from '../config/gameConfig';
import { WeaponGenre } from '../types';
import {
  CHARACTER_PATHS,
  GUN_PATHS,
  ENV_PATHS,
  type CharacterKey,
  type GunKey,
  type EnvKey,
} from '../config/AssetPaths';

const LOG_PREFIX = GAME_CONFIG.logPrefix;

/** AssetManager が保持する glTF テンプレート（entity 毎に SkeletonUtils.clone で複製する元） */
export interface CharacterTemplate {
  scene: Group;
  animations: AnimationClip[];
}

export interface GunTemplate {
  scene: Group;
}

export interface EnvTemplate {
  scene: Group;
}

/** 進捗コールバック（LoaderScreen からの観測用） */
export type LoaderProgress = (loaded: number, total: number, currentLabel: string) => void;

/**
 * M-06: アセットマネージャー（Iter5: glTF プリロード対応）
 *
 * ゲーム開始前に全アセットを GLTFLoader でロードし、テンプレートとして保持する。
 * EntityFactory / SceneManager は本クラスから取得してクローンする（DI 制約）。
 * Iter5: Toon Shooter Game Kit（.glb 単一バイナリ）を使用、CSP `connect-src 'self'` と整合。
 */
export class AssetManager {
  private loaded: boolean = false;
  private readonly characters = new Map<CharacterKey, CharacterTemplate>();
  private readonly guns = new Map<GunKey, GunTemplate>();
  private readonly envs = new Map<EnvKey, EnvTemplate>();

  /** 全アセットロード（タイトル表示前に await 必須） */
  async loadAll(onProgress?: LoaderProgress): Promise<void> {
    const loader = new GLTFLoader();

    const entries: Array<{ key: string; url: string; kind: 'char' | 'gun' | 'env' }> = [
      ...(Object.entries(CHARACTER_PATHS) as Array<[CharacterKey, string]>).map(([key, url]) => ({ key, url, kind: 'char' as const })),
      ...(Object.entries(GUN_PATHS) as Array<[GunKey, string]>).map(([key, url]) => ({ key, url, kind: 'gun' as const })),
      ...(Object.entries(ENV_PATHS) as Array<[EnvKey, string]>).map(([key, url]) => ({ key, url, kind: 'env' as const })),
    ];
    const total = entries.length;
    let loadedCount = 0;
    onProgress?.(0, total, 'starting');

    for (const e of entries) {
      onProgress?.(loadedCount, total, `${e.kind}: ${e.key}`);
      try {
        const gltf = await loader.loadAsync(e.url);
        if (e.kind === 'char') {
          this.characters.set(e.key as CharacterKey, { scene: gltf.scene, animations: gltf.animations });
        } else if (e.kind === 'gun') {
          this.guns.set(e.key as GunKey, { scene: gltf.scene });
        } else {
          this.envs.set(e.key as EnvKey, { scene: gltf.scene });
        }
      } catch (err) {
        // NFR-08: 単一アセット失敗はログしてスキップ。致命エラーなら呼び出し側で判定
        console.error(`${LOG_PREFIX}[ERROR][AssetManager] failed to load ${e.url}`, err);
      }
      loadedCount += 1;
      onProgress?.(loadedCount, total, `${e.kind}: ${e.key}`);
    }

    this.loaded = true;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getCharacter(key: CharacterKey): CharacterTemplate {
    const t = this.characters.get(key);
    if (!t) throw new Error(`AssetManager: character template not loaded: ${key}`);
    return t;
  }

  getGun(key: GunKey): GunTemplate {
    const t = this.guns.get(key);
    if (!t) throw new Error(`AssetManager: gun template not loaded: ${key}`);
    return t;
  }

  getEnv(key: EnvKey): EnvTemplate {
    const t = this.envs.get(key);
    if (!t) throw new Error(`AssetManager: env template not loaded: ${key}`);
    return t;
  }

  hasCharacter(key: CharacterKey): boolean {
    return this.characters.has(key);
  }

  /**
   * Iter6 / S-SVC-02: 武器樽テンプレート（Crate.glb）を entity ごとに clone。
   * material は clone 独立化し、武器樽ごとに tint やフラッシュを適用可能にする。
   * geometry は共有（CleanupSystem が dispose 非対象）。
   */
  cloneBarrelTemplate(): Object3D {
    const tmpl = this.getEnv('Crate');
    const root = tmpl.scene.clone(true);
    root.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh) return;
      if (Array.isArray(m.material)) m.material = m.material.map(x => x.clone());
      else if (m.material) m.material = m.material.clone();
    });
    return root;
  }

  /**
   * Iter6 / S-SVC-02: 武器ジャンル別のガン GLTF を entity ごとに clone。
   * MACHINEGUN は AK.glb を流用し material.color のみ変更（NFR-08: shader 再コンパイル禁止）。
   */
  cloneWeaponTemplate(genre: WeaponGenre): Object3D {
    const gunKey = this.genreToGunKey(genre);
    const tmpl = this.getGun(gunKey);
    const root = tmpl.scene.clone(true);
    root.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh) return;
      if (Array.isArray(m.material)) m.material = m.material.map(x => x.clone());
      else if (m.material) m.material = m.material.clone();
    });
    const tint = this.genreTint(genre);
    if (tint !== null) this.applyTint(root, tint);
    return root;
  }

  private genreToGunKey(genre: WeaponGenre): GunKey {
    switch (genre) {
      case WeaponGenre.RIFLE: return 'AK';
      case WeaponGenre.SHOTGUN: return 'Shotgun';
      case WeaponGenre.MACHINEGUN: return 'AK';
    }
  }

  private genreTint(genre: WeaponGenre): number | null {
    // MACHINEGUN は AK 流用のため tint で差別化（NFR-08: material.color のみ）
    return genre === WeaponGenre.MACHINEGUN ? 0x3a6ea5 : null;
  }

  private applyTint(root: Object3D, color: number): void {
    root.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh || !m.material) return;
      const materials = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of materials) {
        const c = (mat as unknown as { color?: { set: (v: number) => void } }).color;
        if (c) c.set(color);
      }
    });
  }

  /**
   * Iter5 / BL-07 / S-SVC-06b:
   * WebGL コンテキスト復帰時に全テンプレートのテクスチャを needsUpdate=true にする。
   * clone 側 material / texture はテンプレートと参照共有のため、テンプレート側を更新すれば全 entity に波及する。
   */
  restoreTextures(): void {
    const markTextures = (root: Group): void => {
      root.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of materials) {
          if (!mat) continue;
          const textureKeys: Array<keyof MeshStandardMaterial> = [
            'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap',
          ];
          for (const k of textureKeys) {
            const tex = (mat as unknown as Record<string, unknown>)[k as string];
            if (tex instanceof Texture) tex.needsUpdate = true;
          }
          mat.needsUpdate = true;
        }
      });
    };

    for (const t of this.characters.values()) markTextures(t.scene);
    for (const t of this.guns.values()) markTextures(t.scene);
    for (const t of this.envs.values()) markTextures(t.scene);
  }
}
