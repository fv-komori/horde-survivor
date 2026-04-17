import {
  BackSide,
  Color,
  Group,
  Mesh,
  Object3D,
  ShaderMaterial,
  SkinnedMesh,
  AnimationMixer,
  AnimationClip,
} from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { EntityId } from '../ecs/Entity';
import type { World } from '../ecs/World';
import { PositionComponent } from '../components/PositionComponent';
import { VelocityComponent } from '../components/VelocityComponent';
import { MeshComponent } from '../components/MeshComponent';
import { HealthComponent } from '../components/HealthComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { BulletComponent } from '../components/BulletComponent';
import { WeaponComponent } from '../components/WeaponComponent';
import { AllyComponent } from '../components/AllyComponent';
import { HitCountComponent } from '../components/HitCountComponent';
import { ItemDropComponent } from '../components/ItemDropComponent';
import { BuffComponent } from '../components/BuffComponent';
import { EffectComponent } from '../components/EffectComponent';
import { AnimationStateComponent } from '../components/AnimationStateComponent';
import { GAME_CONFIG } from '../config/gameConfig';
import { ENEMY_CONFIG } from '../config/enemyConfig';
import { WEAPON_CONFIG } from '../config/weaponConfig';
import { BONE_ATTACH } from '../config/BoneAttachmentConfig';
import { EnemyType, WeaponType, EffectType, ItemType, ColliderType, ITEM_COLORS } from '../types';
import type { Position, SpriteType } from '../types';
import type { CharacterKey, GunKey } from '../config/AssetPaths';
import type { AssetManager } from '../managers/AssetManager';
import type { SceneManager } from '../rendering/SceneManager';
import type { InstancedMeshPool } from '../rendering/InstancedMeshPool';

const OUTLINE_VERTEX_SHADER = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
uniform float outlineThickness;
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec3 objectNormal = normalize(normal);
  #include <skinnormal_vertex>
  vec3 outlineNormal = normalize(normalMatrix * objectNormal);
  vec4 pos = modelViewMatrix * vec4(transformed, 1.0);
  pos.xyz += outlineNormal * outlineThickness;
  gl_Position = projectionMatrix * pos;
}
`;

const OUTLINE_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 outlineColor;
void main() { gl_FragColor = vec4(outlineColor, 1.0); }
`;

/**
 * Iter5: GLTF キャラは実寸 ~1.8m で配置されているが、ゲームの world 座標系では
 * 旧プロシージャルキャラ（~0.9 unit tall）相当のサイズ感を期待している。
 * 全キャラに共通で適用する基本スケール（1.0/1.8 ≒ 0.55）。
 */
const CHAR_BASE_SCALE = 0.55;

/** 敵 type → (CharacterKey, scale, tint) 変換表（Iter5: 単一モデル + scale/tint方針） */
const ENEMY_VARIANT: Record<EnemyType, { key: CharacterKey; scale: number; tint: number | null }> = {
  [EnemyType.NORMAL]: { key: 'ENEMY', scale: 1.0, tint: null },
  [EnemyType.FAST]: { key: 'ENEMY', scale: 0.85, tint: 0xff9800 },
  [EnemyType.TANK]: { key: 'ENEMY', scale: 1.3, tint: 0x7b1fa2 },
  [EnemyType.BOSS]: { key: 'HAZMAT', scale: 1.8, tint: 0xb71c1c },
};

/**
 * Toon Shooter Game Kit のキャラ GLTF には複数の武器メッシュ（AK / Pistol / Shotgun / Knife 等）が
 * あらかじめ各 bone に attach されている。Iter5 では GunKey で指定した武器のみを見せたいため、
 * 不要な兄弟武器メッシュを非表示化する（削除は skeleton 参照を壊し得るため visible=false に留める）。
 */
const KNOWN_GUN_NAMES = new Set([
  'AK', 'GrenadeLauncher', 'Knife_1', 'Knife_2', 'Pistol', 'Revolver',
  'Revolver_Small', 'RocketLauncher', 'ShortCannon', 'Shotgun', 'Shovel', 'SMG',
]);

/**
 * S-SVC-03: エンティティ生成ファクトリ（Iter5: GLTF テンプレートを SkeletonUtils.clone）
 */
export class EntityFactory {
  private assetManager: AssetManager | null = null;
  private sceneManager: SceneManager | null = null;
  private bulletPool: InstancedMeshPool | null = null;
  private itemPool: InstancedMeshPool | null = null;

  /** Three.js依存を注入（DI） */
  initThree(
    assetManager: AssetManager,
    sceneManager: SceneManager,
    bulletPool: InstancedMeshPool,
    itemPool: InstancedMeshPool,
  ): void {
    this.assetManager = assetManager;
    this.sceneManager = sceneManager;
    this.bulletPool = bulletPool;
    this.itemPool = itemPool;
  }

