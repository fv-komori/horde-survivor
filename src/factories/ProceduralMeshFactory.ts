import {
  BackSide,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MeshBasicMaterial,
  MeshToonMaterial,
  Mesh,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { GAME_CONFIG } from '../config/gameConfig';
import { WeaponType } from '../types';

/** プロシージャル3Dメッシュ生成（BL-04, FR-03, Iter4: 顔・帽子・靴・Outline付与） */
export class ProceduralMeshFactory {
  /** マテリアルキャッシュ（BR-M04） */
  private materialCache = new Map<string, MeshToonMaterial>();

  /** ジオメトリキャッシュ（同一寸法のジオメトリを共有） */
  private geometryCache = new Map<string, BufferGeometry>();

  /** Outline用マテリアルキャッシュ（Iter4: FR-02） */
  private outlineMaterialCache = new Map<string, MeshBasicMaterial>();

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

  /** Outline用BackSide黒マテリアル（Iter4: キャラ・武器共有） */
  private getOutlineMaterial(color: number): MeshBasicMaterial {
    const key = `outline_${color.toString(16)}`;
    let mat = this.outlineMaterialCache.get(key);
    if (!mat) {
      mat = new MeshBasicMaterial({
        color,
        side: BackSide,
        depthWrite: false,
        transparent: false,
      });
      this.outlineMaterialCache.set(key, mat);
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
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }

  // --- Iter4: 顔・帽子・靴ヘルパー ---

  /** 目を追加（顔正面の小さな黒スフィア2個） */
  private addEyes(group: Group, headY: number, headRadius: number): void {
    const eyeMat = this.getToonMaterial(0x111111);
    const eyeR = headRadius * 0.12;
    const geo = this.sphere(eyeR, 6, 4);
    this.addMesh(group, geo, eyeMat, -headRadius * 0.35, headY + headRadius * 0.05, headRadius * 0.85);
    this.addMesh(group, geo, eyeMat, headRadius * 0.35, headY + headRadius * 0.05, headRadius * 0.85);
  }

  /** 帽子（クラウン+ツバ）を追加 */
  private addCap(group: Group, capColor: number, headY: number, headRadius: number): void {
    const capMat = this.getToonMaterial(capColor);
    // クラウン（半球を上半分に配置）
    const crown = this.addMesh(group, this.sphere(headRadius * 1.05, 12, 8), capMat, 0, headY + headRadius * 0.15, 0);
    crown.scale.set(1, 0.6, 1);
    // ツバ（前方に薄い板）
    this.addMesh(group, this.box(headRadius * 2.0, 0.02, headRadius * 0.7), capMat,
      0, headY + headRadius * 0.15, headRadius * 0.75);
  }

  /** 靴を追加（脚下部の接地用濃色Box） */
  private addBoots(group: Group, bootColor: number, legY: number, legSpacing: number = 0.08): void {
    const bootMat = this.getToonMaterial(bootColor);
    const geo = this.box(0.11, 0.05, 0.14);
    this.addMesh(group, geo, bootMat, -legSpacing, legY, 0.02);
    this.addMesh(group, geo, bootMat, legSpacing, legY, 0.02);
  }

  /** 反転ハルOutlineをGroupに適用（Iter4: FR-02）
   * 既存子Meshと兄弟として追加し、親Groupのscaleに影響しない（階層干渉回避）。
   * Outline対象は Group描画のキャラ・武器のみ（InstancedMesh弾丸/アイテム/エフェクトは対象外）。
   */
  private applyOutline(group: Group): void {
    const cfg = GAME_CONFIG.three.outline;
    const outlineMat = this.getOutlineMaterial(cfg.color);
    const thicknessScale = 1 + cfg.thickness;

    const toAdd: Mesh[] = [];
    group.traverse((child) => {
      if (child instanceof Mesh && !child.userData.isOutline) {
        const shell = new Mesh(child.geometry, outlineMat);
        shell.position.copy(child.position);
        shell.rotation.copy(child.rotation);
        shell.scale.copy(child.scale).multiplyScalar(thicknessScale);
        shell.userData.isOutline = true;
        shell.castShadow = false;
        shell.receiveShadow = false;
        toAdd.push(shell);
      }
    });
    for (const shell of toAdd) group.add(shell);
  }

  // --- キャラクター生成 ---

  /** プレイヤーメッシュ（BL-04, Iter4: 顔・青キャップ・ブーツ・Outline） */
  createPlayer(weaponType: WeaponType = WeaponType.FORWARD): Group {
    const group = new Group();
    group.name = 'player';

    const bodyMat = this.getToonMaterial(0x1976d2);   // 青シャツ
    const headMat = this.getToonMaterial(0xfdbcb4);   // 肌色
    const limbMat = this.getToonMaterial(0xfdbcb4);   // 腕は肌色
    const pantsMat = this.getToonMaterial(0x263238);  // 濃いグレー（パンツ）

    const headY = 0.75;
    const headR = 0.15;

    // 胴体
    this.addMesh(group, this.box(0.3, 0.4, 0.2), bodyMat, 0, 0.4, 0);
    // 頭
    this.addMesh(group, this.sphere(headR), headMat, 0, headY, 0);
    // 帽子（青キャップ+ツバ）
    this.addCap(group, 0x0d47a1, headY, headR);
    // 目
    this.addEyes(group, headY, headR);
    // 腕
    this.addMesh(group, this.cylinder(0.04, 0.04, 0.25), limbMat, -0.2, 0.4, 0);
    this.addMesh(group, this.cylinder(0.04, 0.04, 0.25), limbMat, 0.2, 0.4, 0);
    // パンツ
    this.addMesh(group, this.cylinder(0.05, 0.05, 0.3), pantsMat, -0.08, 0.1, 0);
    this.addMesh(group, this.cylinder(0.05, 0.05, 0.3), pantsMat, 0.08, 0.1, 0);
    // 靴
    this.addBoots(group, 0x1b1b1b, 0.025, 0.08);

    // 武器
    const weapon = this.createWeapon(weaponType);
    weapon.position.set(0.25, 0.4, 0.1);
    group.add(weapon);

    // Outline適用
    this.applyOutline(group);

    return group;
  }

  /** 味方メッシュ（FR-03, Iter4: 青系パレット・顔・キャップ・ブーツ・Outline） */
  createAlly(): Group {
    const group = new Group();
    group.name = 'ally';

    const bodyMat = this.getToonMaterial(0x1565c0);   // 青シャツ（プレイヤーより少し濃い）
    const headMat = this.getToonMaterial(0xfdbcb4);   // 肌色
    const limbMat = this.getToonMaterial(0xfdbcb4);   // 腕は肌色
    const pantsMat = this.getToonMaterial(0x263238);

    const headY = 0.65;
    const headR = 0.13;

    // 胴体
    this.addMesh(group, this.box(0.25, 0.35, 0.18), bodyMat, 0, 0.35, 0);
    // 頭
    this.addMesh(group, this.sphere(headR), headMat, 0, headY, 0);
    // 帽子（青キャップ+ツバ、プレイヤーと同系統）
    this.addCap(group, 0x1a237e, headY, headR);
    // 目
    this.addEyes(group, headY, headR);
    // 腕
    this.addMesh(group, this.cylinder(0.035, 0.035, 0.22), limbMat, -0.17, 0.35, 0);
    this.addMesh(group, this.cylinder(0.035, 0.035, 0.22), limbMat, 0.17, 0.35, 0);
    // パンツ
    this.addMesh(group, this.cylinder(0.04, 0.04, 0.25), pantsMat, -0.07, 0.08, 0);
    this.addMesh(group, this.cylinder(0.04, 0.04, 0.25), pantsMat, 0.07, 0.08, 0);
    // 靴
    this.addBoots(group, 0x1b1b1b, 0.025, 0.07);

    this.applyOutline(group);

    return group;
  }

  /** 敵NORMALメッシュ（FR-03, Iter4: 赤キャップ・顔・ブーツ・Outline） */
  createEnemyNormal(): Group {
    const group = new Group();
    group.name = 'enemy_normal';

    const bodyMat = this.getToonMaterial(0xe53935);   // 赤シャツ
    const headMat = this.getToonMaterial(0xfdbcb4);   // 肌色
    const limbMat = this.getToonMaterial(0xfdbcb4);
    const pantsMat = this.getToonMaterial(0x3e2723);

    const headY = 0.65;
    const headR = 0.13;

    this.addMesh(group, this.box(0.3, 0.35, 0.2), bodyMat, 0, 0.35, 0);
    this.addMesh(group, this.sphere(headR), headMat, 0, headY, 0);
    this.addCap(group, 0xb71c1c, headY, headR);  // 赤キャップ
    this.addEyes(group, headY, headR);
    this.addMesh(group, this.cylinder(0.035, 0.035, 0.22), limbMat, -0.18, 0.35, 0);
    this.addMesh(group, this.cylinder(0.035, 0.035, 0.22), limbMat, 0.18, 0.35, 0);
    this.addMesh(group, this.cylinder(0.04, 0.04, 0.25), pantsMat, -0.07, 0.08, 0);
    this.addMesh(group, this.cylinder(0.04, 0.04, 0.25), pantsMat, 0.07, 0.08, 0);
    this.addBoots(group, 0x1b1b1b, 0.025, 0.07);

    this.applyOutline(group);

    return group;
  }

  /** 敵FASTメッシュ（FR-03, Iter4: オレンジ系+顔+Outline、小型） */
  createEnemyFast(): Group {
    const group = new Group();
    group.name = 'enemy_fast';

    const bodyMat = this.getToonMaterial(0xff9800);
    const headMat = this.getToonMaterial(0xfdbcb4);
    const limbMat = this.getToonMaterial(0xfdbcb4);
    const pantsMat = this.getToonMaterial(0x4e342e);

    const headY = 0.55;
    const headR = 0.11;

    this.addMesh(group, this.box(0.2, 0.3, 0.15), bodyMat, 0, 0.3, 0);
    this.addMesh(group, this.sphere(headR), headMat, 0, headY, 0);
    this.addCap(group, 0xe65100, headY, headR);  // 濃いオレンジキャップ
    this.addEyes(group, headY, headR);
    this.addMesh(group, this.cylinder(0.03, 0.03, 0.2), limbMat, -0.13, 0.3, 0);
    this.addMesh(group, this.cylinder(0.03, 0.03, 0.2), limbMat, 0.13, 0.3, 0);
    this.addMesh(group, this.cylinder(0.035, 0.035, 0.2), pantsMat, -0.05, 0.08, 0);
    this.addMesh(group, this.cylinder(0.035, 0.035, 0.2), pantsMat, 0.05, 0.08, 0);
    this.addBoots(group, 0x1b1b1b, 0.02, 0.05);

    this.applyOutline(group);

    return group;
  }

  /** 敵TANKメッシュ（FR-03, Iter4: 紫系・大型・顔・装甲・Outline） */
  createEnemyTank(): Group {
    const group = new Group();
    group.name = 'enemy_tank';

    const bodyMat = this.getToonMaterial(0x7b1fa2);
    const armorMat = this.getToonMaterial(0x4a148c);
    const headMat = this.getToonMaterial(0xfdbcb4);
    const limbMat = this.getToonMaterial(0xfdbcb4);
    const pantsMat = this.getToonMaterial(0x311b92);

    const headY = 0.85;
    const headR = 0.16;

    this.addMesh(group, this.box(0.4, 0.5, 0.3), bodyMat, 0, 0.5, 0);
    // 装甲
    this.addMesh(group, this.box(0.42, 0.3, 0.32), armorMat, 0, 0.55, 0);
    // 頭
    this.addMesh(group, this.sphere(headR), headMat, 0, headY, 0);
    // ヘルメット（装甲風：濃い紫のドーム）
    const helm = this.addMesh(group, this.sphere(headR * 1.1, 12, 8), armorMat, 0, headY + headR * 0.15, 0);
    helm.scale.set(1, 0.65, 1);
    this.addEyes(group, headY, headR);
    // 腕
    this.addMesh(group, this.cylinder(0.05, 0.05, 0.3), limbMat, -0.25, 0.5, 0);
    this.addMesh(group, this.cylinder(0.05, 0.05, 0.3), limbMat, 0.25, 0.5, 0);
    // パンツ
    this.addMesh(group, this.cylinder(0.06, 0.06, 0.35), pantsMat, -0.1, 0.1, 0);
    this.addMesh(group, this.cylinder(0.06, 0.06, 0.35), pantsMat, 0.1, 0.1, 0);
    this.addBoots(group, 0x1b1b1b, 0.03, 0.1);

    this.applyOutline(group);

    return group;
  }

  /** 敵BOSSメッシュ（FR-03, Iter4: 暗赤系・特大・角・顔・Outline） */
  createEnemyBoss(): Group {
    const group = new Group();
    group.name = 'enemy_boss';

    const bodyMat = this.getToonMaterial(0xb71c1c);
    const headMat = this.getToonMaterial(0xfdbcb4);
    const hornMat = this.getToonMaterial(0xff5722);
    const armorMat = this.getToonMaterial(0x880e4f);
    const limbMat = this.getToonMaterial(0xfdbcb4);
    const pantsMat = this.getToonMaterial(0x4a148c);

    const headY = 1.05;
    const headR = 0.2;

    // 胴体
    this.addMesh(group, this.box(0.5, 0.6, 0.35), bodyMat, 0, 0.6, 0);
    // 装甲
    this.addMesh(group, this.box(0.52, 0.35, 0.37), armorMat, 0, 0.65, 0);
    // 頭
    this.addMesh(group, this.sphere(headR), headMat, 0, headY, 0);
    // 角 x2
    const hornL = this.addMesh(group, this.cone(0.05, 0.15), hornMat, -0.12, headY + 0.2, 0);
    hornL.rotation.z = 0.3;
    const hornR = this.addMesh(group, this.cone(0.05, 0.15), hornMat, 0.12, headY + 0.2, 0);
    hornR.rotation.z = -0.3;
    this.addEyes(group, headY, headR);
    // 腕
    this.addMesh(group, this.cylinder(0.06, 0.06, 0.35), limbMat, -0.32, 0.6, 0);
    this.addMesh(group, this.cylinder(0.06, 0.06, 0.35), limbMat, 0.32, 0.6, 0);
    // パンツ
    this.addMesh(group, this.cylinder(0.07, 0.07, 0.4), pantsMat, -0.12, 0.15, 0);
    this.addMesh(group, this.cylinder(0.07, 0.07, 0.4), pantsMat, 0.12, 0.15, 0);
    this.addBoots(group, 0x1b1b1b, 0.035, 0.12);

    this.applyOutline(group);

    return group;
  }

  // --- 武器メッシュ ---

  /** 武器メッシュ（WeaponType別 — BL-04b, Iter4: Outline付与） */
  createWeapon(weaponType: WeaponType): Group {
    const group = new Group();
    group.name = `weapon_${weaponType}`;
    const metalMat = this.getToonMaterial(0x424242);

    switch (weaponType) {
      case WeaponType.FORWARD: {
        this.addMesh(group, this.cylinder(0.02, 0.02, 0.35, 6), metalMat, 0, 0, 0.15);
        this.addMesh(group, this.box(0.04, 0.06, 0.12), this.getToonMaterial(0x5d4037), 0, -0.03, -0.02);
        break;
      }
      case WeaponType.SPREAD: {
        this.addMesh(group, this.cylinder(0.025, 0.025, 0.25, 6), metalMat, -0.02, 0, 0.1);
        this.addMesh(group, this.cylinder(0.025, 0.025, 0.25, 6), metalMat, 0.02, 0, 0.1);
        this.addMesh(group, this.box(0.06, 0.06, 0.1), this.getToonMaterial(0x5d4037), 0, -0.03, -0.05);
        break;
      }
      case WeaponType.PIERCING: {
        this.addMesh(group, this.cylinder(0.015, 0.015, 0.4, 6), metalMat, 0, 0, 0.18);
        this.addMesh(group, this.cylinder(0.035, 0.035, 0.02, 8), this.getToonMaterial(0x00e5ff), 0, 0, 0.25);
        this.addMesh(group, this.cylinder(0.035, 0.035, 0.02, 8), this.getToonMaterial(0x00e5ff), 0, 0, 0.15);
        break;
      }
    }

    return group;
  }

  // --- キャッシュ管理 ---

  /** 全キャッシュ解放（BR-M04） */
  disposeCachedMaterials(): void {
    for (const mat of this.materialCache.values()) {
      mat.dispose();
    }
    this.materialCache.clear();
    for (const mat of this.outlineMaterialCache.values()) {
      mat.dispose();
    }
    this.outlineMaterialCache.clear();
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
