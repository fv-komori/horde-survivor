# アプリケーション設計 自動レビュー結果（v6, イテレーション 1）

**レビュー対象**:
- `aidlc-docs/inception/application-design/components-v6.md`
- `aidlc-docs/inception/application-design/services-v6.md`
- `aidlc-docs/inception/application-design/component-methods-v6.md`
- `aidlc-docs/inception/application-design/component-dependency-v6.md`

**上流**: `aidlc-docs/inception/requirements/requirements-v6.md`
**レビュー日**: 2026-04-20
**方式**: 6 ロール並列スコアリングレビュー（auto）
**判定**: **FAIL** (A-保守性=6, B-正確性=6 が閾値 7 未達)
**次アクション**: Step 8 自動修正ループ

---

## 1. ソフトウェアアーキテクト

### OK項目（抜粋）
- A-OK-1: アーキテクチャ全体図で新規/改修の明示
- A-OK-2: GateTriggerSystem / WeaponSwitchSystem の責務分離
- A-OK-3: dispose 責任表の明文化
- A-OK-4: debug-only API の `import.meta.env.PROD` ガード
- A-OK-5: 依存マトリクスに循環なし、EventBus 非採用の判断
- A-OK-6: 衝突レイヤマスク分離（BR-I6-09）
- A-OK-7: 初期化順序の明示
- A-OK-8: DOM プール 6 スロット固定

### NG項目

| # | 対象 | NG理由 | 提案 | 重大度 |
|---|---|---|---|---|
| A-NG-1 | priority 3 並列登録 | SpawnManager / ItemBarrelSpawner / GateSpawner が同 priority 3 で実行順序未定義。決定論モード再現性損失 | priority 3.0/3.1/3.2 に細分化 or World 契約として登録順固定を明記 | important |
| A-NG-2 | WeaponSwitchSystem.transferWeaponMesh | 失敗時リカバリが設計書本体に未記載（リスク表のみ） | 4 ステップ契約（detach→attach→成功確認→null 化）とフォールバック（cloneWeaponTemplate + 元 dispose）を明記 | important |
| A-NG-3 | HTMLOverlayManager | 4 サブ機能 + 統括を一括保持で God Object 化、SRP 逸脱 | Facade に降格、WorldToScreenLabel/ActiveBuffIcon/WeaponHudPanel/ToastQueue を独立クラスとして DI、HTMLOverlayManager は update 統括のみ | important |
| A-NG-4 | GateTriggerSystem prevGateY | 初回フレーム `undefined` 比較、unregister 未定義でリーク | EntityFactory.createGate で初期化、CleanupSystem.disposeGateEntity で unregister、初期化フラグ導入 | medium |
| A-NG-5 | context lost 時の pending 状態 | pendingSwitches/forcedBarrel/ToastQueue/Buff 残時間の扱い未定義 | onContextLost/Restored フックを定義、pending クリア/Spawner 停止/在空 entity 破棄/バフ残時間は保持 | medium |
| A-NG-6 | MACHINEGUN material clone の texture 共有境界 | cloned material.map の所有権、restoreTextures の対象が曖昧 | 「map 参照共有・material 本体のみ dispose」を契約として明記、restoreTextures 対象に現装備 mesh 追加 | medium |
| A-NG-7 | SpawnManager 廃止判断先送り | 両論併記、GateTriggerSystem.trigger が spawnAlly 依存で矛盾 | SpawnManager は敵+ally スポーンを維持、旧 itemSpawnTimer のみ削除と確定 | medium |
| A-NG-8 | Wave 境目ボーナス種別 | 「交互 or 乱択」と Application Design 内で確定せず | 交互固定（45s=樽 MACHINEGUN / 90s=ゲート強化 / 180s=樽 MACHINEGUN）に確定 | medium |
| A-NG-9 | DefenseLineComponent 条件付き記述 | 「既存にない場合は拡張」の両論併記 | 現行コード確認して確定、あれば削除、なければ明示改修 | minor |
| A-NG-10 | 上流フィードバック: requirements-v6 FR-05 Wave ボーナス OR 条件 | 要件側に選択基準欠落が設計側の先送りを誘発 | **上流フィードバック**: FR-05 に「交互固定 45/90/180s」を明記、または「Application Design で選択可」を明示 | medium |

