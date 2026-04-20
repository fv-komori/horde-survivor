# 自動修正ログ（design iter1 → iter2）

**適用日**: 2026-04-17
**対象ファイル**: requirements-v5.md + application-design/ 4ファイル

## 適用済み修正（19 FIX）

| FIX | 対象 | 関連NG | 修正概要 |
|---|---|---|---|
| FIX-A | requirements-v5 NFR-06 + components-v5 C-01 | S-NG-6, I-NG-1, A-NG-5 | payload 2MB→3MB 引き上げ（Character実測2.34MB対応） |
| FIX-B | components-v5 C-01 + methods C-01 | I-NG-2, S-NG-4 | fetch+parse方式統一、AbortController、二重DL排除 |
| FIX-C | methods C-05 createOutlineMesh + メモ§3 | F-HIGH-01 | ShaderMaterial skinning flag削除、#include方式統一 |
| FIX-D | requirements FR-06 + methods createOutlineMesh | F-HIGH-02 | 反転ハル bind手順統一、SkeletonUtils.clone非採用 |
| FIX-E | methods C-02 transitionTo + C-07 processDeath | F-HIGH-03, A-NG-4 | finished listener 二重登録ガード、forceDispose経路でも解除 |
| FIX-F | methods C-02 transitionTo | F-HIGH-04, B-HIGH-02 | HitReact は hitReactTimer 自動復帰、clampWhenFinished=false |
| FIX-G | methods C-05 setupAnimations | B-HIGH-03 | Idle_Shoot.play() 初期化明示 |
| FIX-H | requirements FR-04 + DeathCompleteFlag | B-HIGH-01 | linger: 0.3秒 保持、CleanupSystem で消化 |
| FIX-I | methods C-05 attachGun + FR-03 | B-MID-04 | Gun material 個別clone、throw固定ID+cause |
| FIX-J | components-v5 + methods priority値 | A-NG-1, O-NG-9 | AnimationSystem=50, CleanupSystem=55, Render=60 確定 |
| FIX-K | methods C-02 VELOCITY_THRESHOLD_SQ | B-LOW-07 | =0.01 暫定値、ヒステリシス検討課題化 |
| FIX-L | components-v5 C-04 | I-NG-5 | index.html 静的ローダー雛形スニペット明記 |
| FIX-M | requirements NFR-08 | I-NG-4, S-NG-1 | blob:/worker-src削除、script-src 'self'で完結 |
| FIX-N | requirements NFR-09 | I-NG-6, O-NG-8 | HEAD検証→artifact存在確認に縮退（Iter5） |
| FIX-O | components-v5 C-15 + services-v5 S-SVC-08 | O-NG-1, O-NG-7 | MetricsProbe 新規、heap5min差分 |
| FIX-P | services-v5 teardown + methods C-07 | O-NG-3 | CleanupSystem.forceDisposeAll API、逆順dispose明記 |
| FIX-Q | components-v5 C-01 + methods 末尾 | O-NG-4 | AssetManager.restoreTextures、webglcontextrestored対応 |
| FIX-R | requirements NFR-06 + throw全般 | S-NG-3 | エラーメッセージ3層分界、Error.cause統一 |
| FIX-S | methods C-11 GameStartScreen | F-MED-05, O-NG-5 | disposePreview具体化、二重生成ガード、material clone |

## Medium集約
11項目（F-MED-06/07/08, S-NG-2/5/7/8, A-NG-6/7/8/9）はスコープ注記・dependency追記で吸収。

## スキップ
なし。

## ファイル変更統計
- requirements-v5.md: NFR-06/08/09 大幅拡充、FR-04/06 手順更新
- components-v5.md: C-15 新規追加、C-01 restoreTextures、priority表、index.html 雛形
- services-v5.md: S-SVC-08 新規、S-SVC-01 teardown 順序明記
- component-methods-v5.md: AnimationSystem/EntityFactory/CleanupSystem/GameStartScreen 大幅更新、DeathCompleteFlag linger、追加実装セクション
- component-dependency-v5.md: VelocityComponent 明示
