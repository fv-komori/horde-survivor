/** サウンドシステム設定パラメータ（Unit-01: BR-ACFG01） */

/** ゲームシーン（BGM用） */
export type GameScene = 'title' | 'playing' | 'gameover';

/** 効果音タイプ */
export type SEType =
  | 'shoot'
  | 'enemy_destroy'
  | 'item_destroy'
  | 'buff_activate'
  | 'ally_convert'
  | 'boss_spawn'
  | 'defense_breach';

/** SE定義の設定値（generator関数はSoundGeneratorで定義） */
export interface SEDefinitionConfig {
  duration: number;
  maxConcurrent: number;
  cooldown: number;
  oscillatorCount: number;
}

/** SE定義設定（BR-SE01） */
export const SE_CONFIG: Record<SEType, SEDefinitionConfig> = {
  shoot:           { duration: 0.05, maxConcurrent: 3, cooldown: 0.1, oscillatorCount: 1 },
  enemy_destroy:   { duration: 0.2,  maxConcurrent: 4, cooldown: 0,   oscillatorCount: 1 },
  item_destroy:    { duration: 0.15, maxConcurrent: 2, cooldown: 0,   oscillatorCount: 1 },
  buff_activate:   { duration: 0.4,  maxConcurrent: 1, cooldown: 0,   oscillatorCount: 4 },
  ally_convert:    { duration: 0.5,  maxConcurrent: 1, cooldown: 0,   oscillatorCount: 3 },
  boss_spawn:      { duration: 1.0,  maxConcurrent: 1, cooldown: 0,   oscillatorCount: 2 },
  defense_breach:  { duration: 0.3,  maxConcurrent: 2, cooldown: 0,   oscillatorCount: 1 },
};

/** オーディオシステム定数 */
export const AUDIO_CONFIG = {
  /** デフォルト音量（BR-BGM03, BR-SE04） */
  defaultBGMVolume: 0.7,
  defaultSEVolume: 0.8,

  /** BGMフェードアウト時間（秒）（BR-BGM04） */
  fadeOutDuration: 0.3,

  /** lookaheadスケジューリング（BR-BGM05） */
  lookaheadInterval: 100,    // ms: setInterval間隔
  scheduleAheadTime: 0.2,    // 秒: 先読みバッファ

  /** OscillatorNodeハードリミット（BR-PERF01） */
  maxOscillatorCount: 20,

  /** 仲間射撃音（BR-SE03, BR-EV02） */
  allyShootCooldown: 0.2,    // 秒
  allyVolumeRatio: 0.5,

  /** SEフォールバック解放マージン（BR-SE05） */
  seFallbackMargin: 0.1,     // 秒
} as const;