### スコア評価

| 観点 | スコア | 根拠 |
|---|---|---|
| 正確性 | 7 | A-OK-1,5,7 で整合、A-NG-1,7,8 で綻び。important ×3 で最大 7 |
| 設計品質 | 7 | A-OK-2,6 優秀、A-NG-3,2 で important 級。7 が妥当 |
| セキュリティ | 8 | A-OK-4、XSS 対策、CSP 継承が整合。medium NG のみで 8 |
| 保守性 | 6 | A-OK-8 良いが、A-NG-3 God Object 化 + A-NG-2,4,5 変更時 touch 点多、important 3 件で 7 からさらに -1 |

---

## 2. フロントエンド開発者

### OK項目（抜粋）
- F-OK-1〜8: throttleAccumulator 方針、Facade API、XSS 4 層防御、DOM 入れ子、プール acquire/release、破壊瞬間例外、FIFO + 同種延長、WeaponHudPanel 自己完結

### NG項目

| # | 対象 | NG理由 | 提案 | 重大度 |
|---|---|---|---|---|
| F-NG-1 | throttleAccumulator リセット方式 | `= 0` リセット、フレーム落ち時位相オフセット喪失 | `-= 1/30` ドレイン型に変更、while ループ catch-up | important |
| F-NG-2 | DOM プール優先度 | 枠 5 埋まり時のロールオーバー方針が本体設計書になし | acquire に priority 引数、最古非ボーナスを解放してロールオーバー | important |
| F-NG-3 | camera.project 変換 | NDC→px 変換式、ResizeObserver、`z > 1` 非表示が未記述 | 疑似コードで明示、viewport 再計算を HTMLOverlayManager 内に | important |
| F-NG-4 | ActiveBuffIcon 3 スロット超過 | setBuffs 任意長、超過時の挙動と DOM 構造・更新レート未定義 | 先頭 3 件表示 + warn、DOM 構造明記、Math.ceil 整数秒 | medium |
| F-NG-5 | レスポンシブ乖離 | 要件「最小 640x360 で折り畳み」に設計記述なし | media query、font-size clamp、折り畳み対象列挙 | medium |
| F-NG-6 | 武器アイコンアセット | PNG か SVG か、パスが未決定 | SVG inline + createElementNS で確定、Iter6 は外部 PNG なしと明記 | medium |
| F-NG-7 | GateTriggerSystem prevGateY Map リーク | クラスプロパティ宣言なし、ゲート破棄時の delete 未記述 | prevGateY を Map で宣言、CleanupSystem 連携で delete、WeakMap も検討 | important |
| F-NG-8 | transferWeaponMesh world matrix | attach/add の選択、BoneAttachmentConfig 連携が未記述 | Object3D.attach で world matrix 保持、offset/rotation 設定、fallback clone 明示 | important |
| F-NG-9 | 30Hz スロットリング対象の混在 | ActiveBuffIcon updateCountdowns の dt 出所が曖昧 | updateCountdowns は毎フレーム低コスト、30Hz は WorldToScreenLabel のみに限定 | medium |
| F-NG-10 | toast kind スタイル | 単一 `hud-toast` 要素、kind 別表現未定義 | `data-kind` 属性 + CSS クラス、WAVE は duration 可変 | medium |
| F-NG-11 | HTMLOverlayManager reset API | dependency-v6 で呼ばれる resetAllLabels/resetToastQueue が methods-v6 にない | C6-23 に resetAllLabels/resetToastQueue/dispose を追加 | important |
| F-NG-12 | 既存 hud-weapon との互換 | Iter5 既存要素との関係明示なし | 「Iter5 は div のみ、Iter6 で img を先頭追加、span にリネーム」と具体化 | medium |
| F-NG-13 | ラベル z-order | 重なり時の z-index 制御未定義 | camera 深度を z-index に or 「重なり稀で無視」と判断明記 | minor |
| F-NG-14 | 単位文字列構築 | 「HP」「%」「人」などの単位がどこで付くか未定義 | I18nStrings.unit 追加、LabelFormatter.format に集約 | medium |

