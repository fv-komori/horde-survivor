# 設計自動レビュー iter2 - ロールB（ECS System / TS）

**対象**: aidlc-docs/inception/application-design/ v5 シリーズ（iter1-fixes 適用後）
**上流**: aidlc-docs/inception/requirements/requirements-v5.md
**レビュー日**: 2026-04-17
**レビュアロール**: B / ECS System / TypeScript

---

## スコアマトリクス

| 観点 | 正確性 | 設計品質 | セキュリティ | 保守性 | 平均 |
|---|---|---|---|---|---|
| ロールB | 7 | 7 | 8 | 7 | 7.25 |

**閾値判定**: 全項目7以上で **PASS**（閾値=7）。ただし iter1 の B-MID-05（スコア加算タイミング）と新規 B-iter2-01（linger消化ロジックの重複記述）に要対処。

---

## 1. 前回指摘（iter1）の解消確認

| ID | 指摘 | FIX | iter2 状態 | 判定 |
|---|---|---|---|---|
| B-HIGH-01 | Death完了後 linger 時間不在 | FIX-H | requirements FR-04 に 0.3秒 明記、DeathCompleteFlag.linger=0.3、CleanupSystem 追加実装に linger 消化ロジック記述 | **一部OK**（B-iter2-01 参照） |
| B-HIGH-02 | HitReact 復帰ロジック未定 | FIX-F | component-methods-v5 C-02 に hitReactTimer 自動復帰、finished 不使用、clampWhenFinished=false 明記、HITREACT_DURATION=0.4 定数化 | **OK** |
| B-HIGH-03 | 初回フレーム Idle_Shoot.play() 起動経路 | FIX-G | setupAnimations 末尾に `actions.get('Idle_Shoot')?.play()` 明記、AnimationStateComponent.currentClip='Idle_Shoot' と整合 | **OK** |
| B-MID-04 | Gun material clone 責任不在 | FIX-I | attachGun 内で gunMesh.traverse → material 個別 clone、FACTORY_BONE_NOT_FOUND エラー固定ID+cause 明記 | **OK** |
| B-MID-05 | スコア加算タイミング不明 | 明示追記 | **未解消**（components-v5, methods-v5, services-v5 いずれにも記述なし）。既存 CollisionSystem の撃破キュー→ScoreService.incrementKills 経路が Iter5 で HealthSystem deathFlag セット方式に変わるため、incrementKills 呼出位置が不明確 | **NG継続** |
| B-MID-06 | mini-renderer 独立性 | FIX-S | GameStartScreen で独自 requestAnimationFrame + mixer.update 直接呼び出し、cloneMaterialsRecursive で material 独立 clone、disposePreview 具体化、二重生成ガード追加 | **OK** |
| B-LOW-07 | VELOCITY_THRESHOLD_SQ 未定義 | FIX-K | `const VELOCITY_THRESHOLD_SQ = 0.01;` 明記、ヒステリシス案コメント化 | **OK** |
| B-LOW-08 | AssetManager getter での assert 追加推奨 | - | **未対応**。getCharacter/getGun/getEnvironment の実装本文で未ロード時の throw が記述されていない（C-01 methods）。EntityFactory constructor の assert のみ | **NG継続**（Low）|
| B-LOW-09 | teardown optional chain | FIX-P | services-v5 S-SVC-01 teardown コメントに「全フィールドに optional chain でアクセス」明記、逆順 dispose 順序も明示 | **OK** |
| B-LOW-10 | updateStandalone | FIX-S | methods-v5 C-02 末尾に「updateStandalone は削除。GameStartScreen は直接 mixer.update を呼ぶ」明記、components-v5 C-02 § mini-renderer 節でも重複確認 | **OK** |

小計: 8件 OK / 2件 NG継続（B-MID-05, B-LOW-08）。

---

## 2. 新規観点での確認

### 2.1 System priority 確定値での実行順序妥当性

確定値（FIX-J）:

| priority | System |
|---|---|
| 10 | CombatSystem |
| 15 | HealthSystem |
| 20 | MovementSystem |
| 25 | AISystem |
| 30 | SpawnSystem |
| 35 | WeaponSystem |
| 50 | AnimationSystem |
| 55 | CleanupSystem |
| 60 | ThreeJSRenderSystem |

