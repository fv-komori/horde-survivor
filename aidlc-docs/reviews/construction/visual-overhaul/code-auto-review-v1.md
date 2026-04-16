# コード自動レビュー結果（v1）

**レビュー対象**: src/配下 新規・変更ファイル（Three.jsビジュアルリニューアル）
**レビュー日**: 2026-04-16
**レビュー方式**: 2つの専門家ロールによる自動レビュー（独立エージェント並列実行）
**イテレーション**: 1 / 3（1回でPASS）
**前回レビューからの変更点**: 初回レビュー

---

## 1. フロントエンド開発者（TypeScript / Three.js / ECS）

### レビュー観点
- TypeScript型安全性（any回避、適切な型定義、型ガード）
- Three.js使用パターン（リソース管理、dispose、メモリリーク防止）
- ECSアーキテクチャ準拠（Component/System分離、World操作の正しさ）
- コード構造・パターン（単一責務、DI、モジュール分離）
- パフォーマンス（GC負荷、オブジェクト再利用、不要なアロケーション）
- エラーハンドリング（null安全性、境界チェック）

### OK項目

| # | 対象ファイル:行 | OK理由 |
|---|----------------|--------|
| F-OK-1 | CoordinateMapper.ts:17 | 再利用用の`_tempVec`をstatic readonlyでキャッシュし、毎フレームのVector3アロケーションを回避。GC負荷軽減 |
| F-OK-2 | InstancedMeshPool.ts:19-22 | `_tempMatrix`, `_tempColor`, `_tempPos`をインスタンスレベルで再利用。Three.js行列演算の最適化 |
| F-OK-3 | ProceduralMeshFactory.ts:17-41 | マテリアルキャッシュ+ジオメトリキャッシュの2層キャッシュ戦略。BR-M04準拠 |
| F-OK-4 | MeshComponent.ts:7-38 | object3D/instancePool/instanceIdの切り替えでInstancedMeshと個別Meshの両方に対応。domain-entities準拠 |
| F-OK-5 | ThreeJSRenderSystem.ts:54-57 | WebGLコンテキストロスト/復帰のイベントハンドラ登録。BL-07仕様準拠 |
| F-OK-6 | HTMLOverlayManager.ts:37,86-135 | innerHTML使用禁止(NFR-06)を遵守、全DOM操作をcreateElement+textContent+appendChild |
| F-OK-7 | QualityManager.ts:36-77 | FPS計測→品質切替にクールダウン(5秒)+持続判定を実装。BR-Q01準拠 |
| F-OK-8 | World.ts:94-108 | onDestroyコールバックをエンティティ削除前に呼び出し、dispose確実実行を保証 |
| F-OK-9 | EffectManager3D.ts:181-192 | disposeEffectで一時生成エフェクトのgeometry/materialを適切にdispose |
| F-OK-10 | SettingsManager.ts:44-61 | localStorage復元時の型チェック+範囲バリデーション+NaN/Infinity防御が堅牢 |
| F-OK-11 | gameConfig.ts:4-12 | deepFreezeによる設定値の不変化 |

### NG項目