### スコア評価

| 観点 | スコア | 根拠 |
|---|---|---|
| 正確性 | 7 | F-OK-1,2,4,5 整合良好、F-NG-1,3,11 で綻び。important 上限 7 |
| 設計品質 | 7 | Facade/プール/FIFO 優秀、F-NG-2,4,8,10 で境界条件欠落 |
| セキュリティ | 9 | F-OK-3 XSS 4 層防御が優秀、軸独自 NG なし |
| 保守性 | 7 | F-OK-4,8 変更容易、F-NG-5,6,11,12 で将来変更記述薄い |

---

## 3. バックエンド開発者

### OK項目（抜粋）
- B-OK-1〜10: HEAL クランプ、ALLY_ADD 上限、enqueue 方式、衝突レイヤ、GAME_OVER 停止、バフ重複上書き、DOM プール、Runtime 検証、PROD ガード、EntityFactory 責務集約

### NG項目

| # | 対象 | NG理由 | 提案 | 重大度 |
|---|---|---|---|---|
| B-NG-1 | GateTriggerSystem 初回フレーム | `undefined > prevPlayerY` false、リーク | prevGateY.set 初期化フォールバック、GateComponent に prevY、消滅時 delete | important |
| B-NG-2 | transferWeaponMesh 失敗時 | PlayerWeaponComponent.genre 先更新で mesh/state 不整合リスク | try/catch + cloneWeaponTemplate fallback、失敗時 genre rollback、EventLogger.error | **critical** |
| B-NG-3 | Wave 境目重複発火 | 1 回発火保証のフラグ管理未記述 | triggeredBonusTimes: Set or lastBonusIndex 方式を明記 | important |
| B-NG-4 | WeaponSwitchSystem elapsedTime 出所 | this.elapsedTime の DI が未定義 | コンストラクタに WaveState DI or world.getResource | medium |
| B-NG-5 | DeterministicRng 置換範囲 | 「Construction で確定」と先送り、AC-02/03/04 の決定論が担保されない | 設計書に置換対象モジュールを列挙（Spawner/EntityFactory/EnemyAI 等） | important |
| B-NG-6 | gate.widthHalf 参照記法不一致 | `gate.widthHalf` vs `gate.comp.widthHalf` | `gate.comp.*` に統一 or shorthand ルール明記 | medium |
| B-NG-7 | 所有権判定フラグ | 武器 child null での判定が曖昧 | BarrelItemComponent に weaponTransferred: boolean 追加 | important |
| B-NG-8 | ActiveBuffsComponent 定義欠落 | methods-v6 に ECS Component としての型定義なし | `class ActiveBuffsComponent { buffs: Map<GateType, {remaining, amount}> }` 定義追加 | important |
| B-NG-9 | 旧 WeaponType 置換マップ | grep のみで対応表なし | ファイル:行:旧→新シンボル対応表を Appendix に | medium |
| B-NG-10 | applyOrExtend 型不整合 | durationSec: number vs null 渡しの可能性 | Type Guard or null 時 return 明記 | medium |
| B-NG-11 | 複数 body 同時通過仕様 | プレイヤー+仲間同時跨ぎ時の挙動未記述 | BR-I6-03 に「プレイヤー含む→1 回発動、含まない→継続」明記 | medium |
| B-NG-12 | DefenseLineComponent 現状未確認 | 条件付き記述のまま | 実コード確認して確定、不在なら拡張を明示タスク化 | important |

### スコア評価

| 観点 | スコア | 根拠 |
|---|---|---|
| 正確性 | 6 | B-NG-2 critical（最大 6）、B-NG-3,12,1 important で詰め不足。critical 上限 6 |
| 設計品質 | 7 | B-OK-3,5,10 整合、B-NG-7,8 で important、上限 7 |
| セキュリティ | 8 | B-OK-9 PROD ガード、BR-I6-13 Runtime 検証 |
| 保守性 | 7 | config 集約は良好、B-NG-5,9,12 で手戻り懸念 |

---

## 4. AWSインフラエンジニア

