# Requirements - Iteration 5: GLTFモデル導入（Toon Shooter Game Kit）

## 参考・前提

- 参考画像: `./reference-visual.png` / `./lastwar.jpeg`（Iter3/4と同じ、LAST WAR風トップダウンチビキャラ）
- Iter4で「プロシージャル積み木の限界（銃を構えた姿勢が作れない、有機的シルエットを出せない）」が明確化
- 本Iterで **プロシージャルメッシュ→GLTFスケルトンアニメ** に全面置換する

## 使用アセット（配置済み）

- **パック**: Toon Shooter Game Kit by Quaternius（CC0, Dec 2022版）
- **出典**: https://quaternius.com/packs/toonshootergamekit.html
- **配置先**: `public/models/toon-shooter/v1/`（LICENSE.txt含む、バージョン付きパス採用 — NFR-09 参照）
- **採用ファイル**:
  - Characters: `Character_Soldier.gltf`, `Character_Enemy.gltf`, `Character_Hazmat.gltf`
  - Guns: `AK.gltf`, `Pistol.gltf`, `Shotgun.gltf`
  - Environment: `Barrier_Single.gltf`, `Crate.gltf`, `SackTrench.gltf`, `Fence.gltf`, `Fence_Long.gltf`, `Tree_1.gltf`
- **合計サイズ**: 7.0MB（base64埋込glTF 2.0 単一ファイル）
- **アニメ**: 17種/キャラ（Idle, Idle_Shoot, Run, Run_Shoot, Run_Gun, Walk, Walk_Shoot, Jump, Jump_Idle, Jump_Land, Duck, HitReact, Death, Punch, Wave, Yes, No）

## Intent Analysis

- **User Request**: キャラ/武器/環境をプロシージャル生成からCC0 glTFモデルに置換し、スケルトンアニメで「銃を構える」「走り撃ち」「被弾」「死亡」等を表現する
- **Request Type**: Major Enhancement（レンダリング基盤の差し替え）
- **Scope Estimate**: Factory / Rendering / Components / Systems の広範改修（ゲームロジック・UI・音・スポーン・バランスは不変）
- **Complexity Estimate**: High（非同期アセットロード、Skinned Mesh clone、AnimationMixer、bone attach）

## キャラクター↔モデル対応（合意済み）

| 役割 | GLTFモデル | 色 / スケール | 備考 |
|---|---|---|---|
| Player | `Character_Soldier` | 青系（既存踏襲）/ 1.0x | 主人公 |
| Ally | `Character_Enemy` | **青tint** / 1.0x | 「敵を味方に変換」の設定と整合 |
| Enemy NORMAL | `Character_Enemy` | 赤tint / 1.0x | |
| Enemy FAST | `Character_Enemy` | 赤tint+高彩度 / 0.85x | |
| Enemy TANK | `Character_Enemy` | 暗装甲tint / 1.3x | |
| Boss | `Character_Hazmat` | 特殊色・発光装飾 / 1.8x | |

同一モデルの tint は MeshStandardMaterial / MeshToonMaterial の `color` プロパティを entityごとにclone設定することで実現。

## 機能要件

### FR-01: GLTFアセットロード基盤

- ゲーム起動時に以下を **AssetManager**（新規）でプリロード:
  - Characters 3モデル（Soldier / Enemy / Hazmat）
  - Guns 3モデル（AK / Pistol / Shotgun）
  - Environment 6モデル
- `GLTFLoader` を使用。ロード完了まで Promise で待機
- ロード成功後、各 GLTF の `scene` と `animations` を AssetManager 内に保持（後述の clone 用テンプレート）

#### ロード失敗時のハンドリング（F-NG-1 / B-NG-3 / I-NG-5 / O-NG-4 統合）

- `Promise.all` で全件を同時待機し、**1件でも失敗したら起動中止**、エラー画面＋再試行ボタンを表示
- タイムアウト:
  - 各ファイル: **30秒**
  - 全体: **60秒**
- 自動リトライは**行わない**（無限ループを避ける）。ユーザー操作での再試行は**最大3回**まで許容し、4回目以降は「ブラウザリロードを促すメッセージ」に切り替える
- **部分起動禁止**: 1モデルでも欠損している状態でゲームを開始しない
- エラー画面には汎用的な文言のみ表示（詳細エラーは console にログ — NFR-06 参照）

