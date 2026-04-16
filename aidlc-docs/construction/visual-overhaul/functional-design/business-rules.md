# ビジネスルール定義 - ビジュアルリニューアル

## BR-RENDER: レンダリングルール

### BR-R01: 座標系分離原則
- ゲームロジック系Systemは2D論理座標(720x1280)のみを使用する
- 3Dワールド座標はThreeJSRenderSystem内でのみ使用する
- CoordinateMapper経由以外の座標変換を禁止する

### BR-R02: レンダリング実行順序
- ThreeJSRenderSystemは全Systemの最後（priority=99）に実行する
- CleanupSystem（priority=98）で破棄されたエンティティはレンダリング対象外
- EffectManager3D.updateEffects()はThreeJSRenderSystem内で呼び出す

### BR-R03: レンダリングレイヤー
| レイヤー | 対象 | 描画順 |
|---|---|---|
| Background | 道路、砂漠、ガードレール | 最背面（シーン直接配置） |
| InstancedMesh | 弾丸、敵NORMAL、アイテム | シーン直接配置 |
| Individual | プレイヤー、味方、FAST/TANK/BOSS、エフェクト | シーン直接配置 |
| Overlay | HP表示、ダメージ数値、HUD | HTMLオーバーレイ（最前面） |

## BR-MESH: メッシュ管理ルール

### BR-M01: MeshToonMaterial使用原則
- 全キャラクター・オブジェクトにMeshToonMaterialを使用する
- セルシェーディング風の統一ビジュアルを維持する
- emissiveプロパティは弾丸・エフェクトのみに使用可