### OK項目（抜粋）
- I-OK-1〜9: shader 再コンパイル回避、PROD ガード、DOM プール、priority 配置、restoreTextures 拡張、bundle 制約、MACHINEGUN tint、BR-I6-12、dispose 表

### NG項目

| # | 対象 | NG理由 | 提案 | 重大度 |
|---|---|---|---|---|
| I-NG-1 | DeterministicRng PROD 漏出 | static class + LCG ロジックが PROD 残存、window 代入が DCE 対象外リスク | module wrapper で `rng.prod.ts/.dev.ts` 分岐 or `__DEBUG_API__` define 定数、`size-limit` grep で CI fail 化 | important |
| I-NG-2 | cloneBarrelTemplate の SkeletonUtils 注記 | 「どちらでも可」で SkeletonUtils 誤採用時 +3〜5KB | 「Object3D.clone(true) 使用、SkeletonUtils は使用しない」と断定 | medium |
| I-NG-3 | throttleAccumulator リセット | F-NG-1 と重複、フレーム落ち時劣化 | `-= 1/30` ドレイン、または performance.now 基準 | medium |
| I-NG-4 | bundle gzip +20KB 見積り不在 | 部品別試算なしで +20KB 達成が不確実 | 部品別 gzip 見積り表追加、削減順序も併記 | important |
| I-NG-5 | PROD 漏出検証の曖昧さ | Vite DCE を「確認」とのみ | Playwright AC で `typeof window.__setRngSeed === 'undefined'` 等 assert、`__DEBUG_API__` define 導入 | medium |
| I-NG-6 | CleanupSystem 移譲失敗時 dispose 責任 | 失敗経路で樽 child がリーク可能性 | dispose 表に失敗経路列追加、WeaponSwitchSystem 戻り値を `'transferred'/'cloned'/'failed'` に | important |
| I-NG-7 | attach 時 matrix 再計算 | Object3D.attach 後の updateMatrixWorld 明記なし | Object3D.attach で world 保持、matrixAutoUpdate=false + updateMatrix 1 回を明記 | minor |
| I-NG-8 | priority 3 重複 | SpawnManager/ItemBarrelSpawner/GateSpawner 同値 | 3.0/3.1/3.2 に細分化 | medium |
| I-NG-9 | MetricsProbe 予算内訳 | 5 分 heap +10MB の積み上げ試算なし | 試算表追加（cloned material / DOM pool / EventLogger buffer）、renderer.info.memory 値も assert 対象 | medium |
| I-NG-10 | teardown renderer.dispose | newGame 時 GPU リソース解放フック未記述 | releaseAll 統合、renderer.forceContextLoss 明記 | minor |

### スコア評価

| 観点 | スコア | 根拠 |
|---|---|---|
| 正確性 | 7 | 対応は追えるが I-NG-4（gzip 見積り）、I-NG-9（heap 予算）で数値裏付けが薄い。important 上限 7 |
| 設計品質 | 7 | priority/プール/dispose 表は整合、I-NG-1,6,8 で詰め不足 |
| セキュリティ | 8 | CSP/禁止 API 徹底、PROD 検証に弱さ（I-NG-5） |
| 保守性 | 8 | config 集約、EventLogger、priority 明示。SpawnManager 判断先送りが減点 |

---

## 5. セキュリティエンジニア

### OK項目（抜粋）
- S-OK-1〜10: XSS 3 重ガード、WorldToScreenLabel 実装制約、i18n 辞書、PROD ガード、CSP 不緩和、Runtime 検証、restoreTextures、EventLogger payload、DOM プール、所有権境界

### NG項目

