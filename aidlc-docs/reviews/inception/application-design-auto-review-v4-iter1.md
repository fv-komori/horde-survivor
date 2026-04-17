# アプリケーション設計自動レビュー結果（v4 - iter1）

**レビュー対象**: aidlc-docs/inception/application-design/components-v4.md
**レビュー日**: 2026-04-17
**レビュー方式**: 4ロール並列自動レビュー（architect, frontend, security, ops）
**スキップ**: backend（Python/Lambda非該当）, infra（CDK/AWS非該当、静的ホスティング変更なし）

---

## 判定: FAIL（改善余地あり → イテレーション2へ）

## スコアマトリクス（イテレーション1）

| ロール | 正確性 | 設計品質 | セキュリティ | 保守性 | 平均 |
|--------|--------|---------|------------|--------|------|
| アーキテクト | 7/10 | 7/10 | 7/10 | **6/10** | 6.75 |
| FE | 7/10 | 7/10 | 8/10 | 7/10 | 7.25 |
| セキュリティ | 7/10 | 7/10 | 7/10 | 7/10 | 7.0 |
| 運用 | 7/10 | **6/10** | 8/10 | 7/10 | 7.0 |
| **全体平均** | **7.0** | **6.75** | **7.5** | **6.75** | **7.0** |

### 閾値判定
- 閾値: 全軸 ≥ 7/10
- 未達項目:
  - アーキテクト: 保守性 6/10
  - 運用: 設計品質 6/10
- 判定: **FAIL**

---

## 1. ソフトウェアアーキテクト

### OK項目（9件）
A-OK-1〜9: 設計方針・アーキ図・Factory・PostFXManager・QualityManager・データフロー・リスク表・ファイル変更サマリ・GameConfig各所評価

### NG項目（9件）
| # | 対象設計 | 概要 | severity |
|---|---------|------|----------|
| A-NG-1 | C-03 render責務の2箇所分散（PostFX内 vs ThreeJSRenderSystem分岐） | important |
| A-NG-2 | Outlineマテリアルdispose責任者・Groupライフサイクル未定義 | important |
| A-NG-3 | Outline切替責任コンポーネント・setOutlineEnabledメソッド未定義 | important |
| A-NG-4 | PostFXManagerの生成順序・参照フロー未明記 | medium |
| A-NG-5 | Hemi OFF時のDirectionalLight補正不在 | medium |
| A-NG-6 | 空ドーム(r=50)とFog far=45の距離逆転リスク | medium |
| A-NG-7 | PostFXManager単体テスト不要判断の根拠薄 | medium |
| A-NG-8 | InstancedMesh/コンテキストロスト前回指摘継続 | medium |
| A-NG-9 | GLTF差し替え時のOutline適用経路未定義 | minor |

### スコア評価
| 観点 | スコア | 根拠 |
|------|-------|------|
| 正確性 | 7 | OK多数だが A-NG-1/5/6 で細部整合欠落 |
| 設計品質 | 7 | 責務分散 A-NG-1, 切替粒度 A-NG-3 |
| セキュリティ | 7 | コンテキストロスト継続 A-NG-8 |
| 保守性 | 6 | A-NG-2/3/7/9 が保守性軸に集中（important 2+medium 2+minor 1） |

---

## 2. フロントエンド開発者

### OK項目（8件）
F-OK-1〜8: PostFX分離・QualityManager拡張・Outlineマテリアル共有・Tonemapping・データフロー・config・resize連動・リスク識別

### NG項目（8件）
| # | 対象設計 | 概要 | severity |
|---|---------|------|----------|
| F-NG-1 | PostFXManager dispose/RenderTargetライフサイクル未定義 | important |
| F-NG-2 | Outline対象とInstancedMesh整合不明 | important |
| F-NG-3 | グラデ空ShaderMaterial仕様・scene.backgroundとの関係不明 | medium |
| F-NG-4 | 動的import方針「候補」止まり | medium |
| F-NG-5 | SmokePuffビルボード向き制御・キャッシュ戦略不整合 | medium |
| F-NG-6 | FPS閾値・Outline切替コスト未定義（前回継続） | important |
| F-NG-7 | Outline厚みscale方式の階層干渉リスク | medium |
| F-NG-8 | ACES Tonemappingとpalette色変化の検証不足 | minor |

