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
      RIFLE: 30,        // 度
      SHOTGUN: 120,     // 度
      MACHINEGUN: 20,   // 度
    } as Record<string, number>,
    effectDuration: 0.3,        // バフ発動エフェクト時間（秒）
    effectMaxRadius: 80,        // バフエフェクト最大半径（px）
  },

  /** デルタタイムクランプ（NFR-08） */
  deltaTime: {
    maxMs: 100,
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
    marginX: 160,
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

  /** Three.js 3Dレンダリング設定（Iteration 3: ビジュアルリニューアル） */
  three: {
    camera: {
      fov: 50,
      near: 0.1,
      far: 100,
      position: { x: 3.6, y: 2.5, z: -13.5 },  // プレイヤー背後・低め
      lookAt: { x: 3.6, y: 0.5, z: -4 },         // 道路前方を注視
    },
    lighting: {
      ambientIntensity: 0.7,
      ambientColor: 0xfff5e6,    // 暖色系アンビエント
      directionalIntensity: 1.0,
      directionalColor: 0xfff4e0,              // Iter4: 暖色に変更
      directionalPosition: { x: 5, y: 15, z: -5 },
      shadowMapSize: 1024,
      // Iter4 追加: HemisphereLight（空色→地面色バウンス）
      hemisphereSkyColor: 0x87ceeb,
      hemisphereGroundColor: 0xc9a96e,
      hemisphereIntensity: 0.4,
      directionalBoostWhenHemiOff: 1.15,       // Hemi OFF時のDirectional補正係数
      toneMappingExposure: 1.0,
    },
    coordinate: {
      scale: 0.01,
    },
    road: {
      width: 8.0,        // 幅広（ゲーム領域7.2をカバー）
      length: 6.0,        // タイル長
      tileCount: 4,        // 4枚で前方をカバー
      scrollSpeed: 2.0,
      color: 0x777777,    // やや暗めのグレー
      lineColor: 0xeeeeee,
      lineWidth: 0.06,
    },
    guardrail: {
      height: 0.4,
      postSpacing: 0.8,
      color: 0x8b5a3c,        // Iter4: 木製風（焼け木色）
      topRailColor: 0x6b4223, // Iter4: 横木の濃色
    },
    desert: {
      color: 0xd4a574,
      width: 20.0,
    },
    quality: {
      fpsThresholdForDowngrade: 25,
      fpsThresholdForUpgrade: 55,
      fpsSampleWindow: 60,
      switchCooldownMs: 5000,
      sustainDurationMs: 5000,
    },
    entityHeight: {
      player: 0.4,
      ally: 0.35,
      enemyNormal: 0.35,
      enemyFast: 0.3,
      enemyTank: 0.5,
      enemyBoss: 0.7,
      bullet: 0.5,
      itemBase: 0.3,
      itemBobAmplitude: 0.1,
    },
    // Iter4: Fog
    fog: {
      color: 0xc9a96e,
      near: 15,
      far: 45,
      disabledFar: 9999,       // setFogEnabled(false) 時の値（far planeより十分大きい）
    },
    // Iter4: グラデーション空ドーム
    sky: {
      topColor: 0x87ceeb,       // 空の上部（空色）
      bottomColor: 0xc9a96e,    // 空の下部（Fog色と統一）
      radius: 40,               // Fog far=45 より内側に配置して距離逆転を回避
      offset: 0.0,              // グラデ中心位置
      exponent: 0.6,            // グラデ急峻度
    },
    // Iter4: PostFX（UnrealBloom + OutputPass）
    postFX: {
      bloomStrength: 0.6,
      bloomRadius: 0.4,
      bloomThreshold: 0.85,
      maxPixelRatio: 2,
      maxRenderTargetSize: 2048,
    },
    // Iter4: Outline（反転ハル）
    outline: {
      color: 0x000000,
      thickness: 0.04,          // メッシュサイズに対する拡大率
    },
  },
} as const);
