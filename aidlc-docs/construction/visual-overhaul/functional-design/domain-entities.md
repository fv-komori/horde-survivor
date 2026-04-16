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
  high: { shadowEnabled: true, shadowMapSize: 1024, maxParticles: 50, maxBulletInstances: 200, postProcessEnabled: true },
  low:  { shadowEnabled: false, shadowMapSize: 0, maxParticles: 15, maxBulletInstances: 100, postProcessEnabled: false },
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
THREE.Scene
├─ AmbientLight (intensity: 0.6)
├─ DirectionalLight (intensity: 0.8, shadow: quality依存)
│
├─ Background Group
│  ├─ BackgroundTile[0] (road + guardrails + ground)
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
    ambientColor: 0xfff5e6,  // 暖色系アンビエント
    directionalIntensity: 1.0,
    directionalColor: 0xffffff,
    directionalPosition: { x: 5, y: 15, z: -5 },
    shadowMapSize: 1024,
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
    color: 0xbbbbbb,
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
}
```
