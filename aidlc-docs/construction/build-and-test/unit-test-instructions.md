# Unit Test Execution

## Test Framework
- **Jest** 29.7+ with **ts-jest** 29.1+
- **Config**: `jest.config.cjs`

## Run Unit Tests

### 1. Execute All Unit Tests
```bash
npm test
```

### 2. Execute with Watch Mode
```bash
npm run test:watch
```

### 3. Execute with Verbose Output
```bash
npx jest --config jest.config.cjs --verbose
```

## Test Suites

| Suite | File | Tests | Coverage |
|-------|------|-------|----------|
| World (ECS) | `tests/ecs/World.test.ts` | 12 | createEntity, addComponent, query, destroyEntity, system execution, clear |
| CollisionSystem | `tests/systems/CollisionSystem.test.ts` | 7 | 円形衝突判定, 弾丸-敵衝突, 貫通弾処理 |
| DefenseLineSystem | `tests/systems/DefenseLineSystem.test.ts` | 5 | 防衛ライン突破, 無敵状態, ダメージ適用 |
| WeaponSystem | `tests/systems/WeaponSystem.test.ts` | 7 | 弾丸生成, 発射間隔, 最大弾数, ターゲティング |
| CleanupSystem | `tests/systems/CleanupSystem.test.ts` | 7 | 画面外弾丸削除, XPDrop寿命, XPDrop上限 |
| WaveManager | `tests/managers/WaveManager.test.ts` | 10 | ウェーブ遷移, スポーン設定, ボス生成, リセット |
| LevelUpManager | `tests/managers/LevelUpManager.test.ts` | 8 | XP/レベルアップ, 選択肢生成/検証, HP回復 |
| EntityFactory | `tests/factories/EntityFactory.test.ts` | 16 | createPlayer/Enemy/Boss/Bullet/XPDrop/Ally/Effect |

## Expected Results
- **Total Tests**: 83
- **Passed**: 83
- **Failed**: 0
- **Test Time**: ~1.2s

## Expected Console Output
```
Test Suites: 8 passed, 8 total
Tests:       83 passed, 83 total
Snapshots:   0 total
Time:        ~1.2 s
```

### Known Console Warnings (Expected)
- `[FV-GAME][WARN][LevelUpManager] applyChoice called outside LEVEL_UP state` — LevelUpManagerテストの状態ガード検証で意図的に発生
- `[FV-GAME][WARN][LevelUpManager] Invalid choice ID: fake_id` — LevelUpManagerテストのID検証で意図的に発生
