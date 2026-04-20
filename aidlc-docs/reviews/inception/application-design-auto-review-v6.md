# アプリケーション設計 自動レビュー最終レポート（v6）

**レビュー対象**:
- `aidlc-docs/inception/application-design/components-v6.md`
- `aidlc-docs/inception/application-design/services-v6.md`
- `aidlc-docs/inception/application-design/component-methods-v6.md`
- `aidlc-docs/inception/application-design/component-dependency-v6.md`

**上流**: `aidlc-docs/inception/requirements/requirements-v6.md`
**レビュー日**: 2026-04-20
**方式**: 6 ロール並列スコアリングレビュー（自律反復、design カテゴリ）
**イテレーション回数**: 2 / 3
**最終判定**: **PASS** ✅（全ロール × 全軸 ≥ 7/10）

---

## 最終スコアマトリクス

| ロール | 正確性 | 設計品質 | セキュリティ | 保守性 | 平均 |
|---|---|---|---|---|---|
| アーキテクト | 8 | 8 | 8 | 7 | 7.75 |
| フロントエンド | 8 | 8 | 9 | 7 | 8.00 |
| バックエンド | 8 | 8 | 9 | 8 | 8.25 |
| AWSインフラエンジニア | 8 | 8 | 9 | 8 | 8.25 |
| セキュリティエンジニア | 8 | 8 | 8 | 8 | 8.00 |
| 運用エンジニア | 8 | 8 | 9 | 7 | 8.00 |
| **全体平均** | **8.00** | **8.00** | **8.67** | **7.50** | **8.04** |

---

## スコア推移（iter 1 → iter 2）

| ロール / 軸 | iter 1 | iter 2 | 差分 |
|---|---|---|---|
| A / 正確性 | 7 | 8 | +1 |
| A / 設計品質 | 7 | 8 | +1 |
| A / セキュリティ | 8 | 8 | ±0 |
| A / 保守性 | **6** | **7** | +1（閾値突破） |
| F / 正確性 | 7 | 8 | +1 |
| F / 設計品質 | 7 | 8 | +1 |
| F / セキュリティ | 9 | 9 | ±0 |
| F / 保守性 | 7 | 7 | ±0 |
| B / 正確性 | **6** | **8** | +2（閾値突破） |
| B / 設計品質 | 7 | 8 | +1 |
| B / セキュリティ | 8 | 9 | +1 |
| B / 保守性 | 7 | 8 | +1 |
| I / 正確性 | 7 | 8 | +1 |
| I / 設計品質 | 7 | 8 | +1 |
| I / セキュリティ | 8 | 9 | +1 |
| I / 保守性 | 8 | 8 | ±0 |
| S / 正確性 | 8 | 8 | ±0 |
| S / 設計品質 | 8 | 8 | ±0 |
| S / セキュリティ | 7 | 8 | +1 |
| S / 保守性 | 8 | 8 | ±0 |
| O / 正確性 | 7 | 8 | +1 |
| O / 設計品質 | 7 | 8 | +1 |
| O / セキュリティ | 8 | 9 | +1 |
| O / 保守性 | 7 | 7 | ±0 |

**合計改善点**: +17 点（全 24 セルのうち 17 セルで改善）
**閾値突破**: A-保守性（6→7）、B-正確性（6→8）の 2 つの FAIL 軸を解消

---

## イテレーション 1 → 2 で適用した修正（26 FIX、HIGH 信頼度）

### Critical / Important レベル