### FR-02: ローダー画面（新規UI）

- 既存のスタート画面（`GameStartScreen`）表示前に**ローダー画面**を出す
- 表示内容: `Loading...` テキスト + 進捗バー（ロード済ファイル数/総数、±8%許容）
- ロード完了後、既存のスタート画面に遷移
- スタイル: 既存UIと調和する簡素な中央表示（z-index: 設定画面より下）
- **XSS対策**: DOM 構築は `textContent` と DOM API のみ（`innerHTML` 使用禁止）。Iter3 NFR-06 の方針を継承（NFR-08 参照）
- タイムアウト経過（60秒）で自動的にエラー画面に遷移、再試行ボタンを提供

### FR-03: SkinnedMesh clone と EntityFactory 改修

- キャラを entity 生成のたびに **SkeletonUtils.clone()** で clone（three/examples/jsm/utils/SkeletonUtils）
- 各 clone は**独自の AnimationMixer / 独自の material instance**（tint独立のため）を持つ
- `EntityFactory` を改修:
  - `createPlayer()` → Soldier clone
  - `createAlly()` → Enemy clone + 青tint
  - `createEnemy(variant)` → Enemy clone + 該当 tint + scale
  - `createBoss()` → Hazmat clone + 特殊色
- 既存 `ProceduralMeshFactory` は**削除**（すべて GLTF に一本化）
- EntityFactory は constructor で **ロード済み AssetManager を DI** される（未ロード状態での生成禁止 — 起動シーケンス節参照）

#### dispose 責任分界（O-NG-2対応）

Three.js リソースのライフサイクルを以下のように明確化する:

| リソース | 所有者 | dispose 責任 | 備考 |
|---|---|---|---|
| AssetManager 保持の GLTF テンプレート（`scene`, `animations`, 元 material） | AssetManager | **dispose 禁止**（アプリ終了まで保持） | ゲーム中は常にclone元として参照される |
| `SkeletonUtils.clone` で生成した root Object3D | entity（MeshComponent） | **CleanupSystem** が entity 削除時 | scene から remove → children 全て traverse |
| clone後の SkinnedMesh.geometry | entity | **CleanupSystem** | clone 独立のため |
| clone後の SkinnedMesh.material（tint 用に clone 済） | entity | **CleanupSystem** | entity ごとに独自 instance |
| AnimationMixer（entity 個別） | entity | **CleanupSystem** | `stopAllAction()` + `uncacheRoot(root)` |
| AnimationAction（entity 個別、clip 参照は共有） | entity | **CleanupSystem** | `mixer.uncacheAction(clip)` |
| 反転ハル用 SkinnedMesh の geometry / material | entity | **CleanupSystem** | 本体と同じ skeleton を bind するが geometry/material は独立 |
| AnimationClip（clip 本体） | AssetManager | **dispose 禁止** | 全entityで共有、clip 自体は参照のみ |
| bone（THREE.Bone） | entity 側 root の子 | 明示 dispose 不要 | root remove 時に GC 対象 |

**原則**: AssetManager が保持するオブジェクト（scene / animations / 元 material）は**不変・dispose 禁止**。clone で entity 側に新規生成されたものは **CleanupSystem が責任**。

### FR-04: AnimationSystem（新規ECS System）

- `MeshComponent` を拡張し、`mixer?: AnimationMixer` / `animations?: Map<string, AnimationAction>` を保持（どちらも optional、環境メッシュ・弾丸・エフェクトは null）
- **新規 `AnimationStateComponent`**（B-NG-4対応）:
  ```ts
  class AnimationStateComponent {
    hitReactTimer: number = 0;   // 残り秒、>0 の間は HitReact 再生
    deathFlag: boolean = false;  // true で Death 遷移
    currentClip: string = '';    // 現在再生中の clip 名（crossFade 判定用）
  }
  ```
- **書き込み責任**:
  - CombatSystem: ダメージ発生時に `anim.hitReactTimer = 0.4` を書き込み
  - HealthSystem: HP<=0 検知時に `anim.deathFlag = true` を書き込み