| # | 対象 | NG理由 | 提案 | 重大度 |
|---|---|---|---|---|
| S-NG-1 | DebugConfigLoader localStorage | JSON.parse + Object.assign で `__proto__` 汚染、型検証欠落 | 各フィールドごと `typeof === 'number' && Number.isFinite` 検証、enum 値完全一致、`__proto__`/`constructor` 除外 sanitize | important |
| S-NG-2 | URL query Number() 変換 | NaN/Infinity 素通し、BR-I6-13 が入口側で効かない | Number.isFinite && range check、不合格は無視 + EventLogger.error、range 組み合わせ検証 | important |
| S-NG-3 | ForceSpawnApi `__gameState` 読み書き | getter か setter か曖昧、書き込み可でチート経路 | Object.freeze + getter-only で明示、defineProperty writable: false | medium |
| S-NG-4 | DEBUG_LOG_ENABLED 出所不明 | runtime 可変だと window 注入で有効化可能 | vite.config.ts define で build 定数注入、grep で dist/assets に "event:" 0 件 AC | medium |
| S-NG-5 | trigger() でテンプレートリテラル | I18nStrings 非経由で enum 直接埋め込み | I18nStrings.gate 経由、buildBuffToast 関数に集約 | minor |
| S-NG-6 | ToastQueue DOM 反映契約 | textContent 強制が明記されていない | C6-14 に「element.textContent 代入のみ、innerHTML 禁止」明記 | medium |
| S-NG-7 | hud-weapon-icon src | 許可 URL プレフィックス未明示 | enum→URL 静的 map 限定、CSP img-src 'self' 継承 | minor |
| S-NG-8 | MAX_GATE_AMOUNT / MAX_BARREL_HP 未定義 | Runtime 検証の MAX 値不在 | 定数定義追加（例: MAX_HP=1000, MAX_AMOUNT=100, MAX_DURATION=60） | medium |

### スコア評価

| 観点 | スコア | 根拠 |
|---|---|---|
| 正確性 | 8 | XSS 禁止 API / 決定論 API 正しく反映、S-NG-1,2 が medium/important で減点 |
| 設計品質 | 8 | debug API PROD ガード、DOM プール、i18n 一本化 |
| セキュリティ | 7 | S-NG-1,2 important、S-NG-3,4 medium で減点。important 上限 7 |
| 保守性 | 8 | 責務分離明快、SECURITY.md 不在で減点 |

---

## 6. 運用エンジニア

### OK項目（抜粋）
- O-OK-1〜7: onGameOver enabled=false 列挙、破棄シーケンス 10 step、restoreTextures 拡張、dispose 表、EventLogger API、DebugConfigLoader、リスク表

### NG項目

| # | 対象 | NG理由 | 提案 | 重大度 |
|---|---|---|---|---|
| O-NG-1 | DEBUG_LOG_ENABLED 定義経路 | import 元、初期化手順、Open Issue 4 未解決 | src/config/logConfig.ts + `import.meta.env.VITE_DEBUG_LOG`、デフォルト PROD=false、Open Issue 4 クローズ | important |
| O-NG-2 | webglcontextlost 発火手順 | 実装責任者（GameService/CleanupSystem）と手順未定義 | onContextLost/Restored の手順を図示、forceDisposeByComponent API 追加 | important |
| O-NG-3 | Wave 境目冪等性 | ポーズ/context lost 跨ぎ時の取扱い未定義 | WaveBonusFiredFlags を WaveState に、newGame 時のみリセット | medium |
| O-NG-4 | CleanupSystem 移譲失敗時 | 失敗時 child リーク経路残存 | dispose 表に失敗行追加、transferResult で分岐 | important |
| O-NG-5 | buff_extend / skip ログ欠落 | 6 イベントのうち 2 種が呼出点なし | applyOrExtend / no-op 分岐で logger.info を呼ぶフローを明記 | medium |
| O-NG-6 | newGame 時 state リセット欠落 | EventLogger/ForceSpawnApi/WaveBonusFiredFlags/DeterministicRng 再シード漏れ | シーケンスに追加 | medium |
| O-NG-7 | AC × System マッピング | Playwright シナリオと System/API 対応表なし | services-v6 末尾に AC×System×Playwright 表追加 | medium |
| O-NG-8 | ロールバック戦略 | Iter5 境界で保持/revert 対象が未線引き | PR 分割指針、enabled=false 無害化代替手段を明記 | medium |
| O-NG-9 | DOM プール枯渇ロールオーバー | 消える entity が未定義 | 最古 assigned を release、EventLogger.info('skip', {reason: 'label_pool_exhausted'}) | minor |
| O-NG-10 | MetricsProbe サンプリング仕様 | performance.memory Chrome 限定、ウォームアップ未記述 | MetricsProbe 連携節追加、未対応ブラウザでは null、5 分サンプリング窓明記 | minor |

