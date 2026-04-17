# ドメインエンティティ定義 - ビジュアルリニューアル

## 新規/変更エンティティ

### MeshComponent（SpriteComponent置換）
```typescript
class MeshComponent extends Component {
  static readonly componentName = 'MeshComponent';

  spriteType: SpriteType;          // エンティティ種別
  object3D: THREE.Object3D | null; // 個別Mesh/Group（InstancedMesh時はnull）
  logicalWidth: number;            // ゲームロジック用論理幅(px)
  logicalHeight: number;           // ゲームロジック用論理高さ(px)
  baseColor: string;               // ベースカラー（ヒットフラッシュ復帰用）

  // InstancedMesh用（BL-05）
  instancePool: InstancedMeshPool | null;  // nullなら個別Mesh
  instanceId: number;                       // プール内のスロットID
}
```

### InstancedMeshPool（新規）
```typescript
class InstancedMeshPool {
  instancedMesh: THREE.InstancedMesh;
  maxCount: number;
  freeSlots: number[];
  activeSlots: Map<EntityId, number>;
  tempMatrix: THREE.Matrix4;        // 再利用用一時行列
  tempColor: THREE.Color;           // 再利用用一時カラー

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, maxCount: number)
  acquire(entityId: EntityId): number
  release(entityId: EntityId): void
  updateMatrix(instanceId: number, position: THREE.Vector3, rotation?: THREE.Euler): void
  setColor(instanceId: number, color: THREE.Color): void
  rebuild(): void  // コンテキストロスト後の再構築
}
```

### QualitySettings（新規）
```typescript
interface QualitySettings {
  shadowEnabled: boolean;
  shadowMapSize: number;
  maxParticles: number;
  maxBulletInstances: number;
  postProcessEnabled: boolean;
}

const QUALITY_PRESETS: Record<'high' | 'low', QualitySettings> = {
  high: { shadowEnabled: true, shadowMapSize: 1024, maxParticles: 50, maxBulletInstances: 200, postProcessEnabled: true, outlineEnabled: true, hemisphereEnabled: true, fogEnabled: true },
  low:  { shadowEnabled: false, shadowMapSize: 0, maxParticles: 15, maxBulletInstances: 100, postProcessEnabled: false, outlineEnabled: false, hemisphereEnabled: false, fogEnabled: false },
};
```

### BackgroundTile（新規）
```typescript
interface BackgroundTile {
  road: THREE.Group;         // 道路メッシュ + 車線マーキング
  guardrailL: THREE.Group;   // 左ガードレール
  guardrailR: THREE.Group;   // 右ガードレール
  ground: THREE.Mesh;        // 砂漠地面
}
```

## 既存エンティティ（変更なし）

以下は全て2D論理座標系で動作し、Three.js移行による変更なし:

| エンティティ | プロパティ | 変更 |
|---|---|---|
| PositionComponent(x, y) | 2D論理座標 | なし |
| VelocityComponent(vx, vy) | 2D速度 | なし |
| HealthComponent(currentHp, maxHp, invincibleTimer) | HP管理 | なし |
| PlayerComponent(isInvincible, invincibleTimer) | プレイヤー状態 | なし |
| EnemyComponent(type, hitCount, scoreValue) | 敵情報 | なし |
| AllyComponent(ownerId, allyIndex) | 味方情報 | なし |
| WeaponComponent(params, fireTimer) | 武器情報 | なし |
| ColliderComponent(type, radius) | 衝突判定 | なし |
| BuffComponent(activeBuffs) | バフ状態 | なし |
| ItemDropComponent(itemType) | アイテム種別 | なし |
| EffectComponent(type, lifetime, elapsed) | エフェクト状態 | なし |

## SpriteType → MeshComponent マッピング

| SpriteType | object3D | instancePool | 備考 |
|---|---|---|---|
| 'player' | Group | null | 個別メッシュ、武器含む |
| 'ally' | Group | null | 最大10体 |
| 'enemy_normal' | Group | null | 個別メッシュ（詳細キャラモデル優先） |
| 'enemy_fast' | Group | null | 個別メッシュ |
| 'enemy_tank' | Group | null | 個別メッシュ |
| 'enemy_boss' | Group | null | 個別メッシュ |
| 'bullet' | null | bulletPool | InstancedMesh |
| 'item_drop' | null | itemPool | InstancedMesh |
| 'effect_*' | Group | null | EffectManager3D管理 |

