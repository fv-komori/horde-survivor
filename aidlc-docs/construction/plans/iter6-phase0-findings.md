# Phase 0 事前調査サマリ

## 1. `Math.random()` 利用箇所

| ファイル | 行 | 用途 | DeterministicRng 置換対象 |
|---|---|---|---|
| `src/managers/WaveManager.ts` | 97, 110 | Wave 内 enemy type 重み選択 | ✅（敵スポーン決定論化） |
| `src/rendering/EffectManager3D.ts` | 170, 173 | パーティクル速度ばらつき | ⚠️ 必要に応じ（ビジュアル系、視覚判定に影響しないなら保留可） |
| `src/managers/SpawnManager.ts` | 78 | item type ランダム選択（Phase 2a で削除対象） | ❌ 削除ルートに含まれる |
| `src/managers/SpawnManager.ts` | 90, 91 | 敵スポーン X/Y ランダム | ✅ |
| `src/managers/ItemDropManager.ts` | 26, 31, 38, 50, 58 | ドロップ判定（Phase 2a で削除） | ❌ 削除 |
| `src/systems/AllyConversionSystem.ts` | 50 | 変換確率（Phase 2a で削除） | ❌ 削除 |

**Phase 4 の Spawner 新規追加時**: `ItemBarrelSpawner` / `GateSpawner` で `DeterministicRng.next()` を使用。
**Phase 1 の DeterministicRng 導入時**: `WaveManager` と `SpawnManager`（敵スポーン系のみ）を置換予定。EffectManager3D は視覚ばらつき用なので置換優先度は低い（要件 NFR-11 の AC でテスト決定論が必要な経路に限定）。

## 2. localStorage 永続化の有無

旧 `ItemType` / `WeaponType` enum 値は **localStorage に永続化されていない**。`localStorage` 利用箇所は `SettingsManager` の設定保存のみ（キー: `SETTINGS_STORAGE_KEY`）。

→ Phase 2b で旧 enum を削除しても localStorage 移行は不要。

## 3. 旧 enum / 旧クラス 参照マップ

### ファイル単位の削除対象（Phase 2a）

- `src/systems/AllyConversionSystem.ts` — 削除
- `src/systems/ItemCollectionSystem.ts` — 削除
- `src/components/ItemDropComponent.ts` — 削除
- `src/managers/ItemDropManager.ts` — 削除
- `src/config/itemConfig.ts` — 削除（`POWERUP_DROP_WEIGHTS` / `WEAPON_DROP_TYPES` のみ定義、他参照なし）

### 参照の修正対象（Phase 2a で ItemDropComponent 経路の除去）

- `src/systems/CollisionSystem.ts`: `ItemDropComponent` / `AllyConversionSystem` / `itemTypeToBuff` / `itemTypeToWeapon` / `ITEM_COLORS` 参照、行 8〜220 の `itemIds` 処理ブロックごと削除
- `src/systems/DefenseLineSystem.ts`: `ItemDropComponent` 参照削除（行 4, 59）
- `src/factories/EntityFactory.ts`: `ItemDropComponent` / `ItemType` / `ITEM_COLORS` / `createItemDrop`（行 358-）削除、`cfg.itemDropRate` / `cfg.weaponDropRate` / `cfg.conversionRate` 引数削除
- `src/managers/SpawnManager.ts`: `ItemDropComponent` / `ALL_ITEM_TYPES` / `itemSpawnTimer`（行 29, 76-82, 102）削除
- `src/game/GameService.ts`: `ItemCollectionSystem` / `AllyConversionSystem` / `createItemGeometry()`（行 668-670）/ `createItemGeometry()` 呼出（行 245, 355）削除
- `src/config/enemyConfig.ts`: `itemDropRate` / `weaponDropRate` / `conversionRate` フィールド削除
- `src/components/EnemyComponent.ts`: `itemDropRate` / `weaponDropRate` / `conversionRate` フィールド削除
- `src/config/gameConfig.ts`: `GAME_CONFIG.itemSpawn` 削除

### 参照の修正対象（Phase 2b で enum 切替）

- `src/types/index.ts`:
  - 削除: `WeaponType` enum（行 22-）、`ItemType` enum（行 42-）、`itemTypeToBuff`（行 141-）、`itemTypeToWeapon`（行 152-）、`ITEM_COLORS`（行 169-）、`WeaponComponentSnapshot.weaponType`（行 73, 111）
  - 追加: `WeaponGenre` / `BarrelItemType` / `GateType`
- `src/systems/WeaponSystem.ts`: `WeaponType` → `WeaponGenre`（行 15, 151, 171）
- `src/components/WeaponComponent.ts`: `WeaponType` → `WeaponGenre`
- `src/components/BulletComponent.ts`: 確認後、必要に応じ `WeaponGenre` 参照に置換
- `src/factories/EntityFactory.ts`: `WEAPON_CONFIG[WeaponType.FORWARD]` → `WEAPON_PARAMS[WeaponGenre.RIFLE]` に再設計
- `src/game/GameService.ts`: `weaponType` 参照（行 49, 535）
- `src/ui/HTMLOverlayManager.ts`: `WEAPON_LABELS: Record<WeaponType>` → `Record<WeaponGenre>`（行 10-16）
- `src/config/weaponConfig.ts`: `WEAPON_CONFIG: Record<WeaponType>` → `WEAPON_PARAMS: Record<WeaponGenre>` に再設計

### テストの修正対象

- `tests/systems/WeaponSystem.test.ts`: `WeaponType.FORWARD` → `WeaponGenre.RIFLE`（Phase 2b）
- `tests/systems/CollisionSystem.test.ts`: `ItemDropComponent` / `AllyConversionSystem` / `ItemType` ブロック削除（Phase 2a）、`WeaponType` → `WeaponGenre`（Phase 2b）
- `tests/factories/EntityFactory.test.ts`: `createItemDrop` / `ItemDropComponent` / `itemDropRate` / `weaponDropRate` / `conversionRate` ブロック削除（Phase 2a）、`WeaponType` → `WeaponGenre`（Phase 2b）

## 4. renderer.info.programs ベースライン

**Phase 6 の AC-05 検証で取得**（現時点ではまだ Iter6 コード未導入のため、Phase 1〜5 完了後に改めて Iter5 マージ済 main と比較）。

Phase 6 で Playwright `browser_evaluate` により、以下を実行し Iter5 ベースライン（main HEAD）と Iter6 完了時の値を比較:
```js
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
window.__programsBaseline = renderer.info.programs.length;
```

## 5. 注意点・追加発見

- `DefenseLineSystem` が `ItemDropComponent` を query している（行 59、ダメージゾーン判定用）。削除時はこの query も除去する必要あり
- `BulletComponent` の内部実装は Phase 2b で確認（現時点未読、`WeaponType` 直参照の有無は実装時確認）
- `EffectManager3D` の `Math.random()` は視覚ばらつき用。決定論 AC に影響しないなら Iter6 スコープ外で維持可（要件 NFR-11 に明記なし）
- `WaveManager.Math.random()` は敵 type 選択の重み付けに使用。AC-04 の Wave 境目ボーナス発火再現性には影響しないため、Phase 1 の DeterministicRng 置換は**敵スポーン座標と新 Spawner のみ必須**、WaveManager は任意とする

## 6. Phase 1 着手条件クリア

以上の調査完了をもって Phase 0 終了。Phase 1（Debug 基盤）へ進む。