| FIX | 対象 | 内容 | 関連 NG | 結果 |
|---|---|---|---|---|
| FIX-1, FIX-2 | services-v6 / methods-v6 | transferWeaponMesh 4 ステップ契約 + try/catch + `'transferred'`/`'cloned'`/`'failed'` 戻り値 + genre rollback | B-NG-2 (critical), A-NG-2, F-NG-8, I-NG-6, O-NG-4 | **解消** |
| FIX-3〜6 | 4 ファイル全体 | `DefenseLineComponent` 誤参照を `HealthComponent` に訂正（実コード調査で DefenseLineComponent 不在を確認） | B-NG-12 | **解消** |
| FIX-7, FIX-8, FIX-9 | 3 ファイル | HTMLOverlayManager を Facade に降格、サブクラスを独立 DI、reset/dispose API 追加 | A-NG-3, F-NG-11 | **解消** |
| FIX-10, FIX-11 | services-v6 / methods-v6 | GateTriggerSystem `prevGateY: Map<EntityId, number>` + `initialized: Set` + `onGateCreated/Disposed` API | B-NG-1, F-NG-7, A-NG-4 | **解消** |
| FIX-12 | dependency-v6 | priority 3 → 3.0/3.1/3.2、priority 6 → 6.0/6.1 に細分化 | A-NG-1 | **解消** |
| FIX-13 | services-v6 | `WaveState.bonusFiredAt: Set<number>` で Wave 境目重複発火防止 | B-NG-3 | **解消** |
| FIX-14, FIX-15 | components-v6 / methods-v6 / dependency-v6 | `BarrelItemComponent.weaponTransferred: boolean` フラグ + CleanupSystem 3 分岐 dispose 表 | B-NG-7, I-NG-6, O-NG-4 | **解消** |
| FIX-16 | methods-v6 | `C6-03b ActiveBuffsComponent` の ECS Component 定義追加（`Map<GateType, {remaining, amount}>`） | B-NG-8 | **解消** |
| FIX-17（FIX-8統合） | services-v6 | throttle drain 型（`-= 1/30` の while ループ） | F-NG-1, I-NG-3 | **解消** |
| FIX-18, FIX-19 | components-v6 / methods-v6 | WorldToScreenLabel の priority 引数 + ロールオーバー + camera.project NDC→px 変換疑似コード + ResizeObserver | F-NG-2, F-NG-3 | **解消** |
| FIX-20 | services-v6 | DeterministicRng を `__DEBUG_API__` define 定数ガードに統一、Playwright AC 追加 | I-NG-1 | **解消** |
| FIX-21 | services-v6 | bundle gzip 内訳見積り表（+4.8〜+6.8 KB） | I-NG-4 | **解消** |
| FIX-22 | services-v6 | DebugConfigLoader に `pickNumber` + `sanitizeDebugConfig`（プロトタイプ汚染対策 + NaN/Infinity 拒否） | S-NG-1, S-NG-2 | **解消** |
| FIX-23 | services-v6 | `DEBUG_LOG_ENABLED` 出所明記（`src/config/logConfig.ts` + VITE_DEBUG_LOG + vite define）、Open Issue 4 クローズ | O-NG-1 | **解消** |
| FIX-24 | services-v6 | `onContextLost/Restored` ハンドラ手順を明記 | O-NG-2, A-NG-5 | **解消** |

### AUTO-DECIDED（設計文書自動判断）

| FIX | 設計判断 | 根拠 | 関連 NG |
|---|---|---|---|
| FIX-25 | SpawnManager 責務確定（敵 + 仲間スポーン維持、`itemSpawnTimer` のみ削除） | FR-01 で旧 itemSpawn は廃止確定、GateTriggerSystem.ALLY_ADD が `spawnAlly` 依存 | A-NG-7 |
| FIX-26 | Wave 境目ボーナス交互固定（45s=樽 MACHINEGUN / 90s=ゲート強化 / 180s=樽 MACHINEGUN） | 乱択はテスト記述負担大、交互固定は `__SPAWN_FORCE_NEXT` 整合良好、AC 明確化 | A-NG-8 |

### スキップした修正

なし（全 26 件が HIGH 信頼度で適用）。

---

## 設計判断ログ（AUTO-DECIDED）

### FIX-25: SpawnManager 責務確定

- **判断内容**: SpawnManager は敵スポーン + `spawnAlly` を引き続き保持、旧 `itemSpawnTimer` 関連のみ削除
- **検討した代替案**:
  1. SpawnManager 完全廃止 → GateTriggerSystem.ALLY_ADD の依存を破綻させる
  2. `spawnAlly` のみ別 System へ抽出 → 変更範囲が増え、Iter6 スコープ外
  3. **採用**: 敵/仲間スポーンは維持、旧 itemSpawnTimer のみ削除
- **覆すべき条件**: ユーザが「SpawnManager を完全廃止し別 System へ」と指定した場合のみ

### FIX-26: Wave 境目ボーナス交互固定

- **判断内容**: 45s=樽 MACHINEGUN / 90s=ゲート強化 / 180s=樽 MACHINEGUN の交互固定
- **検討した代替案**:
  1. 毎回乱択 → AC 記述負担大、再現性確保のため DeterministicRng シード固定が必須
  2. 2 種同時発火 → DOM プール 6 スロットへの負荷増
  3. **採用**: 交互固定、Iter6 暫定、Iter7 以降でバランス調整余地