- **読み取り・消化**:
  - AnimationSystem が毎フレーム currentClip と照合し、状態遷移・crossFade・mixer 駆動を担当
  - HitReact 終了時は velocity を再判定して Run_Shoot / Idle_Shoot を選び直す
- 新規 `AnimationSystem`（priority: RenderSystemの直前）:
  - 毎フレーム全mixerの `update(dt)` を呼ぶ
  - entity の AnimationStateComponent + 位置/速度 情報から自動でアニメを選択し crossFade

#### 前提: 戦闘中は常時射撃

実装調査の結果、プレイヤー/仲間/敵とも連射武器（FORWARD=0.15秒間隔）で**ゲーム中は実質常に射撃中**。よって「射撃しない走り/歩き」は使わず、**戦闘アニメ（Run_Shoot / Idle_Shoot）を既定**とする。

#### アニメ選択ルール（ゲームプレイ中）

| 状態 | アニメ | 備考 |
|---|---|---|
| velocity > 閾値 | `Run_Shoot` | 走り撃ち（移動時の既定） |
| 静止 | `Idle_Shoot` | 静止射撃（静止時の既定） |
| 被弾フラグON（0.4秒間） | `HitReact` | パルス再生、終了後は上記に戻る |
| 死亡フラグON | `Death` | 1回再生、完了時にエンティティ削除 |

- 優先順位: **Death > HitReact > Run_Shoot/Idle_Shoot**
- 切替は **0.1秒 crossFade**（Death は crossFade なし、即切替）
- crossFade中でも優先度ルールを毎フレーム再評価、上位stateが立てば即座に上書き
- プレイヤー/仲間/敵（NORMAL/FAST/TANK/BOSS）すべて同一ルール

#### Death 完了→エンティティ削除シーケンス（B-NG-1 / Q-NG-6対応）

HP<=0 検知から entity 削除までを以下の順序で実行する:

1. **HealthSystem**: HP<=0 を検知し `AnimationStateComponent.deathFlag = true` をセット（まだentity削除しない）
2. **AnimationSystem**: `deathFlag` を検出し、`Death` clip を `setLoop(THREE.LoopOnce, 1)` + `clampWhenFinished = true` で再生開始、他アニメは即停止
3. **AnimationSystem**: `mixer.addEventListener('finished', handler)` で Death clip 完了を検知し、entity に `DeathCompleteFlag` を付与
4. **CleanupSystem**（既存）: `DeathCompleteFlag` を検知した同一フレームで以下を順に実行
   - (a) XPドロップ（既存 Iter4 実装どおりの位置・量でdrop entity生成）
   - (b) `mesh.dispose()` 相当: SkinnedMesh 本体 + 反転ハルメッシュ両方の geometry / material を dispose、`mixer.stopAllAction()` + `mixer.uncacheRoot(root)`、action群を `mixer.uncacheAction(clip)` で解放（NFR-07参照）
   - (c) `world.removeEntity(entity)` で entity を削除

- Death 完了判定は必ず `mixer.finished` イベントを使用し、タイマーによる経過時間判定は**しない**（clip長がモデル由来で変わるため）
- Death 中にダメージを受けても HitReact には遷移しない（優先度 Death > HitReact）

#### 非戦闘コンテキスト

| 場面 | アニメ | 備考 |
|---|---|---|
| スタート画面のプレイヤープレビュー | `Idle` | 武器を下ろした静止、呼吸モーション。専用 mini-renderer で独自駆動 |
| （将来）クリア時演出 | `Wave` | 今回は未実装、アセットのみ温存 |

#### 未使用アニメ（温存）

`Run`, `Walk`, `Walk_Shoot`, `Run_Gun`, `Punch`, `Jump`, `Jump_Idle`, `Jump_Land`, `Duck`, `Yes`, `No` はコードから参照しない。将来の拡張（近接攻撃、ジャンプ回避、ジェスチャ演出）時にルール追加で使えるよう、アセットは全保持。

### FR-05: 武器attach（bone階層への取り付け）

