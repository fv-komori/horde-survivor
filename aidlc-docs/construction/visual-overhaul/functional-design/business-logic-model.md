# ビジネスロジックモデル - ビジュアルリニューアル（Three.js導入）

## BL-01: 座標系変換ロジック（CoordinateMapper）

### 変換ルール（FR-09準拠）
```
2D論理座標 → 3Dワールド座標:
  worldX = (GAME_WIDTH - gameX) * SCALE     (X軸反転: カメラが+Z向きのため)
  worldY = entityHeight                     (エンティティタイプ別の高さ)
  worldZ = -(gameY * SCALE)                 (0-1280px → 0 ~ -12.8units、-Z=画面奥)

3Dワールド座標 → 2D論理座標:
  gameX = GAME_WIDTH - worldX / SCALE
  gameY = -worldZ / SCALE

SCALE = 0.01（1論理px = 0.01ワールドunit）
GAME_WIDTH = 720（論理画面幅）

※ カメラが+Z方向を向くため、画面右 = -worldX。
  X軸を反転してgameX増加(右移動)→画面右に正しくマッピング。
```

### エンティティタイプ別Y座標（高さ）マッピング
| エンティティ | worldY | 根拠 |
|---|---|---|
| プレイヤー | 0.4 | 身長0.8の中心 |
| 味方 | 0.35 | プレイヤーより若干小さい |
| 敵NORMAL | 0.35 | 標準サイズ |
| 敵FAST | 0.3 | 小型 |
| 敵TANK | 0.5 | 大型 |
| 敵BOSS | 0.7 | 特大 |
| 弾丸 | 0.5 | 銃口高さ |
| アイテム | 0.3 + sin(time) * 0.1 | 浮遊アニメーション |
| エフェクト | 発生元のY | 発生位置に準拠 |

## BL-02: ThreeJSRenderSystem メインループ

### 毎フレーム処理フロー
```
update(world, dt):
  1. query(MeshComponent, PositionComponent)で全エンティティ取得
  2. 各エンティティについて:
     a. pos = world.getComponent(entityId, PositionComponent)
     b. mesh = world.getComponent(entityId, MeshComponent)
     c. worldPos = CoordinateMapper.toWorld(pos.x, pos.y)
     d. worldPos.y = getEntityHeight(mesh.spriteType, dt)  // BL-01参照
     e. mesh.object3D.position.copy(worldPos)
  3. backgroundManager.updateScroll(dt)  // BL-03参照
  4. effectManager3D.updateEffects(dt)
  5. htmlOverlayManager.updatePositions(world, camera)  // HP表示位置同期
  6. renderer.render(scene, camera)
```

## BL-03: 背景スクロールロジック（ジオメトリ循環配置）

### 初期配置
```
タイル数: 3枚（道路メッシュ）
タイル長: roadLength = 5.0 units（gameConfig.three.road.length）
配置: tile[0].z = 0, tile[1].z = -5.0, tile[2].z = -10.0

同様にガードレールも3セット配置
```

### 毎フレーム更新
```
updateScroll(dt):
  scrollSpeed = 2.0 units/sec（gameConfigで定義）
  
  for each tile in roadTiles:
    tile.position.z += scrollSpeed * dt  // 手前方向へ移動
    
    if tile.position.z > resetThreshold:  // カメラフラスタム外に出たら
      tile.position.z -= tileLength * tileCount  // 最奥にリセット
  
  // ガードレールも同様に循環
```

## BL-04: プロシージャルメッシュ生成（ProceduralMeshFactory）

### キャラクター構成
```
Player Group:
  ├─ 胴体: BoxGeometry(0.3, 0.4, 0.2) — ToonMaterial(#1565C0)
  ├─ 頭: SphereGeometry(0.15) — ToonMaterial(#1E88E5)
  ├─ ヘルメット: SphereGeometry(0.17, 半球) — ToonMaterial(#37474F)
  ├─ バイザー: BoxGeometry(0.12, 0.04, 0.08) — ToonMaterial(#00BCD4)
  ├─ 左腕: CylinderGeometry(0.04, 0.04, 0.25) — ToonMaterial(#1565C0)
  ├─ 右腕: CylinderGeometry(0.04, 0.04, 0.25) — ToonMaterial(#1565C0)
  ├─ 左脚: CylinderGeometry(0.05, 0.05, 0.3) — ToonMaterial(#0D47A1)
  ├─ 右脚: CylinderGeometry(0.05, 0.05, 0.3) — ToonMaterial(#0D47A1)
  └─ 武器: (WeaponType別のGroup — BL-04b参照)

Enemy NORMAL Group:
  ├─ 胴体: BoxGeometry(0.3, 0.35, 0.2) — ToonMaterial(#F44336)
  ├─ 頭: SphereGeometry(0.13) — ToonMaterial(#EF5350)
  └─ 手足: (Playerと同様構成、赤系カラー)

Enemy FAST Group:
  ├─ 胴体: BoxGeometry(0.2, 0.3, 0.15) — ToonMaterial(#FF9800) // 小型
  └─ ...

Enemy TANK Group:
  ├─ 胴体: BoxGeometry(0.4, 0.5, 0.3) — ToonMaterial(#7B1FA2) // 大型
  ├─ 装甲: BoxGeometry(0.42, 0.3, 0.32) — ToonMaterial(#4A148C)
  └─ ...

Enemy BOSS Group:
  ├─ 胴体: BoxGeometry(0.5, 0.6, 0.35) — ToonMaterial(#B71C1C) // 特大
  ├─ 角: ConeGeometry(0.05, 0.15) x2 — ToonMaterial(#FF5722)
  ├─ 装飾: (追加装甲、マント等)
  └─ ...
```

