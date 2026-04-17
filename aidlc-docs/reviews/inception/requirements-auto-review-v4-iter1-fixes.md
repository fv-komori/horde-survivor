# 自動修正ログ（イテレーション 1 → 2）

**適用日**: 2026-04-17
**対象ファイル**: aidlc-docs/inception/requirements/requirements-v5.md

## 適用済み修正（全15件 HIGH信頼度）

| # | FIX-ID | 対象節 | 修正内容 | 関連NG-ID |
|---|---|---|---|---|
| 1 | FIX-2 | 新規NFR-07「メモリ管理」 | v3 NFR-05継承 + Iter5固有（mixer dispose, uncacheRoot, uncacheAction） | O-NG-1 (critical) |
| 2 | FIX-3 | FR-03 dispose責任分界表 | AssetManager保持テンプレート vs. entity clone の責任明確化（9リソース分類） | O-NG-2 (critical) |
| 3 | FIX-1 | FR-04 Death完了シーケンス | HealthSystem→AnimationSystem→CleanupSystem の4ステップ明記、mixer.finished採用 | B-NG-1 (critical), Q-NG-6 |
| 4 | FIX-4 | FR-01/FR-02 ロード失敗統合 | Promise.all、30/60秒タイムアウト、部分起動禁止、再試行最大3回 | F-NG-1/B-NG-3/I-NG-5/O-NG-4 |
| 5 | FIX-5 | FR-05 bone調査タスク | Construction前にBoneAttachmentConfig確定、3モデル全数調査 | F-NG-2, Q-NG-4 |
| 6 | FIX-6 | FR-06 反転ハルスパイク + bind手順 | Construction初日PoC、退避策Outline OFFでリリース可 | F-NG-3, B-NG-5 |
| 7 | FIX-8 | FR-04 AnimationStateComponent | 新規Component、hitReactTimer/deathFlag/currentClip、CombatSystem/HealthSystem連携 | B-NG-4, B-NG-9 |
| 8 | FIX-7 | 新規節「起動シーケンス」 | main→AssetManager.load→LoaderScreen→GameStartScreen→Game、EntityFactory DI制約 | B-NG-2, B-NG-8 |
| 9 | FIX-9 | 新規節「既存コード影響マップ」 | 呼び出し元マッピング表、テスト削除/追加一覧 | B-NG-6, Q-NG-1 |
| 10 | FIX-13 | NFR-01 測定条件 | 30秒区間・移動平均60フレーム、自動降格ルール、間引きはIter6判断 | Q-NG-3, O-NG-5, B-NG-7, F-NG-7, Q-NG-12, O-NG-9 |
| 11 | FIX-10 | NFR-02 測定条件・圧縮 | Chrome/Mac M1/10Mbps、gzip/brotli前提、`.gltf`=model/gltf+json | I-NG-1, Q-NG-2, I-NG-2, I-NG-3 |
| 12 | FIX-11 | NFR-08/NFR-09 新設 | CSP整合（data:/blob:許可）、バージョン付きパス、immutableキャッシュ、CHECKSUMS.txt | S-NG-1, I-NG-4, S-NG-2, I-NG-6, O-NG-7 |
| 13 | FIX-12 | NFR-05 テスト拡充 | GLTFLoader mock fixture、視覚回帰5%、観測性（window error listener）、目視チェック5項目 | Q-NG-1/11/5/13, S-NG-8, O-NG-6/10, F-NG-9, Q-NG-10 |
| 14 | FIX-14 | NFR-06 ライセンス/セキュリティ統合 | ホワイトリスト、payload 2MB上限、汎用エラー、audit | S-NG-5/6/7/3/4 |
| 15 | FIX-15 | スコープ確定事項表 | medium対応5項目を表に集約 | F-NG-4/7, B-NG-10, Q-NG-7/12, S-NG-6/7 |

## 自動設計判断（AUTO-DECIDED）内訳

全FIXのうち設計判断を伴った主要な決定:

1. **ロード失敗**: Promise.all全件待ち + 自動リトライなし + ユーザー操作最大3回（安全側振り）
2. **Death完了検知**: mixer.finishedイベント採用（タイマー非採用）
3. **AnimationStateComponent新規**: MeshComponent拡張ではなく専用Componentとして切出（ECS単一責任）
4. **バージョン付きパス**: `public/models/toon-shooter/v1/` 採用（将来パック更新時のキャッシュbust）
5. **反転ハル失敗時**: Outline OFFでリリース可（B計画明記）
6. **アニメ間引き**: 本Iter未採用、必要性が見えてからIter6判断
7. **CHECKSUMS.txt**: CI検証は将来、本Iterはgit固定で整合性担保
8. **Credits画面**: Iter6対応、本IterはLICENSE.txt同梱のみ

## スキップ項目

なし（全指摘を15 FIXに統合、矛盾する提案はなかった）

## ファイル変更統計

- 旧: 232行
- 新: 約330行
- 新規セクション: 3（起動シーケンス、既存コード影響マップ、NFR-07/08/09）
- 拡張セクション: 7（FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, NFR-01, NFR-02, NFR-05, NFR-06）
- 表の追加: 3（dispose責任分界、Death完了シーケンス、呼び出し元マッピング、テスト影響、CSP設定）