- 武器 GLTF（AK / Pistol / Shotgun）を clone し、キャラのスケルトンの**手のbone**に add する
- **Construction 着手前の事前タスク**（F-NG-2 / Q-NG-4対応）:
  - Character_Soldier / Character_Enemy / Character_Hazmat の3モデルについて bone 名を事前調査し、 application-design-v5.md に以下の形式で確定記載する:
    ```ts
    type BoneAttachmentConfig = Record<CharacterType, {
      handBone: string;      // 例: "Hand.R" or "RightHand" or "mixamorig:RightHand"
      offset: Vector3;       // 手の内部へ押し込む位置調整
      rotation: Euler;       // 銃身の向き調整
    }>;
    ```
  - モデル間で bone 名が異なる場合は上記設定で吸収（決め打ちのハードコードは禁止）
- attach 時にローカル座標の offset / rotation を調整し、「構えた姿勢」になるよう微調整
- 武器割り当て（最小版）:
  - Player: AK
  - Ally: Pistol（プレイヤーより簡素）
  - Enemy NORMAL/FAST: Pistol
  - Enemy TANK: Shotgun
  - Boss: AK
- 武器切替システムは**本Iterでは入れない**（将来拡張）
- 銃口位置: 武器GLTF内に Muzzle ノードがあればそれを使用、無ければ武器ごとの定数 offset を使用（MVPは後者）

### FR-06: Outline（反転ハル法を維持）

- Iter3/4 の反転ハル法（BackSide 黒メッシュをわずかに拡大して追加）を **SkinnedMesh に対応**:
  - clone したメッシュに対して反転ハル用メッシュも同時に clone し、同じスケルトンに bind
  - SkeletonUtils.clone の挙動に合わせて skinning が追随するよう実装

#### 反転ハルの bind 手順（B-NG-5対応）

1. `SkeletonUtils.clone(gltf.scene)` で得た root から本体 SkinnedMesh を取り出す
2. 本体 SkinnedMesh から `skeleton` と `bindMatrix` を取得
3. 反転ハル用 SkinnedMesh を「本体geometry を clone + BackSide 黒 material + わずかにscale up」で生成
4. 反転ハル用 SkinnedMesh に対して `.bind(skeleton, bindMatrix)` を呼び、本体と同じ skeleton を共有
5. 毎フレーム `mixer.update(dt)` は本体 root に対して1回呼べば、bone 行列は共有されるため両メッシュに反映される

#### 事前スパイク（F-NG-3対応）

- Construction 初日に Character_Soldier 1体でスパイクを実施し、以下を検証:
  - SkinnedMesh + 反転ハルで skinning が破綻しないか（手や頭の動きに追随するか）
  - 45fps を維持できるか（51体想定の負荷は別途評価）
- スパイク成立基準: Playwright で目視確認、アウトラインが身体の動きに追随し破綻しないこと（4点: 手・武器・頭・足）
- **成立しない場合**: 本Iterでは Outline を OFF（Low品質と同等扱い）へ暫定退避し、FR-06 自体は Iter6 に送る。リリースは Outline OFF 状態で可とする

- 背景（Environment モデル）にはアウトライン付与しない（既存方針継続）
- Low 品質設定では OFF（既存 QualityManager ロジック継承）

### FR-07: 環境アセット置換

- 既存の道路/フェンス/砂漠のプロシージャル生成を以下に置換:
  - ガードレール → `Fence.gltf` / `Fence_Long.gltf` 配置
  - 破壊可能ボックス風 → `Crate.gltf`
  - 砂嚢装飾 → `SackTrench.gltf`
  - バリア → `Barrier_Single.gltf`
  - 遠景 → `Tree_1.gltf`
- 道路/地面のタイル自体はIter4の見た目を継続（GLTFに該当モデルなし）
- 環境GLTFは static なので1回 clone してシーンに add（AnimationMixer不要）

### FR-08: Ally変換ゲート・弾丸・エフェクトは既存維持

- 緑/数字ゲート、弾丸、マズルフラッシュ、爆発、XP pickup等は**Iter4の実装を流用**
- GLTF化は上記「キャラ・武器・環境」に限定

## 非機能要件

### NFR-01: パフォーマンス

#### 目標

- **同時キャラ数**: プレイヤー1 + 仲間最大20 + 敵最大30 = 51キャラを想定
- High品質 **平均60fps / 最低45fps**（Iter4 NFR-01を継承）
- SkinnedMesh + 反転ハル = キャラ1体あたり 2メッシュ → 最大102メッシュ
- AnimationMixer は clip の共有により負荷を軽減（clip は AssetManager に1本、Action のみ entity 個別）

