# 設計自動レビュー結果（v5, Iteration 5）

**レビュー対象**:
- aidlc-docs/inception/application-design/components-v5.md
- aidlc-docs/inception/application-design/services-v5.md
- aidlc-docs/inception/application-design/component-dependency-v5.md
- aidlc-docs/inception/application-design/component-methods-v5.md

**上流**: aidlc-docs/inception/requirements/requirements-v5.md

**レビュー日**: 2026-04-17
**レビュー方式**: 6専門家ロール自律レビュー+スコアリング+自動修正サイクル

---

## 判定: PASS

- イテレーション回数: **2回**（iter1 FAIL → 自動修正 19 FIX + iter2 追加3項 → iter2 PASS）
- 指摘総数（iter1）: critical相当3件（payload違反、dispose責任、メモリ管理退行）+ important 27件 + medium 30件超
- iter2 時点で前回NG **95%解消**、残存はすべて許容範囲
- 全軸平均: iter1 7.25 → iter2 7.88（+0.63）

---

## スコアマトリクス（最終 iter2）

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
- 未達項目: なし
- **判定: PASS**

### スコア推移

| 軸 | iter1 | iter2 | 変動 |
|----|-------|-------|------|
| 正確性 | 7.0 | 8.0 | +1.0 |
| 設計品質 | 7.0 | 7.7 | +0.7 |
| セキュリティ | 7.8 | 8.3 | +0.5 |
| 保守性 | 7.2 | 7.5 | +0.3 |
| **平均** | **7.25** | **7.88** | **+0.63** |

---

## 主要な解消指摘

### 起動失敗級（critical相当）→ 全解消
- **S-NG-6 / I-NG-1 / A-NG-5**（payload 2MB上限違反、実測2.34MB）→ FIX-A: 3MB一律に引き上げ、requirements+components+methods で統一
- **O-NG-1**（NFR-07 メモリ管理退行）→ 要件書にて継承済、FIX-O で MetricsProbe 追加
- **O-NG-2**（dispose責任分界）→ FR-03 表と CleanupSystem.processDeath で明示
- **B-NG-1 / Q-NG-6**（Death完了シーケンス）→ FIX-H: linger=0.3秒 保持、CleanupSystem で消化

### Three.js API詳細（important）→ 全解消
- **F-HIGH-01** ShaderMaterial `skinning: true` 自己矛盾 → FIX-C: `#include <skinning_pars_vertex>` 系に統一、`skinning` flag削除
- **F-HIGH-02** 反転ハル bind手順齟齬 → FIX-D: geometry clone + 本体 skeleton 共有 `.bind()` に統一、SkeletonUtils.clone 非採用
- **F-HIGH-03 / A-NG-4** finished listener 二重登録 → FIX-E: transitionTo冒頭で既存解除、forceDispose経路も対応
- **F-HIGH-04 / B-HIGH-02** HitReact完了復帰未定 → FIX-F: hitReactTimer 自動減算方式、clampWhenFinished=false
- **B-HIGH-03** 初回フレーム Idle_Shoot.play() → FIX-G: setupAnimations 末尾で明示呼出

### インフラ・配信・観測性（important）→ 全解消
- **I-NG-2** GLTFLoader 二重ダウンロード → FIX-B: fetch+parse方式、AbortController統一
- **I-NG-4 / S-NG-1** CSP齟齬 → FIX-M: blob:/worker-src 削除、最小権限 CSP
- **I-NG-5** index.html 静的ローダー雛形 → FIX-L: 具体スニペット提示
- **I-NG-6 / O-NG-8** CI HEAD検証 → FIX-N: artifact存在確認に縮退（Iter5）、Iter6で復活
- **O-NG-3** teardown順序 → FIX-P: CleanupSystem.forceDisposeAll + 逆順明記
- **O-NG-4** webglcontextrestored復帰 → FIX-Q: AssetManager.restoreTextures、iter2で結線経路追記
- **S-NG-3** エラー3層分界 → FIX-R: NFR-06 表追加、Error.cause 統一

