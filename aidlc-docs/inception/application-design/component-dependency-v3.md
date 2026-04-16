# コンポーネント依存関係 - Iteration 3: ビジュアルリニューアル

---

## 依存関係マトリクス

```
                        GameService
                            |
             +--------------+--------------+
             |              |              |
        SceneManager   QualityManager  HTMLOverlayManager
             |              |
    +--------+--------+    |
    |        |        |    |
ProceduralMeshFactory |  SettingsManager（既存）
    |        |        |
    v        v        v
EntityFactory  ThreeJSRenderSystem  EffectManager3D
    |              |                    |
    +------+-------+--------------------+
           |
           v
      ECS World
           |
    +------+------+------+------+------+
    |      |      |      |      |      |
 Input  Movement Weapon Collision Health ... (14 Systems)
```

## データフロー

### エンティティ生成フロー
```
SpawnManager → EntityFactory
  ├─ ProceduralMeshFactory.createXxxMesh() → THREE.Group/Mesh
  ├─ SceneManager.addEntity(object3D) → scene.add()
  ├─ world.createEntity() → EntityId
  └─ world.addComponent(MeshComponent, PositionComponent, ...)
```

### 毎フレーム更新フロー
```
GameService.gameLoop(timestamp)
  └─ world.update(dt)
      ├─ InputSystem (priority 0) — キー/タッチ入力処理
      ├─ PlayerMovementSystem (1) — プレイヤー移動（2D論理座標）
      ├─ MovementSystem (2) — 全エンティティ移動（2D論理座標）
      ├─ AllyFollowSystem (3) — 味方追従（2D論理座標）
      ├─ WeaponSystem (4) — 射撃・弾丸生成
      ├─ CollisionSystem (5) — 衝突判定（2D論理座標）
      ├─ DefenseLineSystem (6) — 防衛ライン判定
      ├─ HealthSystem (7) — HP管理
      ├─ ItemCollectionSystem (8) — アイテム取得
      ├─ BuffSystem (9) — バフ管理
      ├─ AllyConversionSystem (10) — 味方変換
      ├─ AllyFireRateSystem (11) — 味方射撃速度
      ├─ EffectSystem (12) — エフェクト更新
      ├─ CleanupSystem (13) — 破棄エンティティのdispose+除去
      └─ ThreeJSRenderSystem (99) — 3D位置同期+レンダリング
          ├─ query(MeshComponent, PositionComponent)
          ├─ CoordinateMapper.toWorld(pos.x, pos.y)
          ├─ object3D.position.set(worldX, worldY, worldZ)
          ├─ SceneManager.updateBackgroundScroll(dt)
          ├─ EffectManager3D.updateEffects(dt)
          └─ renderer.render(scene, camera)
```

### エンティティ破棄フロー
```
CleanupSystem.update()
  ├─ world.query(entitiesToDestroy)
  ├─ SceneManager.removeEntity(object3D) → scene.remove()
  ├─ SceneManager.disposeObject(object3D) → geometry/material/texture.dispose()
  └─ world.destroyEntity(entityId)
```

### UI更新フロー
```
GameService.update(dt)
  └─ HTMLOverlayManager.updateHUD(hudState)
      ├─ HP バー更新（textContent）
      ├─ バフアイコン更新
      ├─ スコア・ウェーブ更新
      └─ 武器インジケーター更新
```

## コンポーネント → System 参照マトリクス

| System | MeshComponent | PositionComponent | 他コンポーネント |
|---|---|---|---|
| ThreeJSRenderSystem | **読取** (object3D) | **読取** (x,y→3D変換) | — |
| WeaponSystem | **読取** (logicalWidth) | **読取** | WeaponComponent |
| AllyFollowSystem | **読取** (logicalWidth) | **読書** | AllyComponent, PlayerComponent |
| CleanupSystem | **読取** (object3D→dispose) | — | — |
| EffectSystem | — | **読取** | EffectComponent |
| EntityFactory | **生成** | **生成** | 全コンポーネント |
| CollisionSystem | — | **読取** | ColliderComponent |
| MovementSystem | — | **読書** | VelocityComponent |
| HealthSystem | — | — | HealthComponent |
| その他System | — | 必要に応じて | 各種 |

## Three.js オブジェクト階層

```
THREE.Scene
├─ AmbientLight
├─ DirectionalLight (+ shadowCamera)
├─ Background Group
│  ├─ Road (PlaneGeometry + 車線マーキング)
│  ├─ Guardrail Left (BoxGeometry 連結)
│  ├─ Guardrail Right (BoxGeometry 連結)
│  └─ Desert Ground (PlaneGeometry)
├─ Entity Objects (MeshComponent.object3D)
│  ├─ Player Group (胴体Box + 頭Sphere + 手足Cylinder + 武器)
│  ├─ Enemy Groups (タイプ別形状・サイズ)
│  ├─ Ally Groups (プレイヤー類似・緑系)
│  ├─ Bullet Meshes (Sphere + emissive)
│  └─ Item Groups (回転ジェム)
└─ Effect Objects (EffectManager3D管理)
   ├─ Muzzle Flash (PointLight + パーティクル)
   ├─ Destroy Particles
   ├─ Buff Column Light
   └─ Damage Number Sprites
```

## 新規依存パッケージ

| パッケージ | 用途 | バージョン |
|---|---|---|
| three | 3Dレンダリング | ^0.164.0（設計フェーズで確定） |
| @types/three | TypeScript型定義 | ^0.164.0 |

※ CSS2DRenderer, GLTFLoader等のaddonはthreeパッケージ内の`three/addons/`から個別import