#### 測定条件（Q-NG-3 / O-NG-5対応）

- 計測シナリオ: 敵30 + 仲間20 + プレイヤー1 が全員射撃中、弾丸同時最大N発、爆発同時N個
- 計測区間: **30秒**
- 計測手段: Chrome DevTools Performance で fps タイムライン取得
- 評価: `performance.now()` ベースの**移動平均（直近60フレーム）**で 45fps / 60fps を評価
- 自動降格（任意、Iter6判断）: 45fps 未達を3秒連続検出したら Low 品質へ降格

#### Low品質での間引き

- Outline OFF / Bloom OFF
- アニメ更新間引き: 本Iterでは**採用しない**（Iter6判断）
  - 採用する場合でも HitReact / Death は**毎フレーム更新**、Run_Shoot / Idle_Shoot のみ間引き対象
- triangle / draw call 計測: PoC段階で `renderer.info` を取得し application-design v5 に記載

### NFR-02: ロード時間

#### 目標

- 初回ロード: **10秒以内**（7MB + three.js 初期化、cold load）
- ロード中はローダー画面を表示、進捗フィードバックあり

#### 測定条件（I-NG-1 / Q-NG-2対応）

- ブラウザ: Chrome 最新版
- デバイス: デスクトップ Mac（M1相当）
- 配信: localhost または静的ホスティング（GitHub Pages / Netlify 等）
- 回線: 有線または Wi-Fi 実効 **10Mbps 以上**
- キャッシュ: cold load（ブラウザキャッシュ無し）
- 配信側 gzip または brotli を有効化した前提で実効転送サイズ **約2〜3MB** を想定
- モバイル・低速回線は本Iter対象外（Iter6で評価）

#### 配信圧縮方針（I-NG-2対応）

- 配信先で **gzip または brotli を有効化**すること
  - GitHub Pages / Netlify: 自動圧縮が効く（追加設定不要）
  - S3 + CloudFront の場合: CloudFront の自動圧縮を ON、または事前圧縮ファイル（`.gltf.gz` / `.gltf.br`）を配置
- Content-Type（I-NG-3対応）: `.gltf` = `model/gltf+json`

### NFR-03: 既存アーキテクチャ互換

- ECS / Systems の大半は**変更なし**
- 改修範囲:
  - 新規: `src/managers/AssetManager.ts`, `src/systems/AnimationSystem.ts`, `src/components/AnimationStateComponent.ts`, `src/ui/LoaderScreen.ts`
  - 改修: `src/factories/EntityFactory.ts`, `src/components/MeshComponent.ts`, `src/rendering/SceneManager.ts`, `src/rendering/RenderSystem.ts`（該当する場合）, `src/systems/CleanupSystem.ts`, `src/systems/CombatSystem.ts`, `src/systems/HealthSystem.ts`
  - 削除: `src/factories/ProceduralMeshFactory.ts`（全削除）
  - 環境生成箇所（SceneManagerの該当メソッド）を GLTF 配置に置換

### NFR-04: Three.js バージョン

- 現在: `three@^0.183.2`
- GLTFLoader, SkeletonUtils は `three/examples/jsm/` から import（追加 dependency 不要）
- package.json への追加インストールなし
- 依存 pin: `package-lock.json` で固定、`npm audit` 定期実行（既存運用）

### NFR-05: テスト方針

#### ユニットテスト

- AssetManager のロード完了判定・失敗系・タイムアウト（mock GLTFLoader）
- AnimationSystem のアニメ切替ルール（state machine）、Death完了イベント検知
- AnimationStateComponent の初期値・書き込み
- EntityFactory の clone 独立性:
  - material instance が entity間で `!==` であること
  - skeleton が entity間で `!==` であること
  - tint を変えても他entityに影響しないこと
- malformed / truncated GLTF を渡した際のエラーハンドリング negativeテスト

#### テスト件数の変更（Q-NG-1対応）

- 削除: ProceduralMeshFactory.test.ts 系（該当件数は実装時確定）
- 追加: AssetManager.test.ts, AnimationSystem.test.ts, AnimationStateComponent.test.ts, EntityFactory.gltf.test.ts
- 最終目標: 既存86件 − 削除N件 + 追加N件 ≒ 同等以上のカバレッジ

