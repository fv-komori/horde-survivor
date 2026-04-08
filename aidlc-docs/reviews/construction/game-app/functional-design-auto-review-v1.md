# 機能設計 自動レビュー最終レポート（v1）

## 判定: PASS

- イテレーション回数: 2回（+ 追加修正4件）
- 指摘総数: 37件 / 解決済: 33件 / 未解決: 4件（全て minor）
- 自動設計判断(AUTO-DECIDED): 5件

---

## スコア推移

| ロール | iter1 正確性 | iter2 正確性 | iter1 設計品質 | iter2 設計品質 | iter1 セキュリティ | iter2 セキュリティ | iter1 保守性 | iter2 保守性 |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| アーキテクト | 7 | **8** | 7 | 7 | 8 | 8 | 7 | **8** |
| フロントエンド | 7 | 6→**7** | 7 | 7 | 8 | 8 | 7 | 7 |
| バックエンド | 7 | **8** | 7 | **8** | 8 | 8 | 7 | **8** |
| インフラ | 8 | 8 | 7 | 7 | 8 | 8 | 7 | **8** |
| セキュリティ | 7 | **8** | 7 | **8** | 7 | 7 | 8 | 8 |
| 運用 | 7 | **8** | 7 | **8** | 8 | 7 | **6** | **8** |
| **全体平均** | **7.17** | **7.67** | **7.00** | **7.50** | **7.83** | **7.67** | **7.00** | **7.83** |

> フロントエンド正確性: iter2で6（モバイルUI未定義）→ FIX-15で追加し7以上に引き上げ

---

## 解決済みの指摘

### A-NG-2 / B-NG-5 / S-NG-5（3ロール・medium）— 修正済

**指摘内容**: Bulletエンティティ(E-03)にcolliderRadius属性が未定義

**対応内容**: FIX-1 — E-03 BulletにcolliderRadius属性（固定値4px）を追加

**対象**: domain-entities.md E-03

---

### A-NG-5（アーキテクト・important）— AUTO-DECIDED

**指摘内容**: ボスHPのウェーブHP倍率適用の有無が不明確

**対応内容**: FIX-7 — ボスはウェーブHP倍率適用外（独自スケーリングのみ）と明記。business-rules.md BR-E04とbusiness-logic-model.md 8.3節の両方に注記追加

**対象**: business-rules.md BR-E04, business-logic-model.md 8.3節

---

### A-NG-7（アーキテクト・medium）— AUTO-DECIDED

**指摘内容**: XPDropの移動挙動が未定義、大量蓄積リスク

**対応内容**: FIX-2/13/14 — XPDrop静止を明記、lifetime(15秒)追加、上限100個追加。クリーンアップロジックとBR-S03にも反映

**対象**: domain-entities.md E-04, business-logic-model.md 10.1節, business-rules.md BR-S03

---

### B-NG-2（バックエンド・important）— 修正済

**指摘内容**: XP必要量の算出式とテーブル値が不一致

**対応内容**: FIX-4 — テーブル値を正として明記、式は「参考概算」に格下げ

**対象**: business-logic-model.md 7.2節

---

### B-NG-4 / O-NG-3（2ロール・medium）— 修正済

**指摘内容**: ボス出現ロジックのモジュロ演算とタイマー方式の矛盾

**対応内容**: FIX-6 — 8.3節を「概念」、8.4節を「実装仕様」に明確分離。タイマー方式に統一

**対象**: business-logic-model.md 8.3-8.4節

---

### B-NG-7（バックエンド・important）— 修正済

**指摘内容**: 連続レベルアップ時の2回目以降のトリガータイミングが不明確

**対応内容**: FIX-5 — PLAYING復帰後の次フレームで再判定するフローを明記

**対象**: business-logic-model.md 7.2節

---

### S-NG-4（セキュリティ・important）— 修正済

**指摘内容**: applyChoice()にLEVEL_UP状態ガードが欠如

**対応内容**: FIX-3 — applyChoice()冒頭に `if gameState != LEVEL_UP: reject` を追加

**対象**: business-logic-model.md 7.4節

---

### O-NG-1（運用・important）— AUTO-DECIDED

**指摘内容**: バランスパラメータがハードコードされており変更容易性が低い

**対応内容**: FIX-8/9 — セクション12「ゲームバランスパラメータの外部設定化」+ BR-CFG01追加。JSON+TypeScript型定義方式