**OK点**:
- CombatSystem(10)→HealthSystem(15): ダメージ確定→HP減算→deathFlagセットが同フレームで完結
- HealthSystem(15)→AnimationSystem(50): 同フレーム内でdeathFlag読み取り可能、Deathアニメ遷移が1フレーム遅延なし
- AnimationSystem(50)→CleanupSystem(55): DeathCompleteFlag 付与→消化が同フレーム内
- CleanupSystem(55)→ThreeJSRenderSystem(60): dispose後にレンダリングで「消えたentity残像」を防止

**B-iter2-02（MINOR）**: MovementSystem(20) は CombatSystem(10)/HealthSystem(15) の後に配置されているが、VelocityComponent 書込タイミングの設計が明示されていない。AnimationSystem(50) は VelocityComponent を読み取って Run_Shoot/Idle_Shoot 判定するため、MovementSystem(20) が velocity 適用と同時に VelocityComponent を更新すれば整合するが、InputSystem や AISystem が velocity を書き込むタイミングが不明。現状のv5設計ではおそらく AISystem(25) が書込、MovementSystem(20) が位置適用という暗黙構造と推測されるが、設計書に明示されていない。

**B-iter2-03（MINOR）**: SpawnSystem(30) で生成された新規entityに対し、同フレームの AnimationSystem(50) が即 mixer.update を走らせる経路が確認できる。これは OK だが、生成直後の entity で `currentClip='Idle_Shoot'` かつ play() 済（FIX-G）のため mixer.update(0) にならず **1フレーム目の dt がゲームループ dt と同値** となる点がやや不自然。初回 mixer.update は dt=0 相当の扱いにする等の注記があると堅牢。

### 2.2 DeathCompleteFlag linger の CleanupSystem 消化フロー

**B-iter2-01（HIGH）**: CleanupSystem の本体 update() と追加実装セクションが矛盾:

- 本体（component-methods-v5.md 401〜408行）:
  ```ts
  update(world, dt) {
    for (const entity of world.query(DeathCompleteFlag)) {
      this.processDeath(world, entity);  // 即 dispose（linger 考慮なし）
    }
  }
  ```
- 追加実装（745〜754行）:
  ```ts
  for (const entity of world.query(DeathCompleteFlag)) {
    const flag = entity.get(DeathCompleteFlag);
    flag.linger -= dt;
    if (flag.linger <= 0) this.processDeath(world, entity);
  }
  ```

現状の本体コードは linger を無視して即 dispose する実装になっており、requirements-v5 FR-04 の「linger=0.3秒保持」仕様を満たさない。**本体の update() 実装を追加実装セクション側で上書き・統合する必要がある**。Construction 時にどちらが正か判断が分かれ、B-HIGH-01 の目的（死体 0.3秒滞留）が再発するリスクがある。

**推奨修正**: CleanupSystem.update() 本体を以下のように統合した単一記述にする:
```ts
update(world: World, dt: number): void {
  for (const entity of world.query(DeathCompleteFlag)) {
    const flag = entity.get(DeathCompleteFlag);
    flag.linger -= dt;
    if (flag.linger <= 0) {
      this.processDeath(world, entity);
    }
  }
  // 画面外弾丸等の既存削除処理
}
```
そして「追加実装」セクションの重複は削除。

**B-iter2-04（MINOR）**: linger 消化中（flag.linger > 0 の 0.3秒間）も mixer.update は走り続ける（AnimationSystem 側で `if (!mesh.mixer) continue` を通過し、clampWhenFinished=true により実質静止）。この間に同 entity が別フレームで再度 CombatSystem のダメージ判定対象にならないかは HealthSystem 側のガードに依存する。現行 HealthSystem 改修（C-09）には「HP<=0 で deathFlag=true セット後、次フレーム以降のHP減算は無視する」などのガードが書かれていない。Death→DeathCompleteFlag 付与後 linger 期間中にダメージを受けると hitReactTimer が書き込まれ得るが、CombatSystem 追加実装（C-08 / B-MID-05 対応メモ）で `if (anim && !anim.deathFlag)` ガードが追加済なので実害なし。**ただしこのガードは CombatSystem 本体（C-08 485〜488行）には記述がなく、「CombatSystem: deathFlag ガード」追加実装セクション（759〜765行）のみ**。C-07 と同じ重複記述問題。

### 2.3 forceDisposeAll の責務妥当性

**OK点**:
- CleanupSystem.forceDisposeAll(world) として API 公開（C-07 442〜462行）
- teardown 時に finishedListener 解除・mixer 停止・uncache・disposeDeep を全entityに適用
- services-v5 S-SVC-01 teardown シーケンスから呼ばれる責任分解が明確