#### GLTFLoader の mock 戦略（Q-NG-11対応）

- `jest.mock('three/examples/jsm/loaders/GLTFLoader')` で `load()` を stub 化
- 共通 fixture を `tests/fixtures/mockGltf.ts` に配置:
  - 既定のダミー GLTF（`scene: new THREE.Group()`, `animations: []`）を即時 resolve
  - エラーケース用の reject fixture も提供
- AssetManager テストと EntityFactory テストで fixture を共有

#### 目視確認

- Playwright MCP でローダー画面 → ゲーム画面 → キャラアニメ動作を確認
- 反転ハル追随チェック: スクショ+目視で4点確認（手・武器・頭・足のアウトラインが身体に追随しているか）
- Iter5 リリース前の目視チェックリスト:
  1. ローダー画面の進捗表示が正しく増える
  2. GameStartScreen の Idle アニメが破綻しない
  3. 戦闘中に Run_Shoot / Idle_Shoot / HitReact / Death が設計通り遷移する
  4. 武器が手のbone に追随し位置がずれない
  5. 敵撃破→XPドロップ→mesh消滅 のシーケンスが視覚的に破綻しない

#### 視覚回帰・退行検知（O-NG-6対応）

- `test-screenshots/iter5-baseline/` に基準画像を配置、Playwright で pixel diff 許容値 **< 5%**
- 基準画像3枚:
  1. Start画面
  2. 戦闘開始10秒
  3. Boss戦
- Iter5 開始時に全基準を更新してコミット
- メモリ退行検知: ゲーム開始時と5分後の heap 差分を `performance.memory`（Chromeのみ）から取得しログ出力

#### 観測性（O-NG-10対応）

- `window.addEventListener('error', ...)` で未捕捉エラーをログ
- `window.addEventListener('unhandledrejection', ...)` で Promise 例外をログ
- WebGLコンテキストロスト・復帰のログ出力

### NFR-06: ライセンス / セキュリティ方針

- LICENSE.txt を `public/models/toon-shooter/` 配下に配置（実施済み）
- リポジトリ README やゲーム内クレジットへのQuaternius明記は**Iter6対応**（ゲーム内 Credits 画面）
- アセットホワイトリスト: 本Iterは**同梱アセットのみ**を使用、ユーザー/リモートGLTFロードは**禁止**
- payload 上限: モデル各 **2MB 上限**、超過検知時はエラー（MVP）
- エラーメッセージ方針: ユーザー向けは汎用メッセージのみ、詳細スタック/ファイル名は console のみ

### NFR-07: メモリ管理

**v3 NFR-05 を継承** し、Iter5 の SkinnedMesh / AnimationMixer / SkeletonUtils.clone 固有の項目を追加する。

#### 継承項目（v3 NFR-05 由来）

- エンティティ破棄時に Geometry / Material / Texture の `dispose()` を必須とする
- CleanupSystem でエンティティ削除時に関連する全 Three.js リソースの dispose() を実行
- メモリ使用量目標: ゲームプレイ中の JS ヒープ使用量 **200MB 以下**
- 長時間プレイ（30分間）でのメモリ増加率: **10% 以内**
- WebGLコンテキストロスト時の復帰処理:
  - `webglcontextlost` イベントを検知し、ゲームを一時停止
  - `webglcontextrestored` イベントで自動復帰（シーン・マテリアル・テクスチャの再構築）
  - 復帰不可時はユーザーにリロード促進メッセージを表示
- モバイル GPU メモリ制限を考慮し、テクスチャ解像度・パーティクル数を Low 品質で制限

#### Iter5 固有の追加項目

- **AnimationMixer の解放**: entity 削除時に `mixer.stopAllAction()` を呼び、参照を null 化
- **AnimationAction の解放**: 使用中の clip について `mixer.uncacheAction(clip)` を呼び、mixer 内部キャッシュを解放
- **SkinnedMesh の skeleton/bones の dispose**: clone で生成された bones は個別 dispose 不要だが、親 root object を `scene.remove()` 後、`mixer.uncacheRoot(root)` で root 参照をクリア
- **SkeletonUtils.clone 結果の dispose 責任**: clone で新規生成された material / geometry / mixer / AnimationAction は **CleanupSystem が entity 削除時に責任をもって dispose** する（詳細は FR-03 の責任分界表を参照）
- **反転ハル用メッシュ**: 本体 SkinnedMesh と同じ skeleton を共有するが、geometry と material は clone 独自インスタンスのため、同様に dispose 対象

