# Iter5 要件定義で確認した論点

## Q1: 採用するglTFの範囲
**決定**: キャラ3 + 銃3（AK/Pistol/Shotgun）+ 環境6（Barrier_Single/Crate/SackTrench/Fence/Fence_Long/Tree_1）
**理由**: 最小構成で始めて必要に応じて追加。7MBで軽量。

## Q2: アセット配置場所
**決定**: `public/models/toon-shooter/`
**理由**: Vite staticで `/models/...` から直接配信可、import不要。

## Q3: 味方（Ally）のモデル割り当て
**決定**: Character_Enemy + 青tint
**理由**: 「敵を味方に変換するゲートで増える」設定と整合。Hazmat は Boss に温存。

## Q4: Outline実装
**決定**: 反転ハル法を維持（SkinnedMesh対応のみ新規）
**理由**: 既存動作の継続性を優先、追加パス不要で軽量。

## Q5: ローダー画面
**決定**: シンプルなローダーを新設
**理由**: 7MB + 初期化で数秒ブロックするため、進捗フィードバックが必要。

## Q6: 既存プロシージャルメッシュ
**決定**: 全削除（GLTFに一本化）
**理由**: コードベースを清潔に保つ。フォールバック不要（ロード失敗時はエラー表示）。

## Q7: アニメ state machine（Run は発生するか？）
**論点**: 当初案は「移動中のみ=Run / 移動中+射撃中=Run_Shoot」だったが、FORWARD武器の発射間隔=0.15秒で実質常時射撃中 → Run / Walk / Idle（非射撃系）は発生しない。
**決定**: 戦闘中アニメ（Run_Shoot / Idle_Shoot）を既定にする。HitReact / Death は優先上書き。非戦闘の Idle はスタート画面プレビュー用のみ。その他（Run, Walk, Walk_Shoot, Run_Gun, Punch, Jump系, Duck, Wave, Yes, No）はアセット温存・コード未参照。
**理由**: 実動作に合うstate machineにすることで切替ガチャつきを避け、実装もシンプルに保つ。
