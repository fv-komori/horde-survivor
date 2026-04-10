/** ゲーム全体の設定パラメータ（Iteration 2: BR-CFG01外部設定化） */

/** オブジェクトを再帰的に凍結する */
function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

export const GAME_CONFIG = deepFreeze({
  /** 画面仕様（NFR-05） */
  screen: {
    logicalWidth: 720,
    logicalHeight: 1280,
    aspectRatio: 9 / 16,
  },

  /** プレイヤー基本値（FR-01） */
  player: {
    baseHp: 100,
    baseSpeed: 200, // px/秒
    startX: 360,
    startY: 1100,
    colliderRadius: 72,
  },

  /** エンティティ上限（BR-S03, NFR-01） */
  limits: {
    maxEnemies: 300,
    maxBullets: 200,
    maxItems: 50,
    maxEffects: 50,
    maxDrawObjects: 800,
    maxSimultaneousSpawn: 5,
  },

  /** アイテム回収（BR-ID06） */
  itemCollection: {
    collectionRadius: 80,    // px: 即座回収距離
    magnetRadius: 1500,      // px: 引き寄せ開始距離
    magnetSpeed: 500,        // px/秒: 引き寄せ速度
  },

  /** 防衛ライン（BR-S02） */
  defenseLine: {
    y: 1248, // 画面下端(1280) - 32px
  },

  /** 仲間設定（BR-AL01〜AL05） — 密集追従型: 軍団がひと塊で移動 */
  ally: {
    maxCount: 10,
    fixedSpacing: 40,       // 1〜4体時のpx間隔（密集配置）
    minSpacing: 20,         // 5体以上時の最小px間隔
    availableWidth: 250,    // 配置可能幅（密集のため縮小）
    spriteHalfWidth: 75,
    fireRateBonusInterval: 10,  // 秒ごとにボーナス+10
    fireRateBonusPerTick: 10,   // %
    maxFireRateBonus: 100,      // %
  },

  /** バフ設定（BR-BF01〜BF06） */
  buff: {
    duration: 5.0,              // 秒
    attackUpReduction: 2,       // 1弾=2カウント
    fireRateMultiplier: 0.5,    // 発射間隔0.5倍
    speedMultiplier: 1.5,       // 移動速度1.5倍
    barrageBulletMultiplier: 3, // 弾数3倍
    barrageSpread: {
      FORWARD: 30,  // 度
      SPREAD: 120,  // 度
      PIERCING: 20, // 度
    } as Record<string, number>,
    effectDuration: 0.3,        // バフ発動エフェクト時間（秒）
    effectMaxRadius: 80,        // バフエフェクト最大半径（px）
  },

  /** デルタタイムクランプ（NFR-08） */
  deltaTime: {
    maxMs: 100,
  },

  /** アイテムドロップ設定（BR-ID01〜ID05） */
  itemDrop: {
    lifetime: 10.0,          // 秒
    blinkStartTime: 3.0,     // 残り3秒で点滅開始
    blinkInterval: 0.2,      // 200ms ON/OFF
  },

  /** 弾丸設定 */
  bullet: {
    colliderRadius: 8,
    screenMargin: 50,
  },

  /** 敵スポーン位置 */
  enemySpawn: {
    minY: -50,
    maxY: -10,
    marginX: 100,
  },

  /** 仲間化演出（BR-AL05） */
  allyConversion: {
    shrinkDuration: 0.2,      // 秒: 縮小消滅
    appearDuration: 0.3,      // 秒: 再出現拡大
  },

  /** デバッグ設定 */
  debug: {
    enabled: false,
    fpsHistorySize: 60,
  },

  /** ログ接頭辞（NFR-08） */
  logPrefix: '[FV-GAME]',
} as const);