| # | 対象ファイル:行 | NG理由 | 提案 |
|---|----------------|--------|------|
| F-NG-1 | EffectManager3D.ts:56-58 | **エフェクトジオメトリ・マテリアルの毎回new生成**: 高頻度生成でGC圧力増大 | **提案**: クラスレベルでキャッシュし再利用 |
| F-NG-2 | EntityFactory.ts:109-125 | **enemyNormalPoolが未使用**: GameServiceで生成・シーン追加されるが実際に使われない | **提案**: enemyNormalPoolの生成コードを削除、BL-05テーブル更新 |
| F-NG-3 | HTMLOverlayManager.ts:273 | **毎フレームVector3.clone()でアロケーション**: 敵300体×毎フレームで大量一時オブジェクト | **提案**: clone()→copy()パターンで再利用用Vector3を使用 |
| F-NG-4 | SceneManager.ts:186-201 | **clearScene()のtraverseとremoveの非効率**: 孫まで含めてtoRemoveに入るが冗長 | **提案**: `this.scene.clear()`を使用 |
| F-NG-5 | GameService.ts:257-266 | **WebGL2チェック用canvasの未解放**: テスト用WebGLコンテキストがGC依存 | **提案**: `gl.getExtension('WEBGL_lose_context')?.loseContext()`で明示解放 |
| F-NG-6 | ThreeJSRenderSystem.ts:110-116 | **リサイズイベントのデバウンス未実装**: 高頻度発火でパフォーマンス問題の可能性 | **提案**: 100-200msのdebounceを適用 |
| F-NG-7 | GameService.ts:288-341 | **resetGame()のリソース管理フローが複雑**: meshFactoryの参照関係が追跡困難 | **提案**: disposeフローをコメントで明確化 |
| F-NG-8 | ProceduralMeshFactory.ts:76 | **WeaponType型の不正なasキャスト**: 'FORWARD' as WeaponTypeでenum値を文字列キャスト | **提案**: WeaponType.FORWARDを直接使用 |
| F-NG-9 | World.ts:127-137 | **clear()がonDestroyCallbacksをクリアしない**: リセット毎にコールバック二重登録 | **提案**: clear()末尾にonDestroyCallbacks.length = 0を追加 |
| F-NG-10 | InstancedMeshPool.ts:53-56 | **InstancedMesh.countが単調増加**: release時にcountを減らしていないため非効率 | **提案**: countを再計算するかコメントで意図を明記 |

### スコア評価

| 観点 | スコア (1-10) | 根拠 |
|------|-------------|------|
| 正確性 | 7 | F-NG-8(asキャスト), F-NG-9(コールバック二重登録), F-NG-10(count不正確)あるが致命的でない |
| 設計品質 | 7 | ECS準拠(F-OK-4,8)、DI、キャッシュ(F-OK-3)が良好。F-NG-7,9に改善余地 |
| セキュリティ | 8 | innerHTML禁止遵守(F-OK-6)、localStorage検証(F-OK-10)。medium以上のNGなし |
| 保守性 | 7 | 一貫した最適化パターン(F-OK-1,2)。F-NG-8型安全性、F-NG-7複雑さに改善余地 |

---

## 2. セキュリティエンジニア

### レビュー観点
- XSS防止（innerHTML使用有無、DOM操作の安全性）
- CSP互換性（unsafe-eval/unsafe-inline の必要性チェック）
- 入力バリデーション（ユーザー入力のサニタイズ）
- 機密情報漏洩（ハードコードされたシークレット、エラーメッセージの情報漏洩）
- DOM操作の安全性（textContent使用、動的HTML生成の安全性）
- localStorage使用の安全性

### OK項目

| # | 対象ファイル:行 | OK理由 |
|---|----------------|--------|
| S-OK-1 | HTMLOverlayManager.ts:全体 | innerHTML完全不使用、全DOM構築がcreateElement+textContent+DOM API。NFR-06/BR-UI01準拠 |
| S-OK-2 | SettingsManager.ts:39-63 | localStorage復元時の堅牢なバリデーション（型チェック/NaN防御/範囲クランプ/有効値セット） |
| S-OK-3 | SettingsManager.ts:175-177 | clamp関数のNumber.isFiniteチェックによるNaN/Infinity防御 |
| S-OK-4 | InputHandler.ts:182-187 | 入力バリデーション(BR-V01)、moveDirectionの三値化正規化 |
| S-OK-5 | GameService.ts:560-567 | エラー画面の情報漏洩防止（debugEnabled分岐、本番は固定メッセージ） |
| S-OK-6 | GameService.ts:124-129 | debugEnabledのDEV環境ガード。本番でdebug=1パラメータ無効 |
| S-OK-7 | index.html:6 | CSP設定(script-src 'self', object-src 'none', base-uri 'self', form-action 'none') |
| S-OK-8 | gameConfig.ts:4-12 | deepFreezeによる設定値の不変性（ランタイム改竄防止） |
| S-OK-9 | HTMLOverlayManager.ts:287 | HP/ダメージ表示のCSS transform使用、HTMLインジェクション余地なし |
| S-OK-10 | ThreeJSRenderSystem.ts:126-139 | WebGLコンテキストロスト対応のtry-catch実装 |