### BR-M02: ヒットフラッシュ
- 敵がダメージを受けた時、全マテリアルのcolorを白(#FFFFFF)に0.1秒間変更
- 0.1秒後にbaseColorに復帰
- InstancedMeshの場合はsetColor()で個別に白フラッシュ

### BR-M03: InstancedMesh使用判定
- 同時存在数が20以上になりうるエンティティタイプにInstancedMeshを適用
- 弾丸(maxBullets=200)、敵NORMAL(maxEnemies=300)、アイテム(maxItems=50)が対象
- 敵FAST/TANK/BOSSは同時存在数が少ないため個別Mesh

### BR-M04: マテリアルキャッシュ
- 同一カラーのToonMaterialはキャッシュして共有
- ゲーム終了・リセット時にdisposeCachedMaterials()で全キャッシュ解放

## BR-QUALITY: 品質管理ルール

### BR-Q01: 品質自動切替
- 直近60フレームの平均fpsで判定
- High→Low: 平均fps < 25 が連続5秒
- Low→High: 平均fps > 55 が連続5秒
- 切替後5秒間はクールダウン（再切替禁止）

### BR-Q02: 品質パラメータ適用
- シャドウマップ: High=有効(1024px)、Low=無効
- パーティクル数: High=最大50、Low=最大15
- InstancedMesh弾丸上限: High=200、Low=100
- 品質切替時はrenderer.shadowMap.enabled/DirectionalLight.castShadowを動的切替

### BR-Q03: 初期品質
- 起動時はHigh品質で開始
- WebGL2対応チェック済み後にレンダリング開始
- 最初の60フレームでfps計測→必要に応じてLowに自動ダウングレード

## BR-MEMORY: メモリ管理ルール（NFR-05準拠）

### BR-MEM01: リソースdispose必須
- エンティティ破棄時、以下の順序でdispose:
  1. SceneManager.removeEntity(object3D) — scene.remove()
  2. SceneManager.disposeObject(object3D) — traverse → geometry.dispose(), material.dispose(), texture.dispose()
  3. world.destroyEntity(entityId)
- InstancedMeshの場合はinstancePool.release(entityId)のみ（Meshは共有）

### BR-MEM02: InstancedMeshプールの再構築
- WebGLコンテキストロスト復帰時にInstancedMeshプールを再構築
- 全アクティブエンティティのmatrix/colorを再設定

### BR-MEM03: WebGLRendererのライフサイクル
- WebGLRendererはアプリ全体で1インスタンスを維持
- ゲームリセット（リトライ/タイトル遷移）時はSceneのみクリア+再構築
- renderer.dispose()はページアンロード時のみ呼び出す

## BR-UI: UI管理ルール

### BR-UI01: HTMLオーバーレイの安全性（NFR-06準拠）
- innerHTML使用禁止。textContent + DOM APIのみ
- ユーザー入力値のDOM反映時はサニタイズ経由
- CSSクラス名はハードコード文字列のみ使用（動的生成禁止）

### BR-UI02: HP表示の位置同期
- 毎フレーム、3Dワールド座標をカメラで画面座標に投影
- Vector3.project(camera) → NDC → ピクセル座標
- DOM要素のtransformで位置更新（reflow回避のためtop/leftではなくtranslate使用）

### BR-UI03: ダメージ数値表示
- CSSアニメーション（float-up）で上方向にフロート+フェードアウト
- animationend後にDOM要素を除去
- DOM要素プール（最大20個）で再利用しGC負荷を軽減

### BR-UI04: HUD表示
- GameState=PLAYINGの時のみHUD表示
- 更新頻度: 毎フレーム（requestAnimationFrame内）
- textContentで数値更新（DOM操作最小化）

## BR-BACKGROUND: 背景管理ルール

### BR-BG01: ジオメトリ循環配置
- 道路タイル3枚を配置し、毎フレーム+Z方向に移動
- カメラフラスタム外に出たタイルを最奥にリセット
- ガードレール・砂漠地面も同様に循環

### BR-BG02: 道路デザイン
- グレー(0x888888)のPlaneGeometry
- 中央に白(0xffffff)の車線マーキング（BoxGeometry薄板）
- 車線は破線（一定間隔で配置）

### BR-BG03: ガードレールデザイン
- 道路の左右にメタルグレー(0xaaaaaa)のBoxGeometry
- 支柱を等間隔(1.0unit)に配置
- 上部にレール（CylinderGeometry）

## BR-EFFECT: エフェクトルール

### BR-EF01: マズルフラッシュ
- PointLight（色: 黄、intensity: 2.0、distance: 1.0）
- 0.05秒間表示して消灯
- 品質Low時: PointLightなし（パーティクルのみ）

### BR-EF02: 敵撃破エフェクト
- 敵のbaseColorに基づくパーティクル（BoxGeometry小片 x 品質依存数）
- 放射状に飛散 + 重力で落下
- 0.5秒でフェードアウト + dispose

### BR-EF03: バフ取得エフェクト
- 光の柱（CylinderGeometry、emissiveあり）
- 0.3秒間で上方向に伸びてフェードアウト

### BR-EF04: アイテム回転
- アイテムメッシュをY軸周りに毎秒90度回転
- sin(time)で上下浮遊（振幅0.1unit、BL-01参照）

## BR-CSP: CSP互換性ルール（AD自動レビュー指摘対応）

### BR-CSP01: CSP変更不要
- Three.js r164のコアモジュールはunsafe-eval不要
- TSL/NodeMaterial不使用
- CSS2DRendererはstyle-src 'unsafe-inline'が必要（現行CSPで許可済み）
- 現行CSP設定をそのまま維持

## BR-INPUT: 入力ルール

### BR-IN01: InputHandler Canvas参照
- renderer.domElement（WebGLRenderer生成canvas）にイベントバインド
- 既存のtoLogicalCoords()はBoundingClientRect変換で互換性あり
- Raycasting不要（タップでの3Dオブジェクト選択操作なし）

### BR-IN02: モバイル操作ボタン
- HTMLOverlayManagerがDOM要素として描画
- WebGLキャンバス上にposition:absoluteで配置
- タッチイベントはDOM要素で直接ハンドル（キャンバスへのバブリング防止）
