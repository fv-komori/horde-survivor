# アプリケーション設計レビュー v1

**レビュー対象**: アプリケーション設計書（components.md, component-methods.md, services.md, component-dependency.md）
**上流ドキュメント**: requirements.md
**レビュー種別**: 初回レビュー
**レビュー日**: 2026-04-07

---

## 3. バックエンド開発者（B）— ゲームロジック/TypeScript

### レビュー観点
ゲームループ設計、データフロー、衝突判定設計、ECSシステム間のデータ連携、エラーハンドリング設計

### OK項目

| # | 対象設計 | OK理由 |
|---|---------|--------|
| B-OK-1 | ECSアーキテクチャ採用（components.md 全体） | コンポーネントは純粋データ、システムはロジックのみという責務分離が明確。ゲームオブジェクトの動的な組み合わせが容易で、要件NFR-03の拡張性要件に適合している |
| B-OK-2 | システム実行順序（component-dependency.md 優先度1-99） | Input→Movement→Weapon→Collision→Defense→Health→XP→Cleanup→Renderの順序が論理的に正しく、データの生成→消費の依存関係が尊重されている。特にCollisionSystem(5)がWeaponSystem(4)の後に実行される点は弾丸生成後の衝突判定として正しい |
| B-OK-3 | EntityFactoryの分離（services.md S-SVC-03） | エンティティ生成ロジックをファクトリに集約し、コンポーネントの組み合わせをカプセル化している。新しい敵タイプや武器の追加時に影響範囲が限定され、FR-02「後から新しい敵タイプを追加しやすい設計」に合致 |
| B-OK-4 | GameStateManagerによる状態遷移（components.md M-01, services.md） | TITLE/PLAYING/LEVEL_UP/GAME_OVERの4状態が要件FR-04の状態遷移定義と完全に一致。onStateChangeコールバックによりオブザーバパターンで疎結合に状態変化を通知可能 |
| B-OK-5 | データフロー設計（component-dependency.md） | 入力→プレイヤー移動→敵生成→衝突→XP回収→レベルアップの一連のフローが図示されており、システム間のデータの流れが追跡可能。設計の意図が明確に伝わる |
| B-OK-6 | ScoreServiceの独立設計（services.md S-SVC-02） | スコア集計がゲームロジックから分離されており、FR-04のスコア表示要件（生存時間、倒した敵数、到達レベル）に対応するデータ構造が定義されている |
| B-OK-7 | コンポーネント依存マトリクス（component-dependency.md） | 各システムが読み書きするコンポーネントと外部依存が一覧化されており、データ競合やシステム間の暗黙的依存を設計時点で可視化できている |

### NG項目

