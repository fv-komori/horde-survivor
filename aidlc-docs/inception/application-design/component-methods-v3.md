# コンポーネントメソッド定義 - Iteration 3: ビジュアルリニューアル

**注記**: ECSアーキテクチャのため、コンポーネントはデータのみ。ロジックはシステムに集約。
詳細なビジネスルールは Functional Design（CONSTRUCTION PHASE）で定義。

---

## 新規: ThreeJSRenderSystem

```typescript
class ThreeJSRenderSystem implements System {
  readonly priority = 99;

  constructor(container: HTMLElement)

  // 初期化
  initScene(): void                    // Scene, Camera, Renderer, Lights セットアップ
  setupCamera(): void                  // PerspectiveCamera（固定位置、斜め上視点）
  setupLighting(): void                // AmbientLight + DirectionalLight
  setupBackground(): void              // 道路・砂漠・ガードレール

  // メインループ
  update(world: World, dt: number): void  // 全エンティティの3D位置同期+レンダリング
  syncEntityPositions(world: World): void // PositionComponent→Object3D位置変換
  
  // リサイズ
  handleResize(): void                 // レンダラー・カメラアスペクト比更新
  
  // 品質
  applyQualitySettings(quality: 'high' | 'low'): void
  
  // クリーンアップ
  dispose(): void                      // 全リソース解放
}
```

## 新規: CoordinateMapper

```typescript
class CoordinateMapper {
  static readonly SCALE = 0.01;              // 1論理px = 0.01ワールドunit
  static readonly GAME_WIDTH = 720;
  static readonly GAME_HEIGHT = 1280;

  // 2D論理座標 → 3Dワールド座標
  static toWorld(gameX: number, gameY: number): THREE.Vector3
  // 3Dワールド座標 → 2D論理座標
  static toGame(worldPos: THREE.Vector3): { x: number; y: number }
  // 論理サイズ → ワールドサイズ
  static toWorldScale(logicalSize: number): number
}
```

## 新規: QualityManager

```typescript
class QualityManager {
  currentQuality: 'high' | 'low';

  constructor(settingsManager: SettingsManager)

  detectOptimalQuality(): 'high' | 'low'  // デバイス性能推定
  setQuality(quality: 'high' | 'low'): void
  getSettings(): QualitySettings           // シャドウ有無、パーティクル数等
}

interface QualitySettings {
  shadowEnabled: boolean;
  shadowMapSize: number;
  maxParticles: number;
  postProcessEnabled: boolean;
}
```

## 新規: ProceduralMeshFactory

```typescript
class ProceduralMeshFactory {
  // キャラクター生成
  createPlayerMesh(weaponType: WeaponType): THREE.Group
  createAllyMesh(): THREE.Group
  createEnemyMesh(enemyType: EnemyType): THREE.Group

  // オブジェクト生成
  createBulletMesh(): THREE.Mesh
  createItemMesh(itemType: ItemType): THREE.Group
  createWeaponMesh(weaponType: WeaponType): THREE.Group

  // 背景生成
  createRoad(): THREE.Group              // 道路メッシュ（車線マーキング付き）
  createGuardrails(): THREE.Group        // ガードレール
  createDesertGround(): THREE.Mesh       // 砂漠地形

  // マテリアル
  createToonMaterial(color: string): THREE.MeshToonMaterial
  
  // キャッシュ
  disposeCachedMaterials(): void
}
```

## 新規: SceneManager

```typescript
class SceneManager {
  readonly scene: THREE.Scene;

  constructor()

  addEntity(object3D: THREE.Object3D): void
  removeEntity(object3D: THREE.Object3D): void
  disposeObject(object3D: THREE.Object3D): void  // Geometry+Material+Texture dispose
  
  // 背景管理
  setupBackground(road: THREE.Group, guardrails: THREE.Group, ground: THREE.Mesh): void
  updateBackgroundScroll(dt: number): void        // 前進感のスクロール表現

  // ライティング
  setupLights(ambient: THREE.AmbientLight, directional: THREE.DirectionalLight): void
}
```