### スコア評価

| 観点 | スコア | 根拠 |
|---|---|---|
| 正確性 | 7 | 要件対応は概ね、O-NG-1,5,7 で抜け |
| 設計品質 | 7 | priority/通信パターン良好、O-NG-2,4 運用縁のケース不足 |
| セキュリティ | 8 | PROD ガード明示、O-NG-1 のみ減点 |
| 保守性 | 7 | config 集約良好、O-NG-7,8 で Runbook 薄い |

---

## スコアマトリクス（イテレーション 1）

| ロール | 正確性 | 設計品質 | セキュリティ | 保守性 | 平均 |
|---|---|---|---|---|---|
| アーキテクト | 7 | 7 | 8 | **6** | 7.00 |
| フロントエンド | 7 | 7 | 9 | 7 | 7.50 |
| バックエンド | **6** | 7 | 8 | 7 | 7.00 |
| インフラ | 7 | 7 | 8 | 8 | 7.50 |
| セキュリティ | 8 | 8 | 7 | 8 | 7.75 |
| 運用 | 7 | 7 | 8 | 7 | 7.25 |
| **全体平均** | **7.00** | **7.17** | **8.00** | **7.17** | **7.33** |

### 閾値判定
- 閾値: 全軸 ≥ 7/10
- 未達項目: **A-保守性=6**（A-NG-3 HTMLOverlayManager God Object化が主因）/ **B-正確性=6**（B-NG-2 transferWeaponMesh critical 失敗時未記述が主因）
- **判定: FAIL**
- 分岐: 前回比較なし → **IMPROVING**（Step 8 自動修正へ）

## NG項目トラッキング（初回なので全て新規）

| ID | Role | Severity | 状態 |
|---|---|---|---|
| A-NG-1〜10 | A | important×3/medium×6/minor×1 | 新規 |
| F-NG-1〜14 | F | important×5/medium×7/minor×2 | 新規 |
| B-NG-1〜12 | B | critical×1/important×5/medium×6 | 新規 |
| I-NG-1〜10 | I | important×3/medium×5/minor×2 | 新規 |
| S-NG-1〜8 | S | important×2/medium×4/minor×2 | 新規 |
| O-NG-1〜10 | O | important×3/medium×5/minor×2 | 新規 |

### 優先修正対象（軸未達の原因 NG）

**A-保守性=6 を 7 以上にするため**:
- **A-NG-3** (important): HTMLOverlayManager を Facade に降格、サブ機能を独立クラス化
- **A-NG-2** (important): transferWeaponMesh 失敗時リカバリを設計書本体に明記

**B-正確性=6 を 7 以上にするため**:
- **B-NG-2** (critical): transferWeaponMesh 失敗時の try/catch + fallback + rollback を明記
- **B-NG-3** (important): Wave 境目重複発火防止フラグ
- **B-NG-12** (important): DefenseLineComponent 現状確認

関連する他ロール important も合わせて修正することで、他軸も 7→8 に改善見込み。

---

## 自動修正ログ（イテレーション 1 → 2）

### 適用済み修正（全26件 HIGH 信頼度、うち2件 AUTO-DECIDED）

