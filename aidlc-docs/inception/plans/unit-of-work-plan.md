# Unit of Work 分割計画

**作成日**: 2026-04-10
**対象**: Iteration 2完了コードベースからの機能Unit分割
**方針**: 既存の単一アプリ（Core）から2つの独立Unitを切り出し、各UnitがConstruction パイプライン（Functional Design → Code Generation → Build and Test）を通る

---

## 計画ステップ

- [x] Unit定義の作成（unit-of-work.md）
- [x] Unit間依存関係の定義（unit-of-work-dependency.md）
- [x] ストーリーマッピングの作成（unit-of-work-story-map.md）
- [x] Unit境界と依存関係の検証
- [x] 全ストーリーがUnitに割り当て済みであることの確認

---

## Unit構成（最終）

| Unit | 名称 | ストーリー |
|------|------|-----------|
| Unit-01 | サウンドシステム（Audio System） | US-23, US-24, US-25 |
| Unit-02 | 設定画面 & 遊び方ヘルプ（Settings & How to Play） | US-26, US-27 |

**変更**: 当初Unit-03（遊び方ヘルプ）として独立予定だったが、設定画面のサブ機能としてUnit-02に統合。

---

## 決定事項（ユーザー回答に基づく）

| 項目 | 決定 |
|------|------|
| サウンド範囲 | BGM + 効果音フル |
| アセット調達 | Web Audio APIでコード生成（無料、外部ファイル不要） |
| チュートリアル形式 | 設定画面から「遊び方」として常時閲覧可能な静的ヘルプ |
| 設定項目 | BGM/SE音量、操作タイプ切替、遊び方ヘルプ |
| Unit構成 | 2 Unit（Unit-03をUnit-02に統合） |
