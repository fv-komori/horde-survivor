# コンポーネント定義 - Iteration 3: ビジュアルリニューアル（Three.js導入）

**アーキテクチャ**: ECS（Entity-Component-System）
**レンダリング**: Three.js WebGL（Canvas 2Dから移行）

---

## 新規コンポーネント

### MeshComponent（SpriteComponentの後継）

**目的**: Three.jsの3Dオブジェクト参照を保持するECSコンポーネント

```typescript
export class MeshComponent extends Component {
  static readonly componentName = 'MeshComponent';

  constructor(
    public spriteType: SpriteType,        // 既存のSpriteType互換
    public object3D: THREE.Object3D,      // Three.jsオブジェクト参照（Mesh or Group）
    public logicalWidth: number,          // ゲームロジック用論理幅(px) — 旧SpriteComponent.width
    public logicalHeight: number,         // ゲームロジック用論理高さ(px) — 旧SpriteComponent.height
    public baseColor: string = '#FFFFFF', // ベースカラー（ヒットフラッシュ復帰用）
  ) {
    super();
  }
}
```

**SpriteComponent → MeshComponent マッピング**:
| SpriteComponent | MeshComponent | 備考 |
|---|---|---|
| spriteType | spriteType | そのまま維持 |
| width | logicalWidth | 名前変更。2D論理座標用 |
| height | logicalHeight | 名前変更。2D論理座標用 |
| color | baseColor | 名前変更。ヒットフラッシュ復帰用 |
| — | object3D | 新規。Three.jsのMesh/Group参照 |

---

## 維持コンポーネント（変更なし）

FR-09座標系マッピング方針に従い、全コンポーネントは2D論理座標系(720x1280)を維持。

| コンポーネント | 変更 | 理由 |
|---|---|---|
| PositionComponent(x, y) | なし | 2D論理座標維持。RenderSystemが3D変換 |
| VelocityComponent(vx, vy) | なし | 移動計算は2D論理座標 |
| HealthComponent | なし | ゲームロジック |
| PlayerComponent | なし | ゲームロジック |
| EnemyComponent | なし | ゲームロジック |
| AllyComponent | なし | ゲームロジック |
| WeaponComponent | なし | ゲームロジック |
| ColliderComponent | なし | 2D論理座標での衝突判定 |
| BuffComponent | なし | ゲームロジック |
| ItemDropComponent | なし | ゲームロジック |
| EffectComponent | なし | ゲームロジック |

---

## 廃止コンポーネント

### SpriteComponent

MeshComponentが全プロパティを包含するため廃止。ファイルはMeshComponentに置き換え。

---

## 新規System/Manager

### ThreeJSRenderSystem（RenderSystemの後継）

**目的**: Three.jsによる3Dレンダリング
**優先度**: 99（既存と同じ、最後に実行）

**責務**:
- Three.js Scene / PerspectiveCamera / WebGLRenderer の初期化・管理
- MeshComponent + PositionComponent のクエリによる3Dオブジェクト位置更新
- 2D論理座標 → 3Dワールド座標への変換（CoordinateMapper経由）
- ライティング管理（AmbientLight + DirectionalLight）
- 品質ティア切替（QualityManager経由）
- レスポンシブ対応（リサイズ時のレンダラー・カメラ更新）

### CoordinateMapper（新規ユーティリティ）

**目的**: 2D論理座標(720x1280px) ↔ 3Dワールド座標の変換

**変換ルール**（FR-09準拠）:
- ゲーム座標X(0-720) → ワールドX軸
- ゲーム座標Y(0-1280) → ワールドZ軸（-Z方向が画面奥）
- ワールドY軸 = 高さ（キャラクターの身長等）
- スケールファクタ: 1論理px = 0.01ワールドunit（720px = 7.2units幅）

```
2D論理座標系:          3Dワールド座標系:
(0,0)---→X(720)       Y(上)
|                      |  Z(奥/画面上)
|                      | /
↓Y(1280)              O---→X(右)
```

### QualityManager（新規）

**目的**: グラフィック品質のHigh/Low自動選択・手動切替

**責務**:
- デバイス性能の推定（GPU Tier検出 or フレームレートモニタリング）
- High/Low品質パラメータの管理
- シャドウマップ有効/無効切替
- パーティクル数制限
- SettingsManagerとの連携（手動切替の永続化）

### ProceduralMeshFactory（新規）

**目的**: プロシージャル3Dメッシュの生成

**責務**:
- キャラクターメッシュ生成（プレイヤー/味方/敵タイプ別）
- 武器メッシュ生成（タイプ別）
- アイテムメッシュ生成（ジェム形状、タイプ別カラー）
- 弾丸メッシュ生成
- 背景メッシュ生成（道路・ガードレール・砂漠地形）
- MeshToonMaterialの生成・キャッシュ

### SceneManager（新規）

**目的**: Three.jsシーンのオブジェクト管理

**責務**:
- エンティティ生成時のObject3Dシーン追加
- エンティティ破棄時のObject3Dシーン除去 + dispose()
- 背景オブジェクト（道路・地形）のライフサイクル管理
- ライティングセットアップ

### HTMLOverlayManager（新規）

**目的**: HTMLオーバーレイUIの管理

**責務**:
- HUD表示（HP、バフ、スコア、ウェーブ、武器種）
- タイトル画面表示/非表示
- ゲームオーバー画面表示/非表示
- モバイル操作ボタン表示
- DOM要素のライフサイクル管理
- textContent/DOM API使用（innerHTML禁止 — NFR-06）

### EffectManager3D（新規）

**目的**: 3Dエフェクトの生成・管理

**責務**:
- マズルフラッシュ（PointLight + パーティクル）
- 敵撃破パーティクル
- バフ取得エフェクト（光の柱）
- HP/ダメージ数値Sprite生成
- アイテムドロップ回転アニメーション
- 品質ティアに応じたパーティクル数調整

---

## 変更System

| System | 変更内容 |
|---|---|
| WeaponSystem | `SpriteComponent.width` → `MeshComponent.logicalWidth` に参照変更 |
| AllyFollowSystem | `SpriteComponent.width` → `MeshComponent.logicalWidth` に参照変更 |
| CleanupSystem | エンティティ破棄時にSceneManager経由でObject3D除去+dispose() |
| EffectSystem | 3Dエフェクト生成をEffectManager3D経由に変更 |
| InputSystem | 3D座標変換との連携（Raycasting逆変換） |

## 維持System（変更なし）

| System | 理由 |
|---|---|
| CollisionSystem | 2D論理座標での衝突判定。3D変換不要 |
| MovementSystem | 2D論理座標での移動計算。3D変換不要 |
| PlayerMovementSystem | 2D論理座標での境界制限 |
| HealthSystem | ゲームロジック |
| ItemCollectionSystem | ゲームロジック |
| BuffSystem | ゲームロジック |
| DefenseLineSystem | ゲームロジック |
| AllyConversionSystem | ゲームロジック |
| AllyFireRateSystem | ゲームロジック |