**B-iter2-05（MINOR）**: forceDisposeAll は world.allEntities() を走査するが、**通常 dispose 経路と共通化されていない**。processDeath と forceDisposeAll で「finishedListener 解除 → mixer 停止 → uncache → disposeDeep」の4ステップが重複実装されており、保守コストが高い。private helper（例: `disposeEntityResources(entity)`）に抽出する方針をメモで残すのが望ましい。

**B-iter2-06（MINOR）**: forceDisposeAll 内では DeathCompleteFlag チェックをせず全 entity を dispose するが、teardown 時にゲームオブジェクト（弾丸・ピックアップ・環境mesh・Player本人）も巻き込む前提で正しい。ただし「AssetManager が保持する template scene」は world に属さないため dispose 対象外、という責務境界の確認が services-v5 S-SVC-01（「AssetManager は保持、dispose禁止」）と整合。**OK だが、環境mesh は SceneManager が直接 scene.add しており、world.allEntities() 経由では dispose されない** 点に注意。teardown 時の SceneManager.dispose() 内部実装が services-v5 で `SceneManager.dispose()`（環境GLTF配置解除）と記述されているのみで、設計書には具体化されていない。Construction で漏れる可能性あり。

### 2.4 MetricsProbe の ECS 連携

**OK点**:
- C-15 で独立コンポーネント、Scope は GameService から start()/stop() を呼ぶのみ
- ECSに侵入せず、console.info 出力に限定
- Chrome 限定（`performance.memory` 存在チェック）、他ブラウザ noop
- services-v5 S-SVC-08 で GameService 経路明記

**B-iter2-07（MINOR）**: MetricsProbe は「起動時と5分後の heap差分」のみ計測する単発タイマー方式。NFR-07 の許容基準（+20MB/5分）との比較判定はコード側で行わず console ログのみ。**CI/自動テストで pass/fail 判定に使えない**。「手動運用でリリース前30分プレイチェックリスト」（components-v5 リスク表）と併用前提のため、運用ドキュメント側の整備が追加必要。

**B-iter2-08（MINOR）**: MetricsProbe.snapshot() は 5分後に1回だけ。ゲーム途中で pause/resume/設定画面など heap 挙動が変わるシナリオで単発計測は弱い。**improvement**: 1分間隔で複数回スナップショット取り、最大値を記録する方式が望ましい（Iter6 以降の改善候補）。

---

## 3. その他観点の追加確認

### 3.1 finishedListener 二重管理の検証

FIX-E により transitionTo 冒頭で removeEventListener → finishedListener=null、forceDispose 経路でも removeEventListener 実施。

- **OK**: methods-v5 C-02 transitionTo 127〜132行、processDeath 410〜417行、forceDisposeAll 445〜450行 の3経路すべてで解除ガード有り。
- **B-iter2-09（MINOR）**: handler 内で `mixer.removeEventListener('finished', handler)` を実行した直後に `anim.finishedListener = null;` が続く（141〜148行）。**handler 関数が mixer に参照保持されていた状態の解放のみで、anim.finishedListener への代入はthrough**。現状ロジックで問題はないが、handler 内と外で2経路 remove があると、handler 実行後に再度 transitionTo で remove が走ると「存在しない listener の remove」で Three.js 側 no-op（実害なし）。これはコメント補記があると明快。

### 3.2 HitReact clampWhenFinished=false の副作用

**OK点**: FIX-F で clampWhenFinished=false 明記、理由「終了時 weight=0 に戻し次遷移の crossFade 問題を防ぐ」と記載。

**B-iter2-10（MINOR）**: HitReact 再生中に hitReactTimer=0.4 が途中で再度ダメージで 0.4 に上書きされた場合、action の再生ヘッドは進んだままで LoopOnce のため既に終了した可能性がある。**action.reset() の再呼び出し経路が transitionTo 通らないと HitReact が連続ダメージでキャンセルされない**。具体的には:

- t=0.0 ダメージ → transitionTo(HitReact)、action.reset().play()、hitReactTimer=0.4
- t=0.3 ダメージ → anim.hitReactTimer = 0.4 (CombatSystem書込)、currentClip は既に'HitReact'のため transitionTo が走らない → action.reset() が呼ばれず、action は残り 0.1秒で LoopOnce 完了 + weight=0 → **残り 0.3秒は weight=0 のゾンビ状態で Idle_Shoot / Run_Shoot も未再生**