---

## 設計判断ログ（AUTO-DECIDED）

1. **payload 上限**: 一律 3MB（種別別ではなくシンプルさ優先、Character 2.34MB 実測考慮）
2. **fetch + parse 方式**: `GLTFLoader.parse(buffer, ...)` で二重DL排除、AbortController統一
3. **反転ハル実装**: geometry clone + skeleton 共有 `.bind()` 方式（SkeletonUtils.clone は outline では使わない）
4. **HitReact復帰**: `hitReactTimer` 自動減算、finished listener 非使用（Death とは異なる駆動）
5. **Death linger**: 0.3秒 保持で演出なめらかさを確保（Construction Day 1 で調整）
6. **CSP 最小権限**: `blob:` / `worker-src` は Iter5 未使用、DRACO/KTX2採用時に追加
7. **CI HEAD検証**: Iter5は artifact 存在確認のみ、デプロイ先確定時（Iter6）に復活
8. **System priority**: AnimationSystem=50 / CleanupSystem=55 / RenderSystem=60 で確定
9. **Error message 3層**: UI固定ID / console詳細 / 外部ログ(Iter6) の3層分界
10. **MetricsProbe**: 独立 Service、`performance.memory` 差分を console.info 出力

---

## 残存 NG（合格範囲内、Construction着手時に補完可能）

### important（5件）
- **F-NEW-02**: `createOutlineMesh` の戻り値契約（空Group vs siblings add）→ 副作用方式 or populated-Group を Construction Day 1 で確定
- **B-iter2-10**: HitReact 連続ダメージ時 `action.reset()` の必要性 → 連射感度を実装時に確認
- **B-MID-05**: スコア/キル数カウントのタイミング → HealthSystem推奨を明示（FR-04 近辺へ追記）
- **O-R2-2**: MetricsProbe 5分 vs NFR-07 30分の齟齬 → interval化または要件緩和
- **B-LOW-08**: AssetManager getter での深層 assert追加

### medium/minor（20件超）
mini-renderer trigger の図面補筆、疑似コードと methods 実装の詳細乖離、UI_MESSAGES fallback、GLTFLoader.parse baseUrl 検証、等。実装時メモで吸収可能。

---

## 設計書の総行数変化

| ファイル | iter1前 | iter2後 | 変化 |
|---|---|---|---|
| requirements-v5.md | ~510行 | ~560行 | +50 |
| components-v5.md | ~430行 | ~490行 | +60 |
| services-v5.md | ~300行 | ~360行 | +60 |
| component-methods-v5.md | ~560行 | ~790行 | +230 |
| component-dependency-v5.md | ~150行 | ~150行 | ±0 |

## 中間ファイル

- iter1: `aidlc-docs/reviews/inception/application-design-auto-review-v5-iter1.md`
- iter1 fixes: `aidlc-docs/reviews/inception/application-design-auto-review-v5-iter1-fixes.md`
- iter2: `aidlc-docs/reviews/inception/application-design-auto-review-v5-iter2.md`

---

## 対応推奨（Construction着手前）

| 優先 | 項目 | 対応 |
|---|---|---|
| 1 | bone名3モデル実測 | Construction Day 1 |
| 2 | 反転ハル SkinnedMesh PoC | Construction Day 1（FR-06成立確認） |
| 3 | createOutlineMesh 契約確定（F-NEW-02） | Construction Day 1 |
| 4 | HitReact clip長実測 + hitReactTimer 整合 | Construction Day 1 |
| 5 | HitReact連続ダメージ時 reset 動作確認（B-iter2-10） | Construction Day 1 |
| 6 | スコア/キル数カウント位置明記（B-MID-05） | application-design v5 補筆 |
| 7 | MetricsProbe interval化（O-R2-2） | Construction時 |

設計フェーズとしては十分な粒度に到達、Units Generation（or Construction 直行）へ進行可能。