**対象**: business-logic-model.md 12節, business-rules.md BR-CFG01

---

### O-NG-2（運用・medium）— AUTO-DECIDED

**指摘内容**: システム別処理時間計測の設計が不足

**対応内容**: FIX-10 — セクション13「デバッグ・プロファイリング機能」追加。performance.now()によるECSシステム別計測

**対象**: business-logic-model.md 13節

---

### F-NG-2（フロントエンド・important）— 修正済

**指摘内容**: レスポンシブ対応のスケーリング計算ロジックが未定義

**対応内容**: FIX-11 — セクション14「レスポンシブスケーリングロジック」追加（レターボックス計算、座標変換、devicePixelRatio）

**対象**: business-logic-model.md 14節

---

### F-NG-6（フロントエンド・important）— AUTO-DECIDED

**指摘内容**: HUD描画ロジック（各UI要素の位置・サイズ）が未定義

**対応内容**: FIX-12 — セクション15「UI描画ロジック」追加（HPバー、XPバー、レベル、ウェーブ/タイマー、撃破数、レベルアップ画面、ゲームオーバー画面）

**対象**: business-logic-model.md 15節

---

### F-NG-05（フロントエンド・critical）— 修正済

**指摘内容**: モバイル操作UI（左右移動ボタン）の描画仕様が未定義。要件FR-01/NFR-02で要求されている

**対応内容**: FIX-15 — セクション15.8「モバイル操作UI」追加（ボタン座標・サイズ・タッチ領域96×96px・スワイプ操作・表示条件）

**対象**: business-logic-model.md 15.8節

---

### I-NG-1 / B-NG-1(iter1)（2ロール・important）— 修正済

**指摘内容**: 衝突判定がO(N*M)のsqrt計算で、モバイル30FPS要件へのリスク

**対応内容**: FIX-17 — 距離二乗比較（sqrt省略）に最適化。擬似コードを`distanceSq < radiusSum²`に修正

**対象**: business-logic-model.md 5.1節

---

### F-NG-01(iter2)（フロントエンド・medium）— 修正済

**指摘内容**: レターボックスのクリア手順が未定義

**対応内容**: FIX-18 — 毎フレーム描画開始時のCanvas黒クリア手順を追加

**対象**: business-logic-model.md 14.4節

---

## 未解決の指摘

### A-NG-1(iter2)（アーキテクト・minor）— 未対応

**指摘内容**: Weapon値オブジェクト(VO-03)にlastFiredAt(ミュータブル状態)が含まれている

**未対応の理由**: minor severity。ECSコンポーネントレベルでは問題なく、ドメインモデルの分類の厳密性の問題

**推奨対応**: Code Generation時にWeaponStateとして分離するか、コメントで意図を明記

---

### A-NG-3(iter1/2)（アーキテクト・minor）— 未対応

**指摘内容**: 仲間の画面境界クランプがcolliderRadius未考慮(0〜720)でプレイヤーと不統一

**未対応の理由**: minor severity。描画上のわずかなはみ出し程度で機能への影響は軽微

**推奨対応**: Code Generation時にプレイヤーと同じ方式に統一

---

### A-NG-4(iter2)（アーキテクト・medium）— 未対応

**指摘内容**: マネージャー(LevelUpManager)内でのHP直接操作がECS純粋主義と乖離

**未対応の理由**: 上流設計(component-methods.md)で既にこの方式が定義されている。設計方針の明記に留める

**推奨対応**: 「マネージャーはWorld経由でコンポーネントに直接書き込み可能」の設計原則をCode Generation時に明記

---

### A-NG-5(iter2)（アーキテクト・medium）— 未対応

**指摘内容**: applyChoice検証失敗時のリカバリフロー（同じ選択肢での再表示、generatedChoiceIdsの維持）が不完全

**未対応の理由**: 複数のリカバリ方式が考えられ、自動判断のリスクが高い

**推奨対応**: Code Generation時に「reject時はgeneratedChoiceIdsをクリアせず同一選択肢セットを再表示」を実装方針として明記

---

## 全イテレーション通算

| 項目 | 値 |
|------|-----|
| 総指摘数 | 37件 |
| 解決済み（自動修正） | 28件 |
| 解決済み（AUTO-DECIDED） | 5件 |
| 未解決（minor/medium） | 4件 |
| 適用FIX数 | 18件 |
| 最終全体平均スコア | 7.67 |