### マテリアルキャッシュ戦略
```
materialCache: Map<string, MeshToonMaterial>

createToonMaterial(color):
  key = color
  if materialCache.has(key): return cached
  material = new MeshToonMaterial({ color })
  materialCache.set(key, material)
  return material
```

## BL-05: InstancedMesh管理（AD自動レビュー指摘対応）

### 対象エンティティ
| タイプ | 最大同時数 | InstancedMesh適用 |
|---|---|---|
| 弾丸 | 200 | **適用** — 同一ジオメトリ・同一マテリアル |
| 敵NORMAL | 50+ | **適用** — 同一形状、カラーバリエーションはattribute |
| 敵FAST/TANK/BOSS | 少数 | 不適用 — 個別Mesh |
| プレイヤー/味方 | 1+10 | 不適用 — 個別Mesh |
| アイテム | 50 | **適用** — 回転ジェム形状が共通 |

### InstancedMeshPool設計
```
class InstancedMeshPool {
  private instancedMesh: THREE.InstancedMesh;
  private freeSlots: number[] = [];          // 未使用スロット
  private activeSlots: Map<EntityId, number>; // エンティティ→スロットID

  constructor(geometry, material, maxCount)

  acquire(entityId): number               // スロット確保、instanceId返却
  release(entityId): void                 // スロット解放
  updateMatrix(instanceId, matrix): void  // 位置・回転更新
  setColor(instanceId, color): void       // 個別カラー（InstancedBufferAttribute）
  getInstancedMesh(): THREE.InstancedMesh
}
```

### MeshComponentとの統合
```
InstancedMesh対象エンティティのMeshComponent:
  object3D = null（個別Object3Dなし）
  追加プロパティ: instancePool参照 + instanceId

→ ThreeJSRenderSystemでの位置同期:
  if mesh.instancePool:
    mesh.instancePool.updateMatrix(mesh.instanceId, matrix)
  else:
    mesh.object3D.position.copy(worldPos)
```

## BL-06: 品質ティア自動切替（QualityManager）

### FPS計測メカニズム（AD自動レビュー指摘対応）
```
class QualityManager {
  private fpsHistory: number[] = [];           // 直近60フレームのfps
  private readonly SAMPLE_WINDOW = 60;         // 60フレーム移動平均
  private readonly COOLDOWN_MS = 5000;         // 切替後5秒間は再切替しない
  private lastSwitchTime = 0;

  measureFPS(dt):
    fps = 1 / dt
    fpsHistory.push(fps)
    if fpsHistory.length > SAMPLE_WINDOW: fpsHistory.shift()

  getAverageFPS(): number
    return average(fpsHistory)

  checkQualitySwitch():
    if now - lastSwitchTime < COOLDOWN_MS: return  // クールダウン中
    avgFps = getAverageFPS()
    if currentQuality == 'high' && avgFps < fpsThresholdForDowngrade:
      setQuality('low')
      lastSwitchTime = now
    else if currentQuality == 'low' && avgFps > fpsThresholdForUpgrade:
      setQuality('high')
      lastSwitchTime = now
}
```

### 品質パラメータ
| パラメータ | High | Low |
|---|---|---|
| シャドウマップ | 有効(1024px) | 無効 |
| パーティクル最大数 | 50 | 15 |
| InstancedMesh弾丸上限 | 200 | 100 |
| ポストプロセス | 有効 | 無効 |

## BL-07: WebGLコンテキストロスト復帰（AD自動レビュー指摘対応）

### イベントハンドリングフロー
```
GameService.init():
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost)
  renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored)

handleContextLost(event):
  event.preventDefault()  // デフォルト動作を抑制（これがないと復帰不可）
  gameState = PAUSED
  htmlOverlayManager.showMessage("描画を復帰中...")

handleContextRestored():
  try:
    // 1. レンダラーの内部状態リセット（Three.jsが自動で行う部分あり）
    // 2. 全マテリアルの再コンパイル（needsUpdate = true）
    sceneManager.recompileAllMaterials()
    // 3. 全テクスチャの再アップロード（needsUpdate = true）
    sceneManager.reuploadAllTextures()
    // 4. InstancedMeshプールの再構築
    instancedMeshPools.forEach(pool => pool.rebuild())
    // 5. ゲーム再開
    gameState = PLAYING
    htmlOverlayManager.hideMessage()
  catch:
    htmlOverlayManager.showMessage("復帰できませんでした。ページをリロードしてください。")
```