### スコア評価
| 観点 | スコア | 根拠 |
|------|-------|------|
| 正確性 | 7 | FR-01〜07と対応だが F-NG-2/3 で細部整合弱 |
| 設計品質 | 7 | important 2件（F-NG-1/6）あり上限7 |
| セキュリティ | 8 | 外部アセット無し・CSP非抵触継続 |
| 保守性 | 7 | F-NG-4/5/2 で将来変更時のハマりどころ残存 |

---

## 5. セキュリティエンジニア

### OK項目（9件）
S-OK-1〜9: 外部アセット無・Quality切替・既存render保持・dispose/resize契約・Outline軽量化・Bloom上限・ShaderMaterial非eval・新規DOM無し・攻撃面限定

### NG項目（6件）
| # | 対象設計 | 概要 | severity |
|---|---------|------|----------|
| S-NG-1 | WebGLコンテキストロスト復帰時のEffectComposer再構築未定義 | important |
| S-NG-2 | CSP適合性の結論がv4再掲されていない | important |
| S-NG-3 | Outline適用範囲・ドローコール上限の定量制御不在 | important |
| S-NG-4 | 動的import採用条件・サプライチェーン方針明文化不足 | medium |
| S-NG-5 | Bloom用RenderTargetのdpr/max制御未定義 | medium |
| S-NG-6 | ShaderMaterial GLSL動的結合禁止の明記不足 | minor |

### スコア評価
| 観点 | スコア | 根拠 |
|------|-------|------|
| 正確性 | 7 | S-NG-1/2/3 でv4単体の自己完結性欠落 |
| 設計品質 | 7 | context復帰フック欠如（S-NG-1） |
| セキュリティ | 7 | important 3件上限の7点評価 |
| 保守性 | 7 | 後続実装者への指針不足（S-NG-1/3/5） |

---

## 6. 運用エンジニア

### OK項目（7件）
O-OK-1〜7: PostFX分岐・Quality切替集中・config化・動的import認識・resize連動・リスク表・Outline共有マテリアル

### NG項目（7件）
| # | 対象設計 | 概要 | severity |
|---|---------|------|----------|
| O-NG-1 | outlineEnabledの切替フック未設計 | important |
| O-NG-2 | PostFX初期化失敗時のフォールバック/ロギング未定義 | important |
| O-NG-3 | WebGLコンテキストロスト復帰時のPostFX/Scene再構築手順未記載（前回O-NG継続） | important |
| O-NG-4 | Bloom有効時のfps/ドローコール計測手段未設計 | medium |
| O-NG-5 | 動的import方針結論先送り | medium |
| O-NG-6 | setFog/HemiEnabledのneedsUpdate回避実装詳細未規定 | medium |
| O-NG-7 | postProcessEnabled LocalStorageマイグレーション未定義 | minor |

### スコア評価
| 観点 | スコア | 根拠 |
|------|-------|------|
| 正確性 | 7 | O-NG-4（NFR-01定量監視）・O-NG-1で対応欠落 |
| 設計品質 | 6 | O-NG-2/3（障害フォールバック・復帰）important 2件+medium 3件 |
| セキュリティ | 8 | 運用視点で新規脅威なし |
| 保守性 | 7 | config化・切替集中は良好、mediumで減点 |

---

## 横断指摘テーマ（優先度順）

1. **PostFXManagerのコンテキストロスト復帰/dispose/初期化失敗フォールバック** — 4ロール中3ロール指摘（A-NG-8, F-NG-1, S-NG-1, O-NG-2, O-NG-3）
2. **Outline切替メカニズム・responsibility** — 3ロール指摘（A-NG-3, F-NG-6, O-NG-1）
3. **Outline適用範囲・ドローコール定量化・InstancedMesh整合** — 3ロール指摘（A-NG-8, F-NG-2, S-NG-3）
4. **CSP結論・動的import結論のv4内明記** — 2ロール指摘（S-NG-2/4, F-NG-4, O-NG-5）
5. **Fog/Sky距離整合 + setFog/Hemi切替実装詳細** — 2ロール指摘（A-NG-6, F-NG-3, O-NG-6）
6. **render()責務の単一化** — 1ロール指摘（A-NG-1）
7. **PostFXManager単体テスト追加** — 1ロール指摘（A-NG-7）

次イテレーションで上記テーマを設計書v4に追記/修正する。