- **覆すべき条件**: ユーザが「多様性重視で乱択に戻す」と指示した場合のみ

---

## 残存 NG（軽微〜中、PASS 後の参考）

iter 2 で残った指摘は全て `medium` 以下。Construction フェーズまたは将来の Iter で対応推奨:

### Medium（5 件）

| # | 内容 | 対応推奨タイミング |
|---|---|---|
| A-NG-3r | EventLogger 初期化順序: `DebugConfigLoader.load()` が先行するが `EventLogger.instance.error` を参照するため初期化順不整合 | Construction 着手時に「EventLogger を最初に new」を確認 |
| A-NG-7r | HealthComponent と DefenseLine の用語ブリッジ不足（要件側 FR-04 に DefenseLineComponent 記載が残存） | requirements-v6.md FR-04 の記述を HealthComponent に統一（上流フィードバック） |
| B-NG-13 | GateTriggerSystem の `prevPlayerY` 初期化と X 幅判定の前フレーム考慮 | Construction 時の実装で詳細化 |
| B-NG-18 | `cloned` fallback 時のプレイヤー保持武器 mesh dispose 責任 | PlayerWeaponComponent に `currentWeaponMesh` を持たせる拡張で解消 |
| O-NG-11 | newGame シーケンスでの `WaveState.bonusFiredAt` / `prevGateY` / `pendingSwitches` などの明示クリア | Construction 時に teardown シーケンスを拡充 |

### Minor（複数、Construction で吸収可能）

- F-NG-1r（throttle while ループ cap）、F-NG-3r（ResizeObserver 初回前の w/h_cache）、F-NG-5r/6r（z-index 具体値 / レスポンシブ CSS）、F-NG-10r（0.3秒定数所在）、F-NG-12r（アイコンアセットパス）、F-NG-15〜19（BuffSystem 依存マトリクス整合、Wave 種別 BR 記述統一、Toast TextContent 構築）、I-NG-A〜F（ForceSpawnApi ガード統一、size-limit CI grep 追加、cloneWeaponTemplate キャッシュ方針等）、S-NG-9〜12（EventLogger error payload raw 制限、enum メンバシップ厳密化、localStorage 信頼境界）、O-NG-12〜16（MetricsProbe 責務定義、debug ガード統一、context lost 中 GameLoop 挙動）

---

## 上流フィードバック（requirements-v6.md へ）

レビュー過程で設計側から要件書への改善提案が出された項目:

1. **A-NG-10 (iter 1)**: FR-05 Wave 境目ボーナス OR 条件の曖昧さ → AUTO-DECIDED FIX-26 で設計側が確定（45/90/180s 交互固定）。要件書への反映は任意。
2. **A-NG-7r (iter 2)**: FR-04 の `DefenseLineComponent.hp` 記述が実コードと不整合 → `HealthComponent.hp` に改訂推奨（ただし要件書としては「防衛ライン HP」の概念表記でも成立、実装マッピングは設計書で吸収済み）。

要件書の改訂が必要かどうかはユーザ判断に委ねる。

---

## Go/No-Go サマリ

- **判定**: **PASS**（Go）
- **合格根拠**:
  - 全ロール × 全軸 ≥ 7/10（閾値満たす）
  - 平均スコア 8.04（前回 7.33 から +0.71 向上）
  - 重大度 critical の NG はゼロ
  - 残存 NG は全て medium 以下、Construction 段階で吸収可能
- **AUTO-DECIDED 件数**: 2 件（人間確認推奨）
  - SpawnManager 存続（敵+仲間維持、itemSpawnTimer 削除）
  - Wave 境目ボーナス交互固定（45s=樽/90s=ゲート/180s=樽）
- **次段階**: Units Generation（SKIP 推奨、Iter3/4/5 踏襲）→ Construction フェーズへ

## イテレーション回数と効率性

| メトリクス | 値 |
|---|---|
| 総イテレーション数 | 2 / 3（合格） |
| 総 FIX 適用数 | 26 件（うち AUTO-DECIDED 2 件） |
| 総スキップ数 | 0 件 |
| 閾値突破タイミング | iter 2（A-保守性 6→7、B-正確性 6→8） |
| 平均スコア改善率 | +9.7%（7.33 → 8.04） |
