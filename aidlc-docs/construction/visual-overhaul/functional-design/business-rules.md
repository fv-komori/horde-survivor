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
- 道路の左右に木製風（0x8b5a3c 焼け木色）のBoxGeometry
- 縦杭を等間隔(0.8unit)に配置
- 横木2本（上段 height*0.9 / 中段 height*0.5、濃色 0x6b4223）

### BR-BG04: 空ドーム（グラデーション背景）
- SphereGeometry(radius=40) + BackSide + ShaderMaterial（静的GLSLリテラル、動的結合禁止）
- uniforms: uTopColor=0x87ceeb / uBottomColor=0xc9a96e / uOffset=0 / uExponent=0.6
- material.fog=false（Fogの影響を受けない）、depthWrite=false、renderOrder=-1
- scene.backgroundは設定しない（空ドームで置換）

## BR-LIGHT: ライティングルール

### BR-LT01: 三層ライティング
- AmbientLight（0xfff5e6, intensity 0.7）
- HemisphereLight（sky=0x87ceeb, ground=0xc9a96e, intensity 0.4）: Low品質で intensity=0、Directional×1.15 で補正
- DirectionalLight（0xfff4e0 暖色, intensity 1.0, castShadow quality依存）

### BR-LT02: Fog
- Fog(0xc9a96e, near=15, far=45)
- setFogEnabled(false) 時は far=9999 に設定（scene.fog=null はシェーダ再コンパイル発生のため避ける）

## BR-OUTLINE: 輪郭線（反転ハル）ルール

### BR-OL01: Outline適用対象
- 対象: Group描画のキャラ（Player/Ally/Enemy×4）・武器のみ
- 対象外: InstancedMesh描画の弾丸・アイテム、Sprite/半透明エフェクト
- 視認性: InstancedMesh系は emissive + Bloom で確保

### BR-OL02: Outline実装
- 反転ハル法: 各Mesh に対し BackSide + MeshBasicMaterial(depthWrite=false, transparent=false) のシェルを兄弟として親Groupに追加
- 厚み: scale * (1 + thickness=0.04)、親Groupのscaleに影響しない子Mesh単位で適用
- マテリアルはFactoryキャッシュ共有（ゲームライフサイクル中保持、Factory.disposeAll()で一括release）
- 各シェルに userData.isOutline=true を設定

### BR-OL03: Outline切替
- SceneManager.setOutlineEnabled(enabled): scene.traverse で userData.isOutline=true のメッシュを visible 切替
- 生成/破棄を伴わないためスパイク（GC・シェーダ再コンパイル）を回避

## BR-POSTFX: PostFXルール

### BR-PX01: EffectComposer構成
- 順序: RenderPass → UnrealBloomPass → OutputPass
- OutputPass により renderer.toneMapping (ACESFilmicToneMapping) と sRGBColorSpace を正しく適用
- 失敗時は PostFXManager.tryCreate が null を返し、renderer.render 直接呼びにフォールバック

### BR-PX02: Bloomパラメータ
- strength=0.6, radius=0.4, threshold=0.85（emissive中心のみ発光）
- 品質Low時は PostFXManager.setEnabled(false) で composer 無効化

### BR-PX03: RenderTargetサイズ制限
- dpr上限 Math.min(devicePixelRatio, 2)、RenderTarget最大サイズ 2048 でクランプ
- HiDPI/巨大ウィンドウ時のGPUメモリ枯渇DoS対策

### BR-PX04: コンテキストロスト復帰
- handleContextLost: contextLost=true、composer.render呼び出し抑止
- handleContextRestored: 既存composer/bloomPass/renderPass/outputPassをdispose→再生成、失敗時はenabled=false永続化
- 復帰順序: SceneManager再構築 → PostFXManager.handleContextRestored → QualityManager再適用

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