| # | 対象設計 | NG理由 | 提案 |
|---|---------|--------|------|
| B-NG-1 | CollisionSystem（components.md S-06, component-methods.md） | 衝突判定が弾丸-敵のみ記載されているが、要件FR-01でXPアイテムの回収半径48pxの接触判定、FR-01の防衛ライン判定など、複数の衝突判定パターンがある。XPCollectionSystemが別途距離判定を行うが、衝突判定の実装パターンが分散しており統一性がない。またFR-01のプレイヤー衝突判定（半径16px）の用途が弾丸発射元判定と記載されているがWeaponSystemとの関連が不明 | 衝突判定ユーティリティ関数（距離計算・円形判定）を共通化し、CollisionSystem/XPCollectionSystem/DefenseLineSystemが共有する設計を明示する。またプレイヤーColliderの用途を設計に反映する <!-- severity: medium --> |
| B-NG-2 | 敵HPの管理（component-dependency.md, components.md） | CollisionSystemが「HealthComponent(敵)」に書き込むと記載されているが、EnemyComponentにはHP属性がなく、HealthComponentはPlayerComponentとの組み合わせでのみ定義されている（S-08参照）。敵エンティティがHealthComponentを持つかどうかが不明確 | EnemyComponentにHP属性を含めるか、敵エンティティにもHealthComponentを付与する旨を明記する。HealthSystemの処理対象も「HealthComponent + PlayerComponent」から見直す <!-- severity: critical --> |
| B-NG-3 | デルタタイム上限の設計（requirements.md FR-04） | 要件にはタブ非アクティブ時のデルタタイム上限が記載されているが、設計ドキュメントのGameServiceやWorld.update()にはdtの上限値クランプ処理が言及されていない。大きなdtが入るとエンティティが壁を貫通する、衝突判定のすり抜けなどが発生しうる | GameService.gameLoop()でdtの上限クランプ（例：1/30秒=33ms）を設計に明記する。固定タイムステップの採用も検討 <!-- severity: important --> |
| B-NG-4 | エラーハンドリング設計の欠如 | 要件NFR-08でグローバルエラーハンドラー、ゲームループのtry-catch、アセット読み込みフォールバックが要求されているが、設計ドキュメント（GameService, AssetManager等）にこれらの設計が反映されていない | GameServiceにグローバルエラーハンドラー登録の設計、gameLoop()のtry-catch設計、AssetManager.loadAll()のフォールバック戦略を追加する <!-- severity: important --> |
| B-NG-5 | 同時エンティティ数の上限管理 | 要件NFR-01で同時敵数200体、弾丸100発、同時描画500個の上限が定義されているが、SpawnManager/WeaponSystem/CleanupSystemの設計にこれらの制限ロジックが含まれていない | SpawnManagerに同時敵数チェック、WeaponSystemに弾丸数上限チェック、またはWorldレベルでエンティティ数制限の仕組みを設計に追加する <!-- severity: important --> |
| B-NG-6 | MovementSystemとPlayerMovementSystemの責務重複 | MovementSystem（S-02）とPlayerMovementSystem（S-03）が共にcomponents.mdで優先度2と記載されているが、component-dependency.mdでは実行順序2,3と分かれている。プレイヤーがVelocityComponentを持つ場合、両方のシステムで位置が更新される可能性がある | 優先度の整合性を統一する（component-dependency.mdの順序に合わせPlayerMovementSystemを優先度2、MovementSystemを優先度3に修正）。プレイヤーにVelocityComponentを持たせない設計意図を明記する <!-- severity: medium --> |
| B-NG-7 | レベルアップ時のHP回復 | 要件FR-03でレベルアップ時にHP10%回復が記載されているが、LevelUpManager.applyChoice()やHealthSystemにこの処理への言及がない | LevelUpManagerのapplyChoice()またはレベルアップイベントハンドラでHP回復処理を含む設計を明記する <!-- severity: minor --> |

### スコア評価

| 観点 | スコア (1-10) | 根拠 |
|------|-------------|------|
| 正確性（設計と要件の整合性） | 6 | 敵HPの管理構造不明確（B-NG-2, critical）、エンティティ上限未反映（B-NG-5）、デルタタイム上限未反映（B-NG-3）など、要件の具体値が設計に落とし込まれていない箇所が複数存在 |
| 設計品質（パターン適切性・責務分離） | 7 | ECSパターンの採用・責務分離は適切だが、MovementSystemの優先度不整合（B-NG-6）、衝突判定の分散（B-NG-1）など設計の一貫性に改善余地あり |
| セキュリティ（脅威モデリング） | 7 | 要件NFR-07の入力バリデーション・状態整合性チェックに対応する設計が明示されていないが、クライアントサイドのみのゲームであり脅威レベルは低い。ただしdtクランプ未設計はチート防止の観点でも問題 |
| 保守性（変更容易性） | 8 | ECSアーキテクチャ、ファクトリパターン、コンフィグファイル分離により変更容易性は高い。ファイル構成も論理的で依存関係が明確 |

---

## 4. インフラエンジニア（I）

### レビュー観点
ビルド設計（Vite+TS）、バンドル戦略、CI/CD連携、パフォーマンス設計、デプロイ構成

### OK項目

| # | 対象設計 | OK理由 |
|---|---------|--------|
| I-OK-1 | Vite + TypeScript構成（components.md ヘッダ） | Viteは高速なHMRと効率的なバンドルを提供し、TypeScriptの型安全性と合わせて開発体験が良好。静的サイトとしてのビルド出力はNFR-06の静的ホスティング要件に最適 |
| I-OK-2 | モジュール構成（component-dependency.md ファイル構造） | src/配下がecs/components/systems/managers/factories/ui/config/typesと論理的に分割されており、ツリーシェイキングが効きやすい構成。各ディレクトリが1責務に対応している |
| I-OK-3 | コンフィグファイル分離（component-dependency.md） | gameConfig.ts/enemyConfig.ts/weaponConfig.ts/waveConfig.tsとしてバランスパラメータが分離されており、ゲームバランス調整時にロジックファイルを変更する必要がない。CI/CDでの差分検知も容易 |
| I-OK-4 | 単一エントリポイント設計（component-dependency.md） | index.tsが唯一のエントリポイントとして定義されており、Viteのバンドル設定がシンプルに保たれる。SPAとしてのデプロイが容易 |
| I-OK-5 | Canvas 2D描画への集約（components.md S-10） | 外部レンダリングライブラリに依存せずCanvas 2D APIのみを使用するため、バンドルサイズが最小限に抑えられる。依存関係の脆弱性リスクも低い |
| I-OK-6 | AudioManagerのスタブ設計（components.md M-07） | スコープ外の機能をインターフェースのみ定義しておくことで、将来のサウンド実装時にAPI変更が不要。ビルド時にツリーシェイキングでスタブコードが除去される設計が可能 |

