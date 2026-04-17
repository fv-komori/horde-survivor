# 設計自動レビュー 中間（v5 iter1）

**対象**: aidlc-docs/inception/application-design/ (components-v5, services-v5, component-dependency-v5, component-methods-v5)
**上流**: aidlc-docs/inception/requirements/requirements-v5.md
**レビュー日**: 2026-04-17
**ロール**: Architect, FE, BE, Infra, Security, Ops（6ロール並列）

## スコアマトリクス

| ロール | 正確性 | 設計品質 | セキュリティ | 保守性 | 平均 |
|---|---|---|---|---|---|
| Architect | 8 | 8 | 8 | 8 | 8.00 |
| FE | 7 | 7 | 8 | 7 | 7.25 |
| BE | 7 | 7 | 8 | 7 | 7.25 |
| **Infra** | **6** | **6** | 7 | 7 | 6.50 |
| Security | 8 | 7 | 8 | 8 | 7.75 |
| **Ops** | **6** | 7 | 8 | **6** | 6.75 |
| 全体平均 | 7.0 | 7.0 | 7.8 | 7.2 | 7.25 |

### 閾値判定
- **FAIL**: Infra(正確性/設計品質=6)、Ops(正確性/保守性=6)

## critical/important NG 一覧（修正優先）

### 最優先（起動失敗相当）
- **S-NG-6 / I-NG-1 / A-NG-5**: payload 2MB上限 vs Character 2.3MB実測矛盾 → 上限引き上げ or 種別別閾値

### important（重複指摘統合）
- **I-NG-2 / F-HIGH-01**: GLTFLoader `blob().size` 二重ダウンロード問題 + ShaderMaterial `skinning: true` 自己矛盾 → fetch+parse方式 + `#include <skinning_pars_vertex>` 統一
- **F-HIGH-02 / B-MID-04**: 反転ハル bind手順の齟齬 + Gun material clone責任不在 → 手順統一、attachGunでclone
- **F-HIGH-03 / S-NG-3**: finished listener 二重登録 + エラーメッセージ3層分界 → transitionTo冒頭解除、Error code方式
- **F-HIGH-04 / B-HIGH-02**: HitReact完了復帰ロジック未定 → clip長実測+velocity再判定 or finished駆動統一
- **B-HIGH-01**: Death完了後linger時間不在 → 要件で即削除 or 0.3秒保持を明記
- **B-HIGH-03**: 初回フレーム Idle_Shoot.play() 起動経路 → EntityFactory明示play()
- **B-MID-05**: スコア/キルカウントタイミング不明 → HealthSystem or CleanupSystem
- **A-NG-1 / O-NG-9**: AnimationSystem priority具体値TBD → 数値確定
- **A-NG-2**: HitReact velocity再判定の設計漏れ → 毎フレーム再評価明記
- **A-NG-4**: listener二重管理（mixer vs AnimationStateComponent.finishedListener） → forceDispose時の解除保証
- **I-NG-4**: CSP記述と実装の齟齬 → NFR-08更新 or vite.config統合
- **I-NG-5**: index.html静的ローダー雛形未実装 → スニペット追加
- **I-NG-6**: CI HEAD検証責務未確定 → artifact検証に縮退 or デプロイ先確定
- **O-NG-1 / O-NG-7**: 観測性責務配置欠落（MetricsProbe、heap計測、pixel diff） → コンポーネント追加
- **O-NG-3**: GameService.teardown具体順序 → CleanupSystem.forceDisposeAll API
- **O-NG-4**: WebGLコンテキストロスト復帰時のAssetManager再利用 → restoreTextures
- **O-NG-8**: CI HEAD検証失敗時のデプロイゲート → workflow設計

### medium/minor（集約対応）
F-MED-05〜08, B-LOW-07〜10, I-NG-3/7/8/9/10, S-NG-1/2/4/5/7/8/9/10, O-NG-2/5/6/10, A-NG-3/6/7/8/9

## 次のアクション

FAIL → iter2へ自動修正。
- critical相当の payload上限違反を最優先で解消（要件書v5-aidlc-docs側も更新）
- HIGH/important の統合FIXを10〜15件程度に集約予定
