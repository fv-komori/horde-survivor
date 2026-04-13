/**
 * SE音生成関数群（Unit-01: BLM §4）
 * 各generator: (ctx, gain) => OscillatorNode[]
 */

import type { SEType } from '../config/audioConfig';
import { SE_CONFIG } from '../config/audioConfig';

/** SE定義（generator関数込み） */
export interface SEDefinition {
  seType: SEType;
  generator: (ctx: AudioContext, gain: GainNode) => OscillatorNode[];
  duration: number;
  maxConcurrent: number;
  cooldown: number;
  oscillatorCount: number;
}

/** 射撃音: square波 880Hz→440Hz, 0.05秒 */
function generateShoot(ctx: AudioContext, gain: GainNode): OscillatorNode[] {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.05);
  osc.connect(gain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
  return [osc];
}

/** 敵撃破音: sawtooth波 200Hz→50Hz, 0.2秒 */
function generateEnemyDestroy(ctx: AudioContext, gain: GainNode): OscillatorNode[] {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
  osc.connect(gain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  return [osc];
}

/** アイテム破壊音: sine波 523Hz→1047Hz, 0.15秒 */
function generateItemDestroy(ctx: AudioContext, gain: GainNode): OscillatorNode[] {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(523, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1047, ctx.currentTime + 0.15);
  osc.connect(gain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
  return [osc];
}

/** バフ発動音: sine波 C5→E5→G5→C6 アルペジオ, 0.4秒 */
function generateBuffActivate(ctx: AudioContext, gain: GainNode): OscillatorNode[] {
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  const oscillators: OscillatorNode[] = [];
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = notes[i];
    osc.connect(gain);
    const startTime = ctx.currentTime + i * 0.1;
    osc.start(startTime);
    osc.stop(startTime + 0.1);
    oscillators.push(osc);
  }
  return oscillators;
}

/** 仲間化音: triangle波 C4→E4→G4, 0.5秒 */
function generateAllyConvert(ctx: AudioContext, gain: GainNode): OscillatorNode[] {
  const notes = [262, 330, 392]; // C4, E4, G4
  const oscillators: OscillatorNode[] = [];
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = notes[i];
    osc.connect(gain);
    const startTime = ctx.currentTime + i * 0.15;
    osc.start(startTime);
    osc.stop(startTime + 0.15);
    oscillators.push(osc);
  }
  return oscillators;
}

/** ボス出現音: sawtooth波 80Hz + LFOビブラート, 1.0秒 */
function generateBossSpawn(ctx: AudioContext, gain: GainNode): OscillatorNode[] {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, ctx.currentTime);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 10;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  lfo.start(ctx.currentTime);
  lfo.stop(ctx.currentTime + 1.0);

  osc.connect(gain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 1.0);

  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(gain.gain.value * 1.5, ctx.currentTime + 0.3);
  gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 1.0);

  return [osc, lfo];
}

/** 防衛ライン突破音: square波 150Hz→80Hz, 0.3秒 */
function generateDefenseBreach(ctx: AudioContext, gain: GainNode): OscillatorNode[] {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
  osc.connect(gain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  return [osc];
}

/** generator関数マップ */
const GENERATORS: Record<SEType, (ctx: AudioContext, gain: GainNode) => OscillatorNode[]> = {
  shoot: generateShoot,
  enemy_destroy: generateEnemyDestroy,
  item_destroy: generateItemDestroy,
  buff_activate: generateBuffActivate,
  ally_convert: generateAllyConvert,
  boss_spawn: generateBossSpawn,
  defense_breach: generateDefenseBreach,
};

/** SE定義マップ（SEType → SEDefinition） */
export const SE_DEFINITIONS: Record<SEType, SEDefinition> = Object.fromEntries(
  (Object.keys(SE_CONFIG) as SEType[]).map((seType) => {
    const config = SE_CONFIG[seType];
    return [seType, {
      seType,
      generator: GENERATORS[seType],
      duration: config.duration,
      maxConcurrent: config.maxConcurrent,
      cooldown: config.cooldown,
      oscillatorCount: config.oscillatorCount,
    }];
  }),
) as Record<SEType, SEDefinition>;
