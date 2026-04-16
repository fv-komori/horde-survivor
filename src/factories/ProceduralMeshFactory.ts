import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MeshToonMaterial,
  Mesh,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { GAME_CONFIG } from '../config/gameConfig';
import { WeaponType } from '../types';

/** プロシージャル3Dメッシュ生成（BL-04, FR-03） */
export class ProceduralMeshFactory {
  /** マテリアルキャッシュ（BR-M04） */
  private materialCache = new Map<string, MeshToonMaterial>();

  /** ジオメトリキャッシュ（同一寸法のジオメトリを共有） */
  private geometryCache = new Map<string, BufferGeometry>();

  /** キャッシュ済みToonMaterial取得 */
  private getToonMaterial(color: number): MeshToonMaterial {
    const key = color.toString(16);
    let mat = this.materialCache.get(key);
    if (!mat) {
      mat = new MeshToonMaterial({ color });
      this.materialCache.set(key, mat);
    }
    return mat;
  }

  /** キャッシュ済みジオメトリ取得 */
  private getGeometry<T extends BufferGeometry>(key: string, factory: () => T): T {
    let geo = this.geometryCache.get(key);
    if (!geo) {
      geo = factory();
      this.geometryCache.set(key, geo);
    }
    return geo as T;
  }

  // --- ヘルパー ---

  private box(w: number, h: number, d: number): BoxGeometry {
    const key = `box_${w}_${h}_${d}`;
    return this.getGeometry(key, () => new BoxGeometry(w, h, d));
  }

  private sphere(r: number, wSeg = 12, hSeg = 8): SphereGeometry {
    const key = `sph_${r}_${wSeg}_${hSeg}`;
    return this.getGeometry(key, () => new SphereGeometry(r, wSeg, hSeg));
  }

  private cylinder(rTop: number, rBot: number, h: number, seg = 8): CylinderGeometry {
    const key = `cyl_${rTop}_${rBot}_${h}_${seg}`;
    return this.getGeometry(key, () => new CylinderGeometry(rTop, rBot, h, seg));
  }

  private cone(r: number, h: number, seg = 8): ConeGeometry {
    const key = `cone_${r}_${h}_${seg}`;
    return this.getGeometry(key, () => new ConeGeometry(r, h, seg));
  }

