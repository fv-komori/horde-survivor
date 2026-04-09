# Execution Plan

## 計画の経緯

### Iteration 1（2026-04-07）: 新規開発
- **目的**: ラストウォー風ミニゲームの新規開発
- **リスク**: Medium（新規プロジェクト、既存システムへの影響なし）
- **実行ステージ**: Application Design → Functional Design → Code Generation → Build and Test
- **スキップ**: Units Generation, NFR Requirements, NFR Design, Infrastructure Design
- **結果**: 全ステージ完了、動作確認済み

### Iteration 2（2026-04-09）: 爽快感向上・成長システム全面改修（現在の計画）
- **目的**: XP/レベルアップ制→アイテムドロップ制、ヒットカウント制導入、仲間化システム追加
- **変更理由**: 発射速度・敵出現数・テンポの爽快感が不足していた

---

## Iteration 2 Detailed Analysis

### Analysis Summary

### Transformation Scope
- **Transformation Type**: 既存アプリケーションの大幅機能改修（アーキテクチャ変更なし）
- **Primary Changes**: 成長システム全面刷新（XP→アイテムドロップ）、ダメージシステム変更（HP→ヒットカウント）、仲間化システム追加
- **既存アーキテクチャ**: ECS（Entity-Component-System）+ TypeScript + Canvas 2D — 維持

### Change Impact Assessment
- **User-facing changes**: Yes — 成長体験の全面変更、HUD変更、新しいゲームプレイ要素
- **Structural changes**: Yes — コンポーネント追加・削除・変更多数（ただしECSアーキテクチャ自体は変更なし）
- **Data model changes**: Yes — HealthComponent→HitCountComponent、新規ItemDrop/Buff/AllyConversion系
- **API changes**: No — クライアントサイド完結
- **NFR impact**: Yes — パフォーマンス上限引き上げ（300体、800オブジェクト）

### Risk Assessment
- **Risk Level**: Medium（既存ECSアーキテクチャ内での変更だが、影響範囲が広い）
- **Rollback Complexity**: Easy（gitで前バージョンに戻せる）
- **Testing Complexity**: Moderate（新システム間の相互作用テストが必要）

---

## Workflow Visualization

```
Phase 1: INCEPTION
- Workspace Detection        [COMPLETED]
- Requirements Analysis      [COMPLETED] (AutoReviewed PASS)
- User Stories               [COMPLETED] (Iteration 2更新済)
- Workflow Planning           [COMPLETED] (本ドキュメント)
- Application Design          [EXECUTE] コンポーネント再設計
- Units Generation            [SKIP] 単一アプリ

Phase 2: CONSTRUCTION
- Functional Design           [EXECUTE] 新ビジネスロジック定義
- NFR Requirements            [SKIP] 要件で定義済み
- NFR Design                  [SKIP] FD/CGで対応
- Infrastructure Design       [SKIP] 静的ホスティング、変更なし
- Code Generation             [EXECUTE] 常時実行
- Build and Test              [EXECUTE] 常時実行

Phase 3: OPERATIONS
- Operations                  [PLACEHOLDER]
```

---

## Phases to Execute

### INCEPTION PHASE
- [x] Workspace Detection - COMPLETED
- [x] Requirements Analysis - COMPLETED [AutoReviewed PASS]
- [x] User Stories - COMPLETED（Iteration 2更新済）
- [x] Workflow Planning - COMPLETED（本ドキュメント）
- [ ] Application Design - **EXECUTE**
  - **Rationale**: Iteration 2でコンポーネント構成が大幅変更。XPDrop/LevelUp/PassiveSkills系の削除、ItemDrop/Buff/HitCount/AllyConversion系の追加が必要。既存のapplication-designドキュメントをIteration 2用に更新する
- [x] Units Generation - **SKIP**
  - **Rationale**: 単一アプリケーションのため分割不要（Iteration 1と同じ判断）

### CONSTRUCTION PHASE
- [ ] Functional Design - **EXECUTE**
  - **Rationale**: ヒットカウント制、アイテムドロップ・バフシステム、仲間化システムなど新規ビジネスロジックが多数。domain-entities, business-rules, business-logic-modelの更新が必要
- [x] NFR Requirements - **SKIP**
  - **Rationale**: NFRは要件定義書で十分に定義済み（パフォーマンス上限、セキュリティ等）
- [x] NFR Design - **SKIP**
  - **Rationale**: Functional DesignとCode Generationで対応可能
- [x] Infrastructure Design - **SKIP**
  - **Rationale**: 静的ホスティング構成に変更なし
- [ ] Code Generation - **EXECUTE**（常時実行）
  - **Rationale**: 既存コードの大幅改修が必要
- [ ] Build and Test - **EXECUTE**（常時実行）
  - **Rationale**: ビルド・テスト検証が必要

### OPERATIONS PHASE
- [ ] Operations - PLACEHOLDER

---

## 実行ステージ一覧（実行順）

| # | ステージ | フェーズ | 種別 |
|---|---------|--------|------|
| 1 | Application Design | INCEPTION | 更新 |
| 2 | Functional Design | CONSTRUCTION | 更新 |
| 3 | Code Generation | CONSTRUCTION | 実装 |
| 4 | Build and Test | CONSTRUCTION | 検証 |

## Success Criteria
- **Primary Goal**: 爽快感のあるアイテムドロップ制ゲームプレイの実現
- **Key Deliverables**: 更新された設計書、改修済みソースコード、テスト合格
- **Quality Gates**: 各ステージの自動レビューPASS、全テスト合格、60FPS維持