## 新規: HTMLOverlayManager

```typescript
class HTMLOverlayManager {
  constructor(container: HTMLElement)

  // HUD
  updateHUD(state: HUDState): void
  showHUD(): void
  hideHUD(): void

  // 画面
  showTitleScreen(onStart: () => void, onSettings: () => void): void
  hideTitleScreen(): void
  showGameOverScreen(scoreData: ScoreData, onRetry: () => void): void
  hideGameOverScreen(): void

  // HP/ダメージ表示
  showDamageNumber(x: number, y: number, damage: number): void
  updateEnemyHP(entityId: EntityId, hp: number, maxHp: number, screenPos: {x: number, y: number}): void

  // モバイルUI
  showMobileControls(controlType: ControlType): void
  hideMobileControls(): void

  // クリーンアップ
  dispose(): void
}
```

## 新規: EffectManager3D

```typescript
class EffectManager3D {
  constructor(sceneManager: SceneManager, qualityManager: QualityManager)

  createMuzzleFlash(position: THREE.Vector3): void
  createEnemyDestroy(position: THREE.Vector3, color: string): void
  createBuffActivate(position: THREE.Vector3): void
  createAllyConvert(position: THREE.Vector3): void

  updateEffects(dt: number): void   // アニメーション更新・期限切れ除去
  dispose(): void
}
```

## 変更: EntityFactory

```typescript
class EntityFactory {
  constructor(
    private proceduralMeshFactory: ProceduralMeshFactory,
    private sceneManager: SceneManager,
  )

  // 既存メソッド（内部でSpriteComponent→MeshComponent生成に変更）
  createPlayer(world: World): EntityId
  createEnemy(world: World, type: EnemyType, position: Position, hitCountMultiplier?: number): EntityId
  createBullet(world: World, origin: Position, velocity: Velocity, hitCountReduction: number, piercing: boolean, ownerId: EntityId): EntityId
  createItemDrop(world: World, position: Position, itemType: ItemType): EntityId
  createAlly(world: World, playerEntity: EntityId, allyIndex: number, elapsedTime: number): EntityId
  createEffect(world: World, type: EffectType, position: Position, color?: string): EntityId
}
```

## 変更: GameService

```typescript
class GameService {
  // 新規依存追加
  private threeRenderSystem: ThreeJSRenderSystem;
  private sceneManager: SceneManager;
  private qualityManager: QualityManager;
  private htmlOverlayManager: HTMLOverlayManager;

  async init(): Promise<void>  // Three.js初期化を追加
  // ゲームループ構造は維持（requestAnimationFrame）
  // UIレンダリングをHTMLOverlayManager経由に変更
}
```

## 変更: gameConfig

```typescript
// 既存パラメータは全て維持
// 以下を追加:
export const GAME_CONFIG = deepFreeze({
  // ... 既存パラメータ ...

  // Three.js 3D設定（新規追加）
  three: {
    camera: {
      fov: 45,
      near: 0.1,
      far: 100,
      position: { x: 3.6, y: 8, z: 10 },   // 斜め上視点
      lookAt: { x: 3.6, y: 0, z: 5 },       // シーン中央を注視
    },
    lighting: {
      ambientIntensity: 0.6,
      ambientColor: 0xffffff,
      directionalIntensity: 0.8,
      directionalColor: 0xffffff,
      directionalPosition: { x: 5, y: 10, z: 5 },
      shadowMapSize: 1024,
    },
    coordinate: {
      scale: 0.01,       // 1論理px = 0.01ワールドunit
    },
    road: {
      width: 5.0,        // ワールドunit
      length: 15.0,
      color: 0x888888,
      lineColor: 0xffffff,
    },
    desert: {
      color: 0xd4a574,
    },
    quality: {
      fpsThresholdForDowngrade: 25,  // このfps以下でLowに自動切替
      fpsThresholdForUpgrade: 55,    // このfps以上でHighに自動復帰
    },
  },
});
```