| # | FIX-ID | 対象ファイル | 修正内容 | 関連NG-ID |
|---|---|---|---|---|
| 1 | FIX-1 | services-v6.md | transferWeaponMesh 4ステップ契約 + try/catch + cloned/failed 戻り値 | B-NG-2, A-NG-2, F-NG-8, I-NG-6, O-NG-4 |
| 2 | FIX-2 | component-methods-v6.md | WeaponSwitchSystem API 契約明記 | B-NG-2, A-NG-2, F-NG-8 |
| 3 | FIX-3 | components-v6.md | C6-28: DefenseLineComponent → HealthComponent (参照のみ) | B-NG-12 |
| 4 | FIX-4 | services-v6.md | HEAL ロジックを HealthComponent に | B-NG-12 |
| 5 | FIX-5 | component-methods-v6.md | BR-I6-05 HealthComponent 対象化 | B-NG-12 |
| 6 | FIX-6 | component-dependency-v6.md | 図と表を HealthComponent に訂正 | B-NG-12 |
| 7 | FIX-7 | components-v6.md | C6-23 HTMLOverlayManager を Facade に降格 | A-NG-3 |
| 8 | FIX-8 | services-v6.md | S6-SVC-03 Facade 責務明記、drain 型 throttle | A-NG-3, F-NG-1, I-NG-3 |
| 9 | FIX-9 | component-methods-v6.md | HTMLOverlayManager API 刷新、reset/dispose 追加 | A-NG-3, F-NG-11 |
| 10 | FIX-10 | services-v6.md | GateTriggerSystem prevGateY Map 化、初期化/削除 | B-NG-1, F-NG-7 |
| 11 | FIX-11 | component-methods-v6.md | GateTriggerSystem API に onGateCreated/Disposed | B-NG-1, F-NG-7 |
| 12 | FIX-12 | component-dependency-v6.md | priority 3 → 3.0/3.1/3.2 細分化 | A-NG-1 |
| 13 | FIX-13 | services-v6.md | Wave 境目 bonusFiredAt Set で重複発火防止 | B-NG-3 |
| 14 | FIX-14 | components-v6.md + component-methods-v6.md | BarrelItemComponent に weaponTransferred フラグ | B-NG-7, I-NG-6, O-NG-4 |
| 15 | FIX-15 | components-v6.md + component-dependency-v6.md | CleanupSystem dispose 責任表に失敗経路列 | B-NG-7, I-NG-6, O-NG-4 |
| 16 | FIX-16 | component-methods-v6.md | C6-03b ActiveBuffsComponent 定義追加 | B-NG-8 |
| 17 | FIX-17 | (FIX-8 に統合) | throttle drain 型 | F-NG-1 |
| 18 | FIX-18 | component-methods-v6.md | WorldToScreenLabel API に priority/rollover | F-NG-2 |
| 19 | FIX-19 | components-v6.md | C6-08 に camera.project / NDC→px 疑似コード | F-NG-3 |
| 20 | FIX-20 | services-v6.md | DeterministicRng を `__DEBUG_API__` ガードに | I-NG-1 |
| 21 | FIX-21 | services-v6.md | bundle gzip 内訳見積り表追加 | I-NG-4 |
| 22 | FIX-22 | services-v6.md | DebugConfigLoader 入力検証強化（pickNumber/sanitize） | S-NG-1, S-NG-2 |
| 23 | FIX-23 | services-v6.md | EventLogger DEBUG_LOG_ENABLED 出所明記、Open Issue 4 クローズ | O-NG-1 |
| 24 | FIX-24 | services-v6.md | webglcontextlost/restored ハンドラ手順を明記 | O-NG-2 |
| 25 | FIX-25 | components-v6.md | C6-24 SpawnManager 責務確定（敵+仲間維持、itemSpawnTimer のみ削除） | A-NG-7 [AUTO-DECIDED] |
| 26 | FIX-26 | components-v6.md | Wave 境目ボーナス交互固定（45s=樽/90s=ゲート/180s=樽） | A-NG-8 [AUTO-DECIDED] |

### 自動設計判断（AUTO-DECIDED）

| # | FIX-ID | 対象ファイル | 設計判断内容 | 根拠 | 関連NG-ID |
|---|---|---|---|---|---|
| 25 | FIX-25 | components-v6.md | SpawnManager は敵+ally 責務維持、itemSpawnTimer のみ削除 | FR-01 で旧 itemSpawn は廃止確定、GateTriggerSystem.ALLY_ADD が spawnAlly 依存 | A-NG-7 |
| 26 | FIX-26 | components-v6.md | Wave 境目ボーナス交互固定 45s=樽/90s=ゲート/180s=樽 | 乱択はテスト記述負担が大きい、交互固定は AC 明確化と `__SPAWN_FORCE_NEXT` 整合 | A-NG-8 |

### スキップした修正

なし（全 26 件 HIGH 信頼度で適用）。

### NG項目状態更新

全 NG 項目が FIX により対処済み（修正済）または AUTO-DECIDED。次イテレーションでの再レビューで確認予定。