### NFR-08: CSP整合（S-NG-1対応）

- Iter3 NFR-06 のXSS/CSP方針を継承（`innerHTML` 禁止、`textContent` / DOM API 構築）
- Iter5 の追加 CSP 設定:
  - `default-src 'self'`
  - `img-src 'self' data: blob:`（glTF の dataURI / Blob 利用のため）
  - `connect-src 'self'`（GLTFLoader fetch）
  - `worker-src 'self' blob:`
- LoaderScreen の DOM 構築は `textContent` と DOM API のみ（`innerHTML` 使用禁止）

### NFR-09: アセット配信キャッシュ・バージョニング（I-NG-4 / O-NG-7対応）

- `public/models/` 配下は**バージョン付きパス**を採用
  - 現状: `public/models/toon-shooter/v1/...`
  - 将来パック更新時は `v2/` で並置し、コード側参照パスを切り替えることでキャッシュ bust
- HTTPキャッシュヘッダ: `Cache-Control: public, max-age=31536000, immutable` を設定
  - GitHub Pages / Netlify はデフォルトで適切な値を返すため確認のみ
  - CloudFront 等の場合は Cache Policy で明示設定
- デプロイ検証: CI で `/models/toon-shooter/v1/Character_Soldier.gltf` への HEAD リクエストで 200 応答を確認
- アセット整合性（S-NG-2対応）: `public/models/toon-shooter/CHECKSUMS.txt` に SHA-256 を記録、CI検証は将来対応。本Iter時点ではコミット済みファイルを Git で固定管理することで整合性を確保

## スコープ確定事項

| 項目 | 決定 |
|---|---|
| GLTFへの置換範囲 | キャラ3役割（Player/Ally/Enemy/Boss）+ 武器 + 環境一部 |
| 敵バリエーション | 単一モデル + scale/tint（Enemyモデル共有） |
| Ally の見た目 | Character_Enemy + 青tint（変換モチーフと整合） |
| Outline実装 | 反転ハル法を維持（SkinnedMesh対応のみ追加）、事前スパイクで成立確認 |
| ローダー画面 | 新設（シンプル、textContent構築） |
| 既存ProceduralMeshFactory | **全削除**（GLTF一本化） |
| 武器切替システム | 対象外（将来拡張） |
| ゲームロジック/UI/音/スポーン | 変更なし |
| Bloom / PostFX | Iter4のまま継承 |
| 進捗バー精度 | ファイル数ベースMVP、±8%許容、バイト重み付けは将来対応 |
| アニメ間引き | 本Iterでは未採用、Iter6判断 |
| 銃口位置 | 武器ごとの定数 offset を使用（MVP）、Muzzle ノード利用は将来拡張 |
| ゲーム内クレジット画面 | 本Iter対象外、Iter6対応 |
| 外部/ユーザー GLTF ロード | 禁止、同梱のみ |

## アーキテクチャ変更サマリ

```
[新規]
  AssetManager（GLTFプリロード、clone元テンプレート保持）
  AnimationSystem（ECS System、mixer更新 + state machine）
  AnimationStateComponent（hitReactTimer / deathFlag / currentClip）
  LoaderScreen（UI、進捗バー）

[拡張]
  MeshComponent: mixer? / animations?: Map を追加（optional、環境メッシュはnull）
  EntityFactory: GLTF clone + bone attach + tint + DI された AssetManager

[削除]
  ProceduralMeshFactory（キャラ・武器生成ロジック全廃）

[軽微改修]
  SceneManager: 環境配置を GLTF に差し替え
  RenderSystem: SkinnedMesh描画対応（基本Three.jsが自動処理、確認のみ）
  CleanupSystem: SkinnedMesh / mixer / action の dispose 責任（NFR-07参照）
  CombatSystem: HitReactTimer 書き込み
  HealthSystem: deathFlag 書き込み
```