  private addMesh(group: Group, geo: BufferGeometry, mat: Material, x: number, y: number, z: number): Mesh {
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  // --- キャラクター生成 ---

  /** プレイヤーメッシュ（BL-04） */
  createPlayer(weaponType: WeaponType = WeaponType.FORWARD): Group {
    const group = new Group();
    group.name = 'player';

    const bodyMat = this.getToonMaterial(0x1565c0);
    const headMat = this.getToonMaterial(0x1e88e5);
    const helmetMat = this.getToonMaterial(0x37474f);
    const visorMat = this.getToonMaterial(0x00bcd4);
    const legMat = this.getToonMaterial(0x0d47a1);

    // 胴体
    this.addMesh(group, this.box(0.3, 0.4, 0.2), bodyMat, 0, 0.4, 0);
    // 頭
    this.addMesh(group, this.sphere(0.15), headMat, 0, 0.75, 0);
    // ヘルメット
    const helmet = this.addMesh(group, this.sphere(0.17, 12, 8), helmetMat, 0, 0.78, 0);
    helmet.scale.set(1, 0.6, 1); // 半球風
    // バイザー
    this.addMesh(group, this.box(0.12, 0.04, 0.08), visorMat, 0, 0.72, 0.12);
    // 腕
    this.addMesh(group, this.cylinder(0.04, 0.04, 0.25), bodyMat, -0.2, 0.4, 0);
    this.addMesh(group, this.cylinder(0.04, 0.04, 0.25), bodyMat, 0.2, 0.4, 0);
    // 脚
    this.addMesh(group, this.cylinder(0.05, 0.05, 0.3), legMat, -0.08, 0.05, 0);
    this.addMesh(group, this.cylinder(0.05, 0.05, 0.3), legMat, 0.08, 0.05, 0);

    // 武器
    const weapon = this.createWeapon(weaponType);
    weapon.position.set(0.25, 0.4, 0.1);
    group.add(weapon);

    return group;
  }

  /** 味方メッシュ（FR-03: 緑系カラーリング） */
  createAlly(): Group {
    const group = new Group();
    group.name = 'ally';

    const bodyMat = this.getToonMaterial(0x2e7d32);
    const headMat = this.getToonMaterial(0x43a047);
    const helmetMat = this.getToonMaterial(0x33691e);
    const legMat = this.getToonMaterial(0x1b5e20);

    // 胴体
    this.addMesh(group, this.box(0.25, 0.35, 0.18), bodyMat, 0, 0.35, 0);
    // 頭
    this.addMesh(group, this.sphere(0.13), headMat, 0, 0.65, 0);
    // ヘルメット
    const helmet = this.addMesh(group, this.sphere(0.15, 12, 8), helmetMat, 0, 0.68, 0);
    helmet.scale.set(1, 0.6, 1);
    // 腕
    this.addMesh(group, this.cylinder(0.035, 0.035, 0.22), bodyMat, -0.17, 0.35, 0);
    this.addMesh(group, this.cylinder(0.035, 0.035, 0.22), bodyMat, 0.17, 0.35, 0);
    // 脚
    this.addMesh(group, this.cylinder(0.04, 0.04, 0.25), legMat, -0.07, 0.03, 0);
    this.addMesh(group, this.cylinder(0.04, 0.04, 0.25), legMat, 0.07, 0.03, 0);

    return group;
  }

  /** 敵NORMALメッシュ（FR-03: 赤系） */
  createEnemyNormal(): Group {
    const group = new Group();
    group.name = 'enemy_normal';

    const bodyMat = this.getToonMaterial(0xf44336);
    const headMat = this.getToonMaterial(0xef5350);
    const limbMat = this.getToonMaterial(0xc62828);

    this.addMesh(group, this.box(0.3, 0.35, 0.2), bodyMat, 0, 0.35, 0);
    this.addMesh(group, this.sphere(0.13), headMat, 0, 0.65, 0);
    this.addMesh(group, this.cylinder(0.035, 0.035, 0.22), limbMat, -0.18, 0.35, 0);
    this.addMesh(group, this.cylinder(0.035, 0.035, 0.22), limbMat, 0.18, 0.35, 0);
    this.addMesh(group, this.cylinder(0.04, 0.04, 0.25), limbMat, -0.07, 0.03, 0);
    this.addMesh(group, this.cylinder(0.04, 0.04, 0.25), limbMat, 0.07, 0.03, 0);

    return group;
  }

  /** 敵FASTメッシュ（FR-03: オレンジ系、小型） */
  createEnemyFast(): Group {
    const group = new Group();
    group.name = 'enemy_fast';

    const bodyMat = this.getToonMaterial(0xff9800);
    const headMat = this.getToonMaterial(0xffa726);
    const limbMat = this.getToonMaterial(0xe65100);

    this.addMesh(group, this.box(0.2, 0.3, 0.15), bodyMat, 0, 0.3, 0);
    this.addMesh(group, this.sphere(0.11), headMat, 0, 0.55, 0);
    this.addMesh(group, this.cylinder(0.03, 0.03, 0.2), limbMat, -0.13, 0.3, 0);
    this.addMesh(group, this.cylinder(0.03, 0.03, 0.2), limbMat, 0.13, 0.3, 0);
    this.addMesh(group, this.cylinder(0.035, 0.035, 0.2), limbMat, -0.05, 0.02, 0);
    this.addMesh(group, this.cylinder(0.035, 0.035, 0.2), limbMat, 0.05, 0.02, 0);

    return group;
  }

  /** 敵TANKメッシュ（FR-03: 紫系、大型） */
  createEnemyTank(): Group {
    const group = new Group();
    group.name = 'enemy_tank';

    const bodyMat = this.getToonMaterial(0x7b1fa2);
    const armorMat = this.getToonMaterial(0x4a148c);
    const headMat = this.getToonMaterial(0x9c27b0);
    const limbMat = this.getToonMaterial(0x6a1b9a);

    this.addMesh(group, this.box(0.4, 0.5, 0.3), bodyMat, 0, 0.5, 0);
    // 装甲
    this.addMesh(group, this.box(0.42, 0.3, 0.32), armorMat, 0, 0.55, 0);
    this.addMesh(group, this.sphere(0.16), headMat, 0, 0.85, 0);
    this.addMesh(group, this.cylinder(0.05, 0.05, 0.3), limbMat, -0.25, 0.5, 0);
    this.addMesh(group, this.cylinder(0.05, 0.05, 0.3), limbMat, 0.25, 0.5, 0);
    this.addMesh(group, this.cylinder(0.06, 0.06, 0.35), limbMat, -0.1, 0.05, 0);
    this.addMesh(group, this.cylinder(0.06, 0.06, 0.35), limbMat, 0.1, 0.05, 0);

    return group;
  }

  /** 敵BOSSメッシュ（FR-03: 暗赤系、特大+装飾） */
  createEnemyBoss(): Group {
    const group = new Group();
    group.name = 'enemy_boss';

    const bodyMat = this.getToonMaterial(0xb71c1c);
    const headMat = this.getToonMaterial(0xd32f2f);
    const hornMat = this.getToonMaterial(0xff5722);
    const armorMat = this.getToonMaterial(0x880e4f);
    const limbMat = this.getToonMaterial(0x8e0000);

    // 胴体
    this.addMesh(group, this.box(0.5, 0.6, 0.35), bodyMat, 0, 0.6, 0);
    // 装甲
    this.addMesh(group, this.box(0.52, 0.35, 0.37), armorMat, 0, 0.65, 0);
    // 頭
    this.addMesh(group, this.sphere(0.2), headMat, 0, 1.05, 0);
    // 角 x2
    const hornL = this.addMesh(group, this.cone(0.05, 0.15), hornMat, -0.12, 1.25, 0);
    hornL.rotation.z = 0.3;
    const hornR = this.addMesh(group, this.cone(0.05, 0.15), hornMat, 0.12, 1.25, 0);
    hornR.rotation.z = -0.3;
    // 腕
    this.addMesh(group, this.cylinder(0.06, 0.06, 0.35), limbMat, -0.32, 0.6, 0);
    this.addMesh(group, this.cylinder(0.06, 0.06, 0.35), limbMat, 0.32, 0.6, 0);
    // 脚
    this.addMesh(group, this.cylinder(0.07, 0.07, 0.4), limbMat, -0.12, 0.08, 0);
    this.addMesh(group, this.cylinder(0.07, 0.07, 0.4), limbMat, 0.12, 0.08, 0);

    return group;
  }

  // --- 武器メッシュ ---

  /** 武器メッシュ（WeaponType別 — BL-04b） */
  createWeapon(weaponType: WeaponType): Group {
    const group = new Group();
    group.name = `weapon_${weaponType}`;
    const metalMat = this.getToonMaterial(0x424242);

    switch (weaponType) {
      case WeaponType.FORWARD: {
        // ライフル風: 長い筒
        this.addMesh(group, this.cylinder(0.02, 0.02, 0.35, 6), metalMat, 0, 0, 0.15);
        this.addMesh(group, this.box(0.04, 0.06, 0.12), this.getToonMaterial(0x5d4037), 0, -0.03, -0.02);
        break;
      }
      case WeaponType.SPREAD: {
        // ショットガン風: 太い短筒 x2
        this.addMesh(group, this.cylinder(0.025, 0.025, 0.25, 6), metalMat, -0.02, 0, 0.1);
        this.addMesh(group, this.cylinder(0.025, 0.025, 0.25, 6), metalMat, 0.02, 0, 0.1);
        this.addMesh(group, this.box(0.06, 0.06, 0.1), this.getToonMaterial(0x5d4037), 0, -0.03, -0.05);
        break;
      }
      case WeaponType.PIERCING: {
        // レールガン風: 細長い+発光リング
        this.addMesh(group, this.cylinder(0.015, 0.015, 0.4, 6), metalMat, 0, 0, 0.18);
        this.addMesh(group, this.cylinder(0.035, 0.035, 0.02, 8), this.getToonMaterial(0x00e5ff), 0, 0, 0.25);
        this.addMesh(group, this.cylinder(0.035, 0.035, 0.02, 8), this.getToonMaterial(0x00e5ff), 0, 0, 0.15);
        break;
      }
    }

    return group;
  }

  // --- 弾丸・アイテム（InstancedMesh用ジオメトリ） ---

  /** 弾丸用ジオメトリ */
  createBulletGeometry(): SphereGeometry {
    return this.sphere(0.03, 6, 4);
  }

  /** 弾丸用マテリアル（emissive） */
  createBulletMaterial(): MeshToonMaterial {
    const mat = new MeshToonMaterial({ color: 0xffeb3b, emissive: 0xffeb3b, emissiveIntensity: 0.5 });
    return mat;
  }

  /** アイテム用ジオメトリ（八面体ジェム） */
  createItemGeometry(): BufferGeometry {
    const key = 'item_gem';
    return this.getGeometry(key, () => new SphereGeometry(0.08, 4, 2));
  }

  /** 敵NORMAL用ジオメトリ（簡易Box） */
  createEnemyNormalGeometry(): BoxGeometry {
    return this.box(0.3, 0.7, 0.2);
  }

  /** 敵NORMAL用マテリアル */
  createEnemyNormalMaterial(): MeshToonMaterial {
    return this.getToonMaterial(0xf44336);
  }

  // --- 背景メッシュ ---

  /** 道路タイルメッシュ作成（BL-03） */
  createRoadTile(): Group {
    const cfg = GAME_CONFIG.three.road;
    const group = new Group();
    group.name = 'road_tile';

    // 道路面
    const roadGeo = this.box(cfg.width, 0.02, cfg.length);
    const road = new Mesh(roadGeo, this.getToonMaterial(cfg.color));
    road.position.y = 0;
    road.receiveShadow = true;
    group.add(road);

    // 白い車線マーキング（破線を等間隔に配置）
    const dashCount = Math.floor(cfg.length / 0.6);
    const lineMat = this.getToonMaterial(cfg.lineColor);
    for (let i = 0; i < dashCount; i++) {
      const dash = new Mesh(this.box(cfg.lineWidth, 0.025, 0.3), lineMat);
      dash.position.set(0, 0.015, -cfg.length / 2 + 0.3 + i * 0.6);
      group.add(dash);
    }

    return group;
  }

  /** ガードレール作成（BR-BG03） */
  createGuardrail(side: 'left' | 'right'): Group {
    const cfg = GAME_CONFIG.three.guardrail;
    const roadCfg = GAME_CONFIG.three.road;
    const group = new Group();
    group.name = `guardrail_${side}`;

    const xPos = side === 'left' ? -roadCfg.width / 2 - 0.05 : roadCfg.width / 2 + 0.05;
    const metalMat = this.getToonMaterial(cfg.color);

    // 支柱
    const postCount = Math.floor(roadCfg.length / cfg.postSpacing) + 1;
    for (let i = 0; i < postCount; i++) {
      const post = new Mesh(this.box(0.04, cfg.height, 0.04), metalMat);
      post.position.set(xPos, cfg.height / 2, -i * cfg.postSpacing);
      group.add(post);
    }

    // レール
    const rail = new Mesh(this.cylinder(0.02, 0.02, roadCfg.length, 6), metalMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(xPos, cfg.height * 0.8, -roadCfg.length / 2);
    group.add(rail);

    return group;
  }

  /** 砂漠地面作成（FR-02） */
  createDesertGround(): Mesh {
    const cfg = GAME_CONFIG.three.desert;
    const roadCfg = GAME_CONFIG.three.road;
    const totalDepth = roadCfg.length * roadCfg.tileCount + 20;
    const geo = this.box(cfg.width, 0.01, totalDepth);
    const mesh = new Mesh(geo, this.getToonMaterial(cfg.color));
    mesh.position.set(GAME_CONFIG.three.camera.lookAt.x, -0.01, -totalDepth / 2 + 5);
    mesh.receiveShadow = true;
    mesh.name = 'desert_ground';
    return mesh;
  }

  // --- キャッシュ管理 ---

  /** 全キャッシュ解放（BR-M04） */
  disposeCachedMaterials(): void {
    for (const mat of this.materialCache.values()) {
      mat.dispose();
    }
    this.materialCache.clear();
  }

  disposeCachedGeometries(): void {
    for (const geo of this.geometryCache.values()) {
      geo.dispose();
    }
    this.geometryCache.clear();
  }

  disposeAll(): void {
    this.disposeCachedMaterials();
    this.disposeCachedGeometries();
  }
}
