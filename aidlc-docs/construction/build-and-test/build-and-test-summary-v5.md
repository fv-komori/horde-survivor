# Iter5 Build & Test Summary (MVP 到達時点)

**Date**: 2026-04-17
**Scope**: Iter5 Construction Day 1 + Day 2（GLTFモデル導入 MVP）

## ビルド

| 項目 | 結果 |
|---|---|
| `npm run build` | ✅ 成功 |
| バンドルサイズ | 737.52 KB (gzip 192.31 KB) |
| NFR-06 (≤ 3MB) | ✅ 成立 |
| 警告 | 「500KB を超える chunk」の情報警告のみ（GLTFLoader + SkeletonUtils 同梱に伴う増加、許容） |

## ユニットテスト

| 項目 | 結果 |
|---|---|
| `npm test` | ✅ 7 suites, 86 tests all PASS |
| Jest mock 追加 | SkeletonUtils / GLTFLoader（ESM 依存の Jest CJS 実行対策） |

## TSC / ESLint

| 項目 | 結果 |
|---|---|
| `tsc --noEmit` | ✅ errors 0 |
| `eslint src/` | warnings 3（BGMGenerator 既存） / errors 0 |

## Playwright 動作確認

| 項目 | 結果 |
|---|---|
| タイトル画面ロード | ✅ error log なし |
| Start → プレイ画面遷移 | ✅ error log なし |
| プレイ中レンダリング | ✅ GLTF Soldier/Enemy 可視、HUD 正常、弾丸発射、背景スクロール |
| 反転ハル Outline（PoC 成立確認済） | ✅ キャラ輪郭に黒縁表示 |
| スクリーンショット | `.playwright-screenshots/smoke-*-20260417-*.png` |

## 本 Iteration 完了した MVP スコープ

- [x] 全12アセット .glb 単一バイナリ化（27〜41% サイズ削減、data:URL 排除）
- [x] dev/prod CSP を `connect-src 'self'` で厳格化（NFR-09 復帰）
- [x] ProceduralMeshFactory Option B 移設完了（SceneManager / EffectManager3D / GameService）
- [x] ProceduralMeshFactory 削除
- [x] AssetPaths / BoneAttachmentConfig / AnimationStateComponent 新規
- [x] AssetManager を GLB GLTFLoader 順次ロードに書き換え
- [x] MeshComponent に mixer? / animations? / outlineMesh? 追加
- [x] EntityFactory GLTF 化（SkeletonUtils.clone + 反転ハル Outline + bone attach）
- [x] AnimationSystem（priority=50）velocity-driven Idle/Run、HitReact/Death ワンショット骨格
- [x] CleanupSystem GLTF dispose chain（mixer 停止 / outlineMesh dispose / deep dispose）
- [x] GLTF キャラスケール調整（CHAR_BASE_SCALE = 0.55）
- [x] 事前 attach 武器の非表示化（AK 以外の Pistol/Knife 等）
- [x] 反転ハル PoC 成立確認（Playwright 12枚スクショ、Run/Walk/Wave/Death 等7アニメで破綻なし）

## Iter5 残作業（次セッション以降）

- [ ] HealthSystem から AnimationSystem.playHitReact / playDeath を呼び出す結線
- [ ] 環境 GLB（Barrier_Single / Crate / SackTrench / Fence / Tree_1）を SceneManager に配置
- [ ] GameStartScreen mini-renderer（キャラプレビュー）
- [ ] MetricsProbe 新規（drawCall / triangles の実測）
- [ ] webglcontextlost/restored ハンドラ結線
- [ ] AssetManager 用 LoaderScreen（現状はローディング UI 無し、一瞬で完了する想定）
- [ ] 新規テスト（AssetManager / AnimationSystem / AnimationStateComponent / EntityFactory.gltf パス）
- [ ] 最終 Playwright 目視確認（アニメ再生、敵撃破、仲間生成、ダメージ演出）

## 設計書整合性

設計書（`aidlc-docs/inception/application-design/components-v5.md` ほか）の主要仕様と
本実装が一致していることを確認:

- FR-06 反転ハル Outline: geometry clone + skeleton 共有 bind 方式で実装 ✅
- Day 1-1: bone 名 `LowerArm.R` → three.js サニタイズで `LowerArmR` に調整（設計書/メモに反映済）
- Day 1-2: HITREACT_DURATION = 0.433 定数化 ✅
- Option B: ProceduralMeshFactory → SceneManager / EffectManager3D / GameService に分散移設 ✅
- 単一モデル + scale/tint 方針: ENEMY_VARIANT で NORMAL/FAST/TANK/BOSS に適用 ✅