**推奨**: CombatSystem の hitReactTimer 書込時、既に currentClip='HitReact' なら action.reset() を呼ぶ、または AnimationSystem.decideClip で currentClip=='HitReact' かつ action.time > duration の場合に action.reset() を挟む。

### 3.3 fetch + parse + abort の Three.js 整合

FIX-B で AbortController 付き fetch → arrayBuffer → GLTFLoader.parse。

- **OK**: 二重DL排除、タイムアウト制御、payload 上限チェック（3MB）の3観点は論理整合。
- **B-iter2-11（MINOR）**: `GLTFLoader.parse(buf, baseUrl, onLoad, onError)` の `baseUrl` 引数は **テクスチャ等の外部参照解決用ベースパス**。現状コードで `url.substring(0, url.lastIndexOf('/') + 1)` として抽出しているが、**Character_Soldier.gltf など外部 .bin や .png を参照するフォーマットの場合、baseUrl で正しく解決されるか構築時の構造に依存**。**.glb（単一バイナリ）なら問題なし**、**.gltf（外部参照型）なら要検証**。ASSET_PATHS が .gltf なので実機確認必須。

---

## 4. NG/要対処一覧（優先順）

### HIGH
- **B-iter2-01**: CleanupSystem.update() 本体と追加実装セクションの linger 消化重複・矛盾 → **単一記述に統合**。B-HIGH-01 の目的未達リスク。

### MID
- **B-MID-05（継続）**: スコア加算タイミング未記述 → CollisionSystem 撃破キューが Iter5 の HealthSystem deathFlag 方式でどう変わるか明示。候補: (a) HealthSystem が deathFlag セット時に ScoreService.incrementKills、(b) CleanupSystem が processDeath 内で incrementKills、(c) CollisionSystem 既存経路維持でHealthSystem経由にしない。**推奨: (a) HP<=0 検知時**（実質撃破の瞬間とスコア加算の意図整合）。
- **B-iter2-10**: HitReact 連続ダメージ時の action 再起動抜け → AnimationSystem.decideClip または CombatSystem で action.reset() 経路追加。

### LOW
- **B-LOW-08（継続）**: AssetManager getter 内の未ロード assert 欠落。
- **B-iter2-02**: VelocityComponent 書込担当 System の明示不足。
- **B-iter2-03**: SpawnSystem 生成直後の initial mixer.update dt 処理の注記。
- **B-iter2-04**: CombatSystem.C-08 本体（485〜488行）と追加実装（759〜765行）の重複・deathFlag ガード記述の統合。
- **B-iter2-05**: processDeath と forceDisposeAll の重複ロジックを private helper に抽出する方針メモ。
- **B-iter2-06**: SceneManager.dispose() 内の環境GLTF配置解除の具体手順欠落。
- **B-iter2-07**: MetricsProbe の pass/fail 判定機能がなく、運用手順依存。
- **B-iter2-08**: MetricsProbe 単発スナップショットの弱さ（Iter6改善候補）。
- **B-iter2-09**: transitionTo 内 listener 解除と handler 内 listener 解除の意図コメント補記。
- **B-iter2-11**: GLTFLoader.parse の baseUrl 解決（.gltf 外部参照）の実機検証必須メモ。

---

## 5. 評価サマリ

- **iter1 指摘 10件中 8件 OK、2件 NG継続**（B-MID-05, B-LOW-08）
- **iter2 新規観点 11件**: HIGH 1件（linger 重複）、MID 1件（HitReact 連続ダメージ）、LOW 9件
- **全体**: 重大な設計欠陥なし。B-iter2-01 と B-MID-05 を iter3 で潰せば PASS 相当の成熟度
- スコア: 正確性=7（linger 重複・スコア未記述の減点）、設計品質=7（重複セクションによる保守性低下）、セキュリティ=8（CSP・XSS・payload 上限適切）、保守性=7（重複記述の整理余地）

## 6. 次アクション（iter3 へ）

1. **B-iter2-01**（HIGH）: CleanupSystem.update() 本体を linger 消化統合版に書き換え、「追加実装」セクション重複削除
2. **B-MID-05**（MID 継続）: スコア加算タイミングを HealthSystem or CleanupSystem どちらかに確定、requirements/methods 両方に反映
3. **B-iter2-10**（MID）: HitReact 連続ダメージ時の action.reset() 経路追加
4. 残り LOW 9件は FIX-集約でまとめて対応（Construction Day 1 の注記で吸収可）