## Three.jsシーン階層（更新版）

```
THREE.Scene（fog: 0xc9a96e, near=15, far=45）
├─ AmbientLight (intensity: 0.7)
├─ HemisphereLight (sky=0x87ceeb, ground=0xc9a96e, intensity=0.4)
├─ DirectionalLight (intensity: 1.0, color=0xfff4e0 暖色, shadow: quality依存)
├─ Sky Dome (SphereGeometry radius=40 BackSide + ShaderMaterial gradient, fog=false)
│
├─ Background Group
│  ├─ BackgroundTile[0] (road + wooden guardrails + ground)
│  ├─ BackgroundTile[1]
│  └─ BackgroundTile[2]
│
├─ InstancedMesh Objects（SceneManager直接管理）
│  ├─ bulletPool.instancedMesh (maxCount: 200/100)
│  ├─ enemyNormalPool.instancedMesh (maxCount: 50)
│  └─ itemPool.instancedMesh (maxCount: 50)
│
├─ Individual Entity Objects（MeshComponent.object3D）
│  ├─ Player Group
│  ├─ Ally Groups (最大10)
│  ├─ Enemy FAST/TANK/BOSS Groups
│  └─ Effect Groups
│
└─ Effect Objects (EffectManager3D管理)
   ├─ Muzzle Flash PointLights
   ├─ Destroy Particles
   └─ Buff Column Lights
```

## gameConfig 拡張（確定版）

```typescript
three: {
  camera: {
    fov: 50,                                    // プレイヤー背後視点に最適化
    near: 0.1,
    far: 100,
    position: { x: 3.6, y: 2.5, z: -13.5 },   // プレイヤー背後・低め
    lookAt: { x: 3.6, y: 0.5, z: -4 },         // 道路前方を注視
  },
  lighting: {
    ambientIntensity: 0.7,
    ambientColor: 0xfff5e6,                   // 暖色系アンビエント
    directionalIntensity: 1.0,
    directionalColor: 0xfff4e0,               // 暖色系の太陽光
    directionalPosition: { x: 5, y: 15, z: -5 },
    shadowMapSize: 1024,
    hemisphereSkyColor: 0x87ceeb,             // 空色→地面色バウンス
    hemisphereGroundColor: 0xc9a96e,
    hemisphereIntensity: 0.4,
    directionalBoostWhenHemiOff: 1.15,        // Hemi OFF時のDirectional補正係数
    toneMappingExposure: 1.0,
  },
  coordinate: {
    scale: 0.01,
  },
  road: {
    width: 8.0,             // ゲーム領域7.2をカバー
    length: 6.0,            // 1タイル長
    tileCount: 4,           // 4枚で前方カバー
    scrollSpeed: 2.0,       // units/sec
    color: 0x777777,
    lineColor: 0xeeeeee,
    lineWidth: 0.06,
  },
  guardrail: {
    height: 0.4,
    postSpacing: 0.8,
    color: 0x8b5a3c,             // 木製風（焼け木色）
    topRailColor: 0x6b4223,      // 横木の濃色
  },
  desert: {
    color: 0xd4a574,
    width: 20.0,            // 道路の外側
  },
  quality: {
    fpsThresholdForDowngrade: 25,
    fpsThresholdForUpgrade: 55,
    fpsSampleWindow: 60,       // フレーム数
    switchCooldownMs: 5000,    // 切替クールダウン
  },
  entityHeight: {
    player: 0.4,
    ally: 0.35,
    enemyNormal: 0.35,
    enemyFast: 0.3,
    enemyTank: 0.5,
    enemyBoss: 0.7,
    bullet: 0.5,
    itemBase: 0.3,
    itemBobAmplitude: 0.1,
  },
  fog: {
    color: 0xc9a96e,
    near: 15,
    far: 45,
    disabledFar: 9999,           // setFogEnabled(false) 時の値
  },
  sky: {
    topColor: 0x87ceeb,          // グラデ空ドーム上部
    bottomColor: 0xc9a96e,       // Fog色と統一
    radius: 40,                  // Fog far=45 より内側
    offset: 0.0,
    exponent: 0.6,
  },
  postFX: {
    bloomStrength: 0.6,
    bloomRadius: 0.4,
    bloomThreshold: 0.85,
    maxPixelRatio: 2,
    maxRenderTargetSize: 2048,
  },
  outline: {
    color: 0x000000,
    thickness: 0.04,             // 反転ハル拡大率
  },
}
```
