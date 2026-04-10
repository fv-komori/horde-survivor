# Unit-01: サウンドシステム 機能設計レビュー（自動レビュー v1 イテレーション1）

**レビュー日**: 2026-04-10
**判定**: FAIL（全体平均6.80、未達5件）

## スコアマトリクス

| ロール | 正確性 | 設計品質 | セキュリティ | 保守性 | 平均 |
|--------|--------|---------|------------|--------|------|
| アーキテクト (A) | 7 | 6 | 8 | 7 | 7.00 |
| フロントエンド (F) | 6 | 5 | 7 | 7 | 6.25 |
| バックエンド (B) | 6 | 7 | 7 | 7 | 6.75 |
| セキュリティ (S) | 7 | 6 | 7 | 7 | 6.75 |
| 運用 (O) | 7 | 7 | 8 | 7 | 7.25 |
| **全体平均** | **6.6** | **6.2** | **7.4** | **7.0** | **6.80** |

## 自動修正ログ（イテレーション 1 → 2）

### 適用済み修正

| # | FIX-ID | 対象ファイル | 修正内容 | 関連NG-ID |
|---|--------|------------|---------|----------|
| 1 | FIX-1 | business-logic-model.md | BGMスケジューラをsetTimeout→lookahead先読みスケジューリングに全面改修 | F-NG-1, A-NG-2 |
| 2 | FIX-2 | domain-entities.md | AE-01にmasterGain/bgmGain/seGain/seCooldowns/fadeTimerId/activeOscillatorCount属性追加 | A-NG-4, F-NG-2, B-NG-4, B-NG-5 |
| 3 | FIX-3 | business-logic-model.md | fadeOutBGM競合防止: fadeTimerIdをAudioManagerで管理、playBGM冒頭でclearTimeout | A-NG-3, F-NG-4, B-NG-2 |
| 4 | FIX-4 | business-rules.md, business-logic-model.md | 射撃SEクールダウンをプレイヤー/仲間で独立管理（shoot/shoot_allyキー分離） | F-NG-5, B-NG-6 |
| 5 | FIX-5 | business-rules.md | BR-AU04追加: AudioContext生成失敗時のtry-catch+無音続行設計 | B-NG-1, S-NG-1, O-NG-2 |
| 6 | FIX-6 | business-logic-model.md | stopAllSE()にOscillatorNode.stop()追加、generator関数がOscillatorNode[]を返す設計 | A-NG-6, S-NG-5 |
| 7 | FIX-7 | business-rules.md, domain-entities.md | BGMTrack.stepTimers→schedulerTimerId(setInterval)に変更、チャンネル独立タイマー問題解消 | S-NG-3 |
| 8 | FIX-8 | business-logic-model.md | SE解放をonended主体に変更、setTimeoutはフォールバック | F-NG-3 |
| 9 | FIX-9 | business-logic-model.md | 非ループBGM終了時のisPlaying=false設定追加 | F-NG-7 |
| 10 | FIX-10 | business-rules.md, business-logic-model.md | playBGM/playSEにcontext.state==='closed'ガード追加 | B-NG-7 |
| 11 | FIX-11 | business-rules.md | BR-LOG01/BR-LOG02追加: ログ出力設計+デバッグ診断API | O-NG-1, O-NG-3 |
| 12 | FIX-12 | business-rules.md | BR-AU05追加: CSP整合性の明記 | F-NG-6, S-NG-4 |
| 13 | FIX-13 | business-rules.md | BR-PERF01を「目安」→「ハードリミット」に変更、activeOscillatorCountカウンタ追加 | S-NG-2 |
| 14 | FIX-14 | business-rules.md | BR-ACFG02追加: audioConfigバリデーションルール | O-NG-4 |
| 15 | FIX-15 | business-rules.md, business-logic-model.md | BR-BGM07追加: タブ非アクティブ時のBGM一時停止/再開 | O-NG-5 |
| 16 | FIX-16 | business-rules.md | item_collect→item_destroyに改名（アイテム破壊仕様と用語統一） | A-NG-5 |
| 17 | FIX-17 | domain-entities.md | VO-A06にWeb Audio API前提の設計判断注記追加、oscillatorCount属性追加 | A-NG-1 |

### スキップした修正
なし