## 起動シーケンス（B-NG-2対応）

ゲーム起動から初回プレイ画面表示までの時系列を以下に固定する:

```
1. main.ts エントリポイント実行
2. AssetManager インスタンス生成
3. LoaderScreen 表示（DOM構築、textContent のみ使用）
4. AssetManager.load() を呼び Promise を取得（Promise.all で全ファイル並列取得）
5. await AssetManager.load()
   - 進捗更新を LoaderScreen に通知（ロード済/総数）
   - タイムアウト監視（各30秒、全体60秒）
6. ロード成功:
   a. LoaderScreen 破棄（DOM から remove）
   b. GameStartScreen 表示
7. ユーザーが Start ボタン押下:
   a. World / Systems / EntityFactory を生成
   b. EntityFactory は constructor で **ロード済み AssetManager を DI** される（未ロード状態での生成を禁止）
   c. 初期 entity（プレイヤー等）を EntityFactory で生成
   d. GameLoop 開始（Game 本編）
8. ロード失敗:
   a. LoaderScreen をエラー状態へ切替、再試行ボタン表示（最大3回）
```

- **EntityFactory の DI 制約**: AssetManager が完全ロード済み（全テンプレート取得完了）でなければ EntityFactory を生成しない
- GameStartScreen の Idle プレビュー: 専用 mini-renderer で独自駆動、または World を生成せず mixer のみ update（本番 World とは独立）

## 既存コード影響マップ（B-NG-6対応）

### ProceduralMeshFactory 削除に伴う呼び出し元

| 呼び出し元 | 現状 | 変更内容 |
|---|---|---|
| SceneManager（環境生成） | ProceduralMeshFactory で道路/フェンス/砂漠を生成 | FR-07 GLTF 配置に置換、道路/地面タイルのみプロシージャル継続 |
| EntityFactory（Player/Ally/Enemy/Boss） | ProceduralMeshFactory でBox/Sphere/Cylinder組立 | FR-03 GLTF SkeletonUtils.clone に置換 |
| その他 | grep 調査で該当なし確認（Construction前に最終確認） | — |

### テスト影響（Q-NG-1対応）

- **削除対象**: `ProceduralMeshFactory.test.ts` 系（該当件数は実装時確定、既存86件の一部）
- **追加対象**:
  - `AssetManager.test.ts`（ロード成功 / 失敗 / タイムアウト / mock GLTFLoader 使用）
  - `AnimationSystem.test.ts`（state machine の遷移ルール、crossFade、Death完了検知）
  - `AnimationStateComponent.test.ts`（初期値、書き込み・リセット）
  - `EntityFactory.gltf.test.ts`（clone独立性: material/skeleton の `!==` assertion）
  - malformed GLTF のエラー負のケーステスト
- **最終目標**: 既存86件 − 削除N件 + 追加N件 ≒ 同等以上のカバレッジ維持

## リスクと対策

| リスク | 対策 |
|---|---|
| アニメ切替がガチャつく（state machineのバグ） | 0.1秒 crossFade + 明確な優先順位（Death > HitReact > 移動×射撃）+ HitReact 終了時は velocity 再判定 |
| SkinnedMesh cloneのバグ（skeleton共有してしまう） | SkeletonUtils.clone 公式推奨、テストで独立性検証（material / skeleton の `!==` assertion） |
| 反転ハルがSkinnedMeshで追随しない | 事前スパイクで検証（FR-06 参照）。ダメならOutline OFFで本Iterリリース、Iter6でOutlinePass検討 |
| bone名がモデルで異なる | Construction着手前に3モデル全てを調査し、BoneAttachmentConfig で吸収（FR-05） |
| ロード失敗時の表示 | FR-01 のエラー画面＋タイムアウト＋ユーザー操作再試行で対応 |
| パフォーマンス低下 | Low品質でアニメ・Outline OFF。51キャラで45fps割ったら Iter6 で LOD / instanced検討 |
| アセットロード中の長時間フリーズ | 全体60秒タイムアウトで強制エラー遷移（FR-01） |
| 長時間プレイでのメモリリーク | NFR-07 の dispose 責任分界 + 5分後heap差分ログ（NFR-05） |
