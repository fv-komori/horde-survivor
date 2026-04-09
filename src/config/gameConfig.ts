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

/** ゲーム全体の設定パラメータ（BR-CFG01: 外部設定化） */

export const GAME_CONFIG = deepFreeze({
  /** 画面仕様（NFR-05） */
  screen: {
    logicalWidth: 720,
    logicalHeight: 1280,
    aspectRatio: 9 / 16,
  },

  /** プレイヤー基本値（FR-01, domain-entities E-01） */
  player: {
    baseHp: 100,
    baseSpeed: 200, // px/秒
    startX: 360,
    startY: 1100,
    colliderRadius: 72,
    invincibleDuration: 1.0, // 秒（BR-P03）
  },

  /** エンティティ上限（BR-S03, NFR-01） */
  limits: {
    maxEnemies: 200,
    maxBullets: 100,
    maxXPDrops: 100,
    maxEffects: 50,
    maxDrawObjects: 500,
  },

  /** XP回収（BR-G01） */
  xpCollection: {
    collectionRadius: 80,   // px: 即座に回収する距離
    magnetRadius: 1500,      // px: 引き寄せ開始距離（画面全体カバー）
    magnetSpeed: 500,        // px/秒: 引き寄せ速度
  },

  /** 防衛ライン（BR-S02） */
  defenseLine: {
    y: 1248, // 画面下端(1280) - 32px
  },

  /** 仲間設定（BR-A01, BR-A02） */
  ally: {
    maxCount: 4,
    offsetUnit: 110, // px
    /** 配置順: 右+110, 左-110, 右+220, 左-220 */
    offsets: [110, -110, 220, -220],
    spriteHalfWidth: 75,
  },

  /** 武器共通（BR-W01） */
  weapon: {
    maxSlots: 3,
    maxLevel: 5,
  },

  /** パッシブスキル（BR-G06） */
  passiveSkills: {
    maxLevel: 5,
    speed: { perLevel: 0.10 },    // +10%/レベル
    maxHp: { perLevel: 20 },      // +20/レベル
    attack: { perLevel: 0.15 },   // +15%/レベル
    xpGain: { perLevel: 0.20 },   // +20%/レベル
  },

  /** レベルアップ（BR-G03, BR-G04） */
  levelUp: {
    choiceCount: 3,
    normalHealPercent: 0.10,  // 通常レベルアップHP回復10%
    fullHealPercent: 0.30,    // HEAL選択時HP回復30%
  },

  /** デルタタイムクランプ（NFR-08, business-logic-model 11） */
  deltaTime: {
    maxMs: 100, // 最大100ms = 10FPS相当
  },

  /** XPDrop寿命（domain-entities E-04） */
  xpDrop: {
    lifetime: 15.0, // 秒
  },

  /** 弾丸設定 */
  bullet: {
    colliderRadius: 8,
    screenMargin: 50, // 画面外マージン（px）
  },

  /** 敵スポーン位置 */
  enemySpawn: {
    minY: -50,
    maxY: -10,
    marginX: 100, // 左右マージン（弾の到達範囲に収める）
  },

  /** デバッグ設定（NFR-09） */
  debug: {
    enabled: false,
    fpsHistorySize: 60,
  },

  /** エラーログ接頭辞（NFR-08） */
  logPrefix: '[FV-GAME]',
} as const);