### NG項目

| # | 対象設計 | NG理由 | 提案 |
|---|---------|--------|------|
| I-NG-1 | CI/CD設計の欠如 | 要件NFR-09でGitHub Actionsによる自動ビルド・デプロイ、ESLint、Jest、FPSカウンターが要求されているが、設計ドキュメントにCI/CDパイプライン構成、テスト戦略、リンター設定に関する記載がない | CI/CDパイプライン設計（ビルド→リント→テスト→デプロイのステージ構成）、テスト対象の優先度（ECSコア、衝突判定、レベルアップロジック等）を設計ドキュメントに追加する <!-- severity: important --> |
| I-NG-2 | アセットバンドル戦略の未定義 | AssetManager（M-06）がスプライト画像・フォントをロードするが、アセットの配置場所、バンドル方式（inline vs separate files）、プリロード戦略、キャッシュ制御（Cache-Busting用ハッシュ付きファイル名等）が設計されていない | アセット配置ディレクトリ（public/ vs assets/）、Viteのアセットハンドリング設定、ローディング画面の表示タイミングを設計に追加する <!-- severity: medium --> |
| I-NG-3 | パフォーマンス計測設計の未定義 | NFR-09でデバッグモード時のFPSカウンター表示が要求されているが、パフォーマンス計測の設計（FPS計測方法、デバッグモードの切り替え、開発用オーバーレイ等）が含まれていない | GameServiceまたはRenderSystemにFPS計測ロジック、環境変数によるデバッグモード切り替え、パフォーマンスオーバーレイの設計を追加する <!-- severity: medium --> |
| I-NG-4 | CSP設定の設計欠如 | NFR-07でCSP（Content Security Policy）が要求されているが、設計にCSPヘッダの設定方針が含まれていない。Canvas APIとinline scriptの制限に関する考慮も不明 | デプロイ構成の一部としてCSPメタタグまたはHTTPヘッダの設定方針（script-src, img-src等のディレクティブ）を設計に追加する <!-- severity: medium --> |
| I-NG-5 | ビルド環境・本番環境の差分設計 | NFR-07でminify、NFR-09でデバッグ機能が要求されているが、開発/本番のビルド設定差分（sourcemap、minify、デバッグフラグ等）が設計されていない | Viteのmode設定を活用した環境別ビルド構成（development: sourcemap有効・FPSカウンタ表示、production: minify・sourcemap無効）を設計に追加する <!-- severity: minor --> |
| I-NG-6 | レスポンシブ・スケーリングの実装設計 | NFR-05でレターボックス方式のスケーリングが要求され、FR-04でブラウザリサイズ時の再計算が求められているが、GameServiceやUIManagerにスケーリング計算のアルゴリズムやリサイズイベントハンドリングの設計が不十分。UIManager.handleResize()の存在は確認できるが具体的な処理フローが未定義 | handleResize()のスケーリング計算ロジック（CSS transform vs Canvas scale、デバイスピクセル比の考慮）を設計レベルで明記する <!-- severity: minor --> |

### スコア評価

| 観点 | スコア (1-10) | 根拠 |
|------|-------------|------|
| 正確性（設計と要件の整合性） | 6 | CI/CD（I-NG-1, important）、CSP（I-NG-4）、パフォーマンス計測（I-NG-3）など非機能要件の設計への反映が不十分。要件で明示されている項目が設計から欠落している |
| 設計品質（パターン適切性・責務分離） | 7 | ファイル構成やモジュール分割は適切だが、ビルド・デプロイに関する設計が薄く、インフラ観点での設計品質を十分に評価できない |
| セキュリティ（脅威モデリング） | 6 | CSP設計の欠如（I-NG-4）、環境別ビルド設定の未定義（I-NG-5）により、本番環境のセキュリティ設定が設計時点で担保されていない。npm auditのCI組み込みも設計に未反映 |
| 保守性（変更容易性） | 7 | コンフィグ分離やモジュール構成は保守性が高いが、アセット管理戦略やビルド設定が未定義のため、将来のアセット追加やビルド設定変更時に混乱が生じる可能性がある |
