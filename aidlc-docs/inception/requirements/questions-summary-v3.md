# Iteration 3 Requirements Q&A Summary

**Date**: 2026-04-14T00:00:00Z

## Question 1
**Question**: ビジュアル改修のアプローチはどちらを希望しますか？
**Answer**: Three.js導入
**Notes**: Three.jsにした場合の変更範囲を質問。影響範囲30-40%と説明後に決定。

## Question 2
**Question**: キャラクターの描画はどうしますか？
**Answer**: 最も高いレベルを希望
**Notes**: プロシージャル3D → GLTF差し替え可能な設計を推奨し、採用。

## Question 3
**Question**: 参考画像のどの要素を特に重視しますか？
**Answer**: キャラクターの質感、パース道路 & 背景、HP/数値表示の演出
**Notes**: 複数選択

## Question 4
**Question**: ゲームの視点（カメラアングル）はどうしますか？
**Answer**: 参考画像と同じ斜め上視点
**Notes**: 3Dパースペクティブで奥行きのある見下ろし型

## Question 5
**Question**: キャラクターの3D表現はどのレベルを目指しますか？
**Answer**: プロシージャル3Dから始め、GLTF差し替え可能な設計
**Notes**: 移行の容易さを確認した上で決定

## Question 6
**Question**: 背景・地形の表現はどうしますか？
**Answer**: 参考画像風（道路+砂漠）
**Notes**: グレー道路 + ガードレール + 砂漠地形

## Question 7
**Question**: 障害物（参考画像の樽のようなもの）は追加しますか？
**Answer**: 今回は追加しない
**Notes**: ビジュアル改修のみに集中

---
**Summary**: Three.js導入による全面ビジュアルリニューアル。プロシージャル3Dメッシュ+ToonMaterialでカートゥン風キャラ、斜め上視点、参考画像風の道路+砂漠背景。GLTF差し替え可能な設計。ゲームプレイの変更なし。