  // ---------- GLTF ヘルパー ----------

  /** Character テンプレートを per-entity clone（skeleton 含む全depth clone、material 独立化） */
  private cloneCharacter(key: CharacterKey): { root: Group; mixer: AnimationMixer; anims: Map<string, AnimationClip> } {
    const tmpl = this.assetManager!.getCharacter(key);
    const root = skeletonClone(tmpl.scene) as Group;

    // material を entity ごとに独立化（tint / 被弾フラッシュの波及防止）
    root.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh) return;
      if (Array.isArray(m.material)) m.material = m.material.map(x => x.clone());
      else if (m.material) m.material = m.material.clone();
    });

    const mixer = new AnimationMixer(root);
    const anims = new Map<string, AnimationClip>();
    for (const clip of tmpl.animations) anims.set(clip.name, clip);
    return { root, mixer, anims };
  }

  /** tint 適用（全 material の color を上書き） */
  private applyTint(root: Object3D, color: number): void {
    root.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh || !m.material) return;
      const materials = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of materials) {
        if ('color' in mat) (mat as { color: Color }).color.set(color);
      }
    });
  }

  /** 反転ハル Outline mesh（FR-06, C-06, PoC 成立方式: geometry clone + skeleton 共有 bind） */
  private createOutlineMesh(bodyRoot: Object3D): Group {
    const outlineRoot = new Group();
    outlineRoot.name = 'outline-root';
    bodyRoot.traverse((obj) => {
      const body = obj as SkinnedMesh;
      if (!body.isSkinnedMesh) return;
      const clonedGeo = body.geometry.clone();
      const mat = new ShaderMaterial({
        vertexShader: OUTLINE_VERTEX_SHADER,
        fragmentShader: OUTLINE_FRAGMENT_SHADER,
        side: BackSide,
        uniforms: {
          outlineThickness: { value: 0.02 },
          outlineColor: { value: new Color(0x000000) },
        },
      });
      const outline = new SkinnedMesh(clonedGeo, mat);
      outline.name = `${body.name}_outline`;
      outline.bind(body.skeleton, body.bindMatrix);
      outline.scale.copy(body.scale);
      outline.position.copy(body.position);
      outline.quaternion.copy(body.quaternion);
      body.parent!.add(outline);
    });
    return outlineRoot;
  }

  /** gun を LowerArm.R に attach（Day 1-1 確定 bone、3キャラ共通） */
  private attachGun(root: Object3D, gunKey: GunKey, charKey: CharacterKey): void {
    if (!this.assetManager) return;
    const gunTmpl = this.assetManager.getGun(gunKey);
    const gunMesh = gunTmpl.scene.clone(true);
    gunMesh.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh) return;
      if (Array.isArray(m.material)) m.material = m.material.map(x => x.clone());
      else if (m.material) m.material = m.material.clone();
    });

    const cfg = BONE_ATTACH[charKey];
    // SkeletonUtils.clone で skeleton が再構築された場合、bone は scene tree 内の
    // Object3D として残るほか、SkinnedMesh.skeleton.bones[] にも参照される。
    // 両方から検索する。
    let handBone: Object3D | null = root.getObjectByName(cfg.handBone) ?? null;
    if (!handBone) {
      root.traverse((obj) => {
        if (!handBone && obj.name === cfg.handBone) handBone = obj;
        const sm = obj as SkinnedMesh;
        if (!handBone && sm.isSkinnedMesh && sm.skeleton) {
          for (const b of sm.skeleton.bones) {
            if (b.name === cfg.handBone) {
              handBone = b;
              break;
            }
          }
        }
      });
    }
    if (!handBone) {
      console.warn(`[EntityFactory] bone not found: ${cfg.handBone} in ${charKey}`);
      return;
    }
    gunMesh.position.copy(cfg.offset);
    gunMesh.rotation.copy(cfg.rotation);
    handBone.add(gunMesh);
  }

  /** キャラ生成共通処理（clone → outline → gun attach → scene 追加） */
  private buildCharacter(
    world: World,
    id: EntityId,
    charKey: CharacterKey,
    gunKey: GunKey | null,
    options: { scale?: number; tint?: number | null } = {},
  ): { root: Group; mixer: AnimationMixer; anims: Map<string, AnimationClip>; outlineMesh: Group } {
    const { root, mixer, anims } = this.cloneCharacter(charKey);
    const variantScale = options.scale ?? 1.0;
    root.scale.setScalar(CHAR_BASE_SCALE * variantScale);
    if (options.tint != null) this.applyTint(root, options.tint);
    this.hidePreAttachedGuns(root);
    const outlineMesh = this.createOutlineMesh(root);
    if (gunKey) this.attachGun(root, gunKey, charKey);
    this.sceneManager?.addEntity(root);
    world.addComponent(id, new AnimationStateComponent('Idle'));
    return { root, mixer, anims, outlineMesh };
  }

  /** GLTF に元から attach されている兄弟武器メッシュを非表示化（ナイフ等の持ち物も含む） */
  private hidePreAttachedGuns(root: Object3D): void {
    root.traverse((obj) => {
      if (KNOWN_GUN_NAMES.has(obj.name)) obj.visible = false;
    });
  }

  // ---------- エンティティ生成 ----------

  /** プレイヤーエンティティを生成（E-01） */
  createPlayer(world: World): EntityId {
    const id = world.createEntity();
    const cfg = GAME_CONFIG.player;

    world.addComponent(id, new PositionComponent(cfg.startX, cfg.startY));
    world.addComponent(id, new HealthComponent(cfg.baseHp, cfg.baseHp));
    world.addComponent(id, new ColliderComponent(cfg.colliderRadius, ColliderType.PLAYER));
    world.addComponent(id, new PlayerComponent(cfg.baseSpeed));
    world.addComponent(id, new BuffComponent());

    let mesh: MeshComponent;
    if (this.assetManager?.hasCharacter('SOLDIER')) {
      const { root, mixer, anims, outlineMesh } = this.buildCharacter(world, id, 'SOLDIER', 'AK');
      mesh = new MeshComponent('player', 192, 192, {
        object3D: root, mixer, animations: anims, outlineMesh, baseColor: '#1565C0',
      });
    } else {
      mesh = new MeshComponent('player', 192, 192, { baseColor: '#1565C0' });
    }
    world.addComponent(id, mesh);

    const weaponCfg = WEAPON_CONFIG[WeaponType.FORWARD];
    world.addComponent(id, new WeaponComponent(WeaponType.FORWARD, weaponCfg.fireInterval));

    return id;
  }

  /** 敵エンティティを生成（E-02） */
  createEnemy(world: World, type: EnemyType, position: Position, hitCountMultiplier: number = 1.0): EntityId {
    const id = world.createEntity();
    const cfg = ENEMY_CONFIG[type];

    const actualHitCount = Math.ceil(cfg.hitCount * hitCountMultiplier);
    world.addComponent(id, new PositionComponent(position.x, position.y));
    world.addComponent(id, new VelocityComponent(0, cfg.speed));
    world.addComponent(id, new HitCountComponent(actualHitCount, actualHitCount));
    world.addComponent(id, new ColliderComponent(cfg.colliderRadius, ColliderType.ENEMY));
    world.addComponent(id, new EnemyComponent(
      type, cfg.breachDamage, cfg.itemDropRate, cfg.weaponDropRate, cfg.conversionRate,
    ));

    const spriteMap: Record<string, SpriteType> = {
      [EnemyType.NORMAL]: 'enemy_normal',
      [EnemyType.FAST]: 'enemy_fast',
      [EnemyType.TANK]: 'enemy_tank',
      [EnemyType.BOSS]: 'enemy_boss',
    };
    const spriteType = spriteMap[type] ?? 'enemy_normal';
    const size = type === EnemyType.BOSS ? 280 : type === EnemyType.TANK ? 200 : 150;
    const colors: Record<string, string> = {
      [EnemyType.NORMAL]: '#F44336',
      [EnemyType.FAST]: '#FF9800',
      [EnemyType.TANK]: '#7B1FA2',
      [EnemyType.BOSS]: '#B71C1C',
    };
    const baseColor = colors[type] ?? '#F44336';

    const variant = ENEMY_VARIANT[type];
    let mesh: MeshComponent;
    if (this.assetManager?.hasCharacter(variant.key)) {
      const { root, mixer, anims, outlineMesh } = this.buildCharacter(
        world, id, variant.key, 'AK',
        { scale: variant.scale, tint: variant.tint },
      );
      mesh = new MeshComponent(spriteType, size, size, {
        object3D: root, mixer, animations: anims, outlineMesh, baseColor,
      });
    } else {
      mesh = new MeshComponent(spriteType, size, size, { baseColor });
    }
    world.addComponent(id, mesh);

    return id;
  }

  /** 弾丸エンティティを生成（E-03） */
  createBullet(
    world: World,
    origin: Position,
    velocity: { vx: number; vy: number },
    hitCountReduction: number,
    piercing: boolean,
    ownerId: EntityId,
  ): EntityId {
    const id = world.createEntity();

    world.addComponent(id, new PositionComponent(origin.x, origin.y));
    world.addComponent(id, new VelocityComponent(velocity.vx, velocity.vy));
    world.addComponent(id, new BulletComponent(hitCountReduction, piercing, ownerId));
    world.addComponent(id, new ColliderComponent(GAME_CONFIG.bullet.colliderRadius, ColliderType.BULLET));

    if (this.bulletPool) {
      const instanceId = this.bulletPool.acquire(id);
      world.addComponent(id, new MeshComponent('bullet', 16, 16, {
        instancePool: this.bulletPool, instanceId, baseColor: '#FFEB3B',
      }));
    } else {
      world.addComponent(id, new MeshComponent('bullet', 16, 16, { baseColor: '#FFEB3B' }));
    }

    return id;
  }

  /** アイテムドロップエンティティを生成（E-04） */
  createItemDrop(world: World, position: Position, itemType: ItemType): EntityId {
    const id = world.createEntity();
    const cfg = GAME_CONFIG.itemSpawn;

    world.addComponent(id, new PositionComponent(position.x, position.y));
    world.addComponent(id, new VelocityComponent(0, cfg.speed));
    world.addComponent(id, new HitCountComponent(cfg.hitCount, cfg.hitCount));
    world.addComponent(id, new ItemDropComponent(itemType, Infinity));
    world.addComponent(id, new ColliderComponent(cfg.colliderRadius, ColliderType.ITEM));

    const color = ITEM_COLORS[itemType] ?? '#FFFFFF';
    if (this.itemPool) {
      const instanceId = this.itemPool.acquire(id);
      world.addComponent(id, new MeshComponent('item_drop', cfg.spriteSize, cfg.spriteSize, {
        instancePool: this.itemPool, instanceId, baseColor: color,
      }));
    } else {
      world.addComponent(id, new MeshComponent('item_drop', cfg.spriteSize, cfg.spriteSize, { baseColor: color }));
    }

    return id;
  }

  /** 仲間エンティティを生成（E-05） */
  createAlly(world: World, playerEntity: EntityId, allyIndex: number, elapsedTime: number): EntityId {
    const id = world.createEntity();

    world.addComponent(id, new PositionComponent(0, 0));
    world.addComponent(id, new AllyComponent(allyIndex, playerEntity, elapsedTime));

    let mesh: MeshComponent;
    if (this.assetManager?.hasCharacter('SOLDIER')) {
      const { root, mixer, anims, outlineMesh } = this.buildCharacter(
        world, id, 'SOLDIER', 'AK', { tint: 0x2E7D32 }, // 味方は緑tint
      );
      mesh = new MeshComponent('ally', 150, 150, {
        object3D: root, mixer, animations: anims, outlineMesh, baseColor: '#2E7D32',
      });
    } else {
      mesh = new MeshComponent('ally', 150, 150, { baseColor: '#2E7D32' });
    }
    world.addComponent(id, mesh);

    const weaponCfg = WEAPON_CONFIG[WeaponType.FORWARD];
    world.addComponent(id, new WeaponComponent(WeaponType.FORWARD, weaponCfg.fireInterval));

    return id;
  }

  /** エフェクトエンティティを生成（E-06） */
  createEffect(world: World, type: EffectType, position: Position, color?: string): EntityId {
    const id = world.createEntity();

    let duration: number;
    let totalFrames: number;
    let spriteType: SpriteType;
    let size: number;
    let effectColor: string;

    switch (type) {
      case EffectType.MUZZLE_FLASH:
        duration = 0.1; totalFrames = 2; spriteType = 'effect_muzzle';
        size = 16; effectColor = '#FFFF88';
        break;
      case EffectType.ENEMY_DESTROY:
        duration = 0.3; totalFrames = 4; spriteType = 'effect_destroy';
        size = 32; effectColor = '#FF8800';
        break;
      case EffectType.BUFF_ACTIVATE:
        duration = GAME_CONFIG.buff.effectDuration; totalFrames = 3; spriteType = 'effect_buff';
        size = GAME_CONFIG.buff.effectMaxRadius * 2; effectColor = color ?? '#FFFFFF';
        break;
      case EffectType.ALLY_CONVERT:
        duration = GAME_CONFIG.allyConversion.shrinkDuration + GAME_CONFIG.allyConversion.appearDuration;
        totalFrames = 4; spriteType = 'effect_ally_convert';
        size = 48; effectColor = color ?? '#00CC00';
        break;
    }

    const frameInterval = duration / totalFrames;
    world.addComponent(id, new PositionComponent(position.x, position.y));
    world.addComponent(id, new EffectComponent(type, duration, totalFrames, frameInterval));
    world.addComponent(id, new MeshComponent(spriteType, size, size, { baseColor: effectColor }));

    return id;
  }
}