## BL-08: HP/ダメージ数値表示（HTMLオーバーレイ方式）

### HP表示ロジック
```
updateEnemyHP(world, camera):
  for each entity with (HealthComponent, PositionComponent, EnemyComponent):
    // 3Dワールド座標 → 画面スクリーン座標に投影
    worldPos = CoordinateMapper.toWorld(pos.x, pos.y)
    worldPos.y += entityHeight + 0.3  // 頭上にオフセット
    screenPos = worldPos.project(camera)
    // NDC→ピクセル座標に変換
    pixelX = (screenPos.x * 0.5 + 0.5) * canvasWidth
    pixelY = (-screenPos.y * 0.5 + 0.5) * canvasHeight
    // DOM要素の位置更新
    hpElement.style.transform = `translate(${pixelX}px, ${pixelY}px)`
    hpElement.textContent = `${health.currentHp}`
```

### ダメージ数値フロートアップ
```
showDamageNumber(screenX, screenY, damage):
  div = createElement('div')
  div.textContent = damage.toString()
  div.className = 'damage-float'
  div.style.left = screenX + 'px'
  div.style.top = screenY + 'px'
  container.appendChild(div)
  // CSSアニメーションで上方向にフロート + フェードアウト
  // animationend後にDOM除去
```

CSS:
```css
.damage-float {
  position: absolute;
  font-weight: bold;
  color: #FFD700;
  pointer-events: none;
  animation: float-up 0.8s ease-out forwards;
}
@keyframes float-up {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-40px); }
}
```

## BL-09: カメラ設定（AD自動レビュー指摘対応）

### カメラ設定（プレイヤー背後視点）
```
参考画像準拠: プレイヤーの背後から低い位置で前方を見上げるパースペクティブ

カメラ設定:
  FOV: 50度
  position: (3.6, 2.5, -13.5)  // プレイヤー背後・低めの位置
  lookAt: (3.6, 0.5, -4)        // 道路前方を注視

プレイヤー位置: (3.6, 0.4, -11.0)  ← gameY=1100
カメラはプレイヤーの2.5unit後方、2.5unit上

視野:
  カメラ→lookAt距離 ≈ sqrt(0 + 4 + 90.25) ≈ 9.7 units
  垂直FOV=50度: 可視高さ ≈ 2 * 9.7 * tan(25°) ≈ 9.0 units
  → プレイヤー〜敵出現エリアの必要範囲をカバー
```

## BL-10: InputHandler 3D対応（AD自動レビュー指摘対応）

### Canvas参照先の変更
```
変更前: InputHandler(document.getElementById('gameCanvas'))
変更後: InputHandler(renderer.domElement)

renderer.domElementはThree.jsのWebGLRendererが自動生成するcanvas要素。
タッチ/クリックイベントはこのcanvasにバインドする。
```

### タッチ→論理座標変換（プレイヤー移動用）
```
現行: タッチ座標 → canvas相対座標 → 論理座標(720x1280) → 左右判定
変更: タッチ座標 → canvas相対座標 → 論理座標(720x1280) → 左右判定
  ※ 変換ロジックは既存のtoLogicalCoords()を流用可能
  ※ Raycastingは不要（プレイヤーは左右移動のみでタップ位置選択なし）
```

**結論**: 本ゲームはタップで3D空間内のオブジェクトを選択する操作がないため、Raycastingは不要。InputHandlerのcanvas参照先をrenderer.domElementに変更するのみ。

## BL-11: CSP互換性（AD自動レビュー指摘対応）

### 結論
- Three.js r164のコアモジュール（WebGLRenderer, Scene, PerspectiveCamera, MeshToonMaterial等）は`unsafe-eval`不要
- 本プロジェクトではTSL/NodeMaterial不使用
- ShaderMaterialのカスタムGLSLはGPUに直接渡されるためCSP影響なし
- CSS2DRenderer（HP表示用）はインラインスタイルを注入するため`style-src 'unsafe-inline'`が必要（現行CSPで既に許可済み）
- **CSP変更不要**

## BL-12: WebGL非対応チェック

### 起動時フロー
```
GameService.init():
  // Three.jsロード前にWebGL対応チェック
  canvas = document.createElement('canvas')
  gl = canvas.getContext('webgl2')
  if (!gl):
    htmlOverlayManager.showFallbackMessage(
      "このブラウザはWebGL 2.0に対応していないため、ゲームをプレイできません。"
    )
    return  // Three.js初期化をスキップ
  canvas = null  // チェック用canvasを解放
  
  // WebGL対応 → Three.js初期化続行
  ...
```