### NG項目

| # | 対象ファイル:行 | NG理由 | 提案 |
|---|----------------|--------|------|
| S-NG-1 | index.html:6,9-24 | **CSPのstyle-src 'unsafe-inline'とインラインstyleタグの併存**: NFR-06では外部ファイル化が原則 | **提案**: インラインstyleをoverlay.cssに移動し、CSPからunsafe-inlineを除去 |
| S-NG-2 | GameService.ts:542 | **window.onerrorの上書きによる既存ハンドラー消失**: 将来のモニタリングツール導入時にエラー報告が失われるリスク | **提案**: addEventListener('error', handler)方式に変更 |
| S-NG-3 | GameService.ts:555 | **String(event.reason)による潜在的情報漏洩**: error.messageにURL/ファイルパスが含まれる可能性 | **提案**: event.reason instanceof Error判定し、非Error型は固定メッセージ使用 |
| S-NG-4 | ThreeJSRenderSystem.ts:52 | **resizeイベントリスナーのAbortController未使用**: InputHandlerと一貫性なし、異常パスでリーク | **提案**: AbortControllerパターンを採用 |

### スコア評価

| 観点 | スコア (1-10) | 根拠 |
|------|-------------|------|
| 正確性 | 8 | NFR-06準拠(S-OK-1)、バリデーション(S-OK-2,3,4)、エラーハンドリング(S-OK-5,6)が正確 |
| 設計品質 | 8 | GAME_CONFIG不変性(S-OK-8)、DOM操作プール設計(S-OK-9)、コンテキストロスト対応(S-OK-10) |
| セキュリティ | 8 | innerHTML完全不使用(S-OK-1)、CSP設定(S-OK-7)、情報漏洩防止(S-OK-5,6)。致命的脆弱性なし |
| 保守性 | 8 | NFR-06/BR参照コメント充実。S-NG-2のonerror方式は将来の統合時に修正必要の可能性 |

---

## レビュー結果サマリー

### 集計

| ロール | OK | NG | 前回比OK | 前回比NG |
|--------|----|----|---------|---------|
| フロントエンド開発者 | 11 | 10 | 初回 | 初回 |
| セキュリティエンジニア | 10 | 4 | 初回 | 初回 |
| **合計** | **21** | **14** | 初回 | 初回 |

### 重大度別集計

| 重大度 | 件数 | 該当項目 |
|--------|------|----------|
| **重大** | 0 | なし |
| **重要** | 2 | F-NG-8（WeaponType asキャスト）、F-NG-9（コールバック二重登録） |
| **中** | 5 | F-NG-1, F-NG-2, F-NG-3, F-NG-10, S-NG-1 |
| **軽微** | 7 | F-NG-4, F-NG-5, F-NG-6, F-NG-7, S-NG-2, S-NG-3, S-NG-4 |

### 重大・重要項目の対応推奨

| 優先度 | NG項目 | 内容 | 推奨対応タイミング |
|--------|--------|------|-------------------|
| 1 | F-NG-9 | World.clear()でonDestroyCallbacksが累積。リセット繰り返しで二重実行 | マージ前 |
| 2 | F-NG-8 | ProceduralMeshFactory内でWeaponTypeのasキャスト。型安全性低下 | マージ前 |

---

## スコアマトリクス

| ロール | 正確性 | 設計品質 | セキュリティ | 保守性 | 平均 |
|--------|--------|---------|------------|--------|------|
| フロントエンド開発者 | 7/10 | 7/10 | 8/10 | 7/10 | 7.25 |
| セキュリティエンジニア | 8/10 | 8/10 | 8/10 | 8/10 | 8.00 |
| **全体平均** | **7.50** | **7.50** | **8.00** | **7.50** | **7.63** |

### 閾値判定
- 閾値: 全軸 ≥ 7/10
- 未達項目: なし
- 判定: **PASS**
