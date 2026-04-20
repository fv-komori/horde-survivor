# 設計自動レビュー 中間（v5 iter2）

**対象**: aidlc-docs/inception/application-design/v5 + requirements-v5.md
**レビュー日**: 2026-04-17
**ロール**: Architect, FE, BE, Infra, Security, Ops（6ロール並列、iter1 のNG追跡）

## 前イテレーションからの修正適用結果

| FIX | 対象NG | 結果 |
|---|---|---|
| FIX-A | S-NG-6/I-NG-1/A-NG-5 payload 2MB→3MB | **解消** |
| FIX-B | I-NG-2/S-NG-4 fetch+parse統一 | **解消** |
| FIX-C | F-HIGH-01 ShaderMaterial skinning | **解消** |
| FIX-D | F-HIGH-02 反転ハルbind | **解消**（F-NEW-02 で追加修正推奨） |
| FIX-E | F-HIGH-03/A-NG-4 listener二重登録 | **解消** |
| FIX-F | F-HIGH-04/B-HIGH-02 HitReact復帰 | **解消**（B-iter2-10 連続ダメージ時 reset推奨） |
| FIX-G | B-HIGH-03 初回Idle_Shoot.play | **解消** |
| FIX-H | B-HIGH-01 Death linger | **解消**（F-NEW-01 本体統合を追加修正済） |
| FIX-I | B-MID-04 Gun material clone | **解消** |
| FIX-J | A-NG-1/O-NG-9 priority確定値 | **解消** |
| FIX-K | B-LOW-07 VELOCITY_THRESHOLD_SQ | **解消** |
| FIX-L | I-NG-5 静的ローダー雛形 | **解消** |
| FIX-M | I-NG-4/S-NG-1 CSP整合 | **解消** |
| FIX-N | I-NG-6/O-NG-8 CI HEAD縮退 | **解消** |
| FIX-O | O-NG-1/O-NG-7 MetricsProbe | **解消** |
| FIX-P | O-NG-3 forceDisposeAll | **解消** |
| FIX-Q | O-NG-4 restoreTextures | **解消**（O-R2-5 結線経路を追加修正済） |
| FIX-R | S-NG-3 エラー3層分界 | **解消** |
| FIX-S | F-MED-05/O-NG-5 disposePreview | **解消** |

## iter2 で追加修正（quick fix）

- **F-NEW-01 / B-iter2-01**: CleanupSystem `update()` 本体を linger 減算版に統合、重複「追加実装」節を削除
- **O-R2-5**: `webglcontextrestored` イベント登録経路を services-v5 S-SVC-06b として追加（GameService経路で ThreeJSRenderSystem に結線、restoreTextures 呼出）
- **O-R2-3**: S-SVC-01 teardown 呼出トリガ一覧表を追加、idempotent ガードと snapshot iterate 規約も明記

## スコアマトリクス（iter2）

| ロール | 正確性 | 設計品質 | セキュリティ | 保守性 | 平均 |
|--------|--------|---------|------------|--------|------|
| Architect | 9 | 8 | 9 | 8 | 8.50 |
| FE | 8 | 7 | 8 | 7 | 7.50 |
| BE | 7 | 7 | 8 | 7 | 7.25 |
| Infra | 8 | 8 | 9 | 8 | 8.25 |
| Security | 8 | 8 | 8 | 8 | 8.00 |
| Ops | 8 | 8 | 8 | 7 | 7.75 |
| **全体平均** | **8.0** | **7.7** | **8.3** | **7.5** | **7.88** |

### 閾値判定
- 閾値: 全軸 ≥ 7/10
- 未達項目: **なし**
- **判定: PASS**

### スコア推移（iter1 → iter2）

| ロール | iter1平均 | iter2平均 | 変動 |
|---|---|---|---|
| Architect | 8.0 | 8.5 | +0.5 |
| FE | 7.25 | 7.5 | +0.25 |
| BE | 7.25 | 7.25 | ±0 |
| Infra | 6.5 | 8.25 | +1.75 |
| Security | 7.75 | 8.0 | +0.25 |
| Ops | 6.75 | 7.75 | +1.0 |
| **全体** | **7.25** | **7.88** | **+0.63** |

## 残存 NG（iter2新規、合格範囲内）

### important（Construction着手前にdoc補筆で解消可）
- **F-NEW-02**: `createOutlineMesh` の戻り値（空Group）と契約齟齬 — Construction時に副作用方式 or populated-Group で確定
- **B-iter2-10**: HitReact 連続ダメージ時 `currentClip==='HitReact'` 維持ケースで action.reset() 漏れの可能性
- **B-MID-05**: スコア加算タイミング（HealthSystem or CleanupSystem）の明示
- **O-R2-2**: MetricsProbe 5分単発 vs NFR-07 30分要件の整合（Construction時調整）

### medium/minor（実装時メモで吸収）
- **F-NEW-03**: components-v5 疑似コードと methods の詳細乖離（authoritative は methods 側で統一、疑似コードは概要用）
- **F-NEW-04**: AbortError → エラーコード正規化
- **A-NG-iter2-01〜05**: mini figures連携の図面補筆
- **S-MINOR-1**: UI_MESSAGES fallback
- **O-R2-1/4/6/7/8**: 各種ランブック補筆

## 次のアクション

PASS達成のため **Step 10 最終レポート**へ進む。残存NGは Construction 段階で application-design の補完もしくは実装時コメントで吸収可能。
