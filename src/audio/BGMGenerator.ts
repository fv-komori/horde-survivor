/**
 * BGM楽曲データ定義（Unit-01: BR-BGM01, VO-A03〜A05）
 * チップチューン風BGMをコードのみで定義
 */

import type { GameScene } from '../config/audioConfig';

/** 音符イベント */
export interface NoteEvent {
  frequency: number; // Hz。0 = 休符
  duration: number;  // 拍数
}

/** 音符シーケンス（1チャンネル） */
export interface NoteSequence {
  waveType: OscillatorType;
  notes: NoteEvent[];
  volume: number; // 0.0〜1.0
}

/** BGM定義 */
export interface BGMDefinition {
  scene: GameScene;
  tempo: number; // BPM
  notes: NoteSequence[];
  loop: boolean;
}

// --- 音符ヘルパー ---
const n = (frequency: number, duration: number): NoteEvent => ({ frequency, duration });
const rest = (duration: number): NoteEvent => ({ frequency: 0, duration });

// --- 音階定数 ---
const C4 = 262, D4 = 294, E4 = 330, F4 = 349, G4 = 392, A4 = 440, B4 = 494;
const C5 = 523, D5 = 587, E5 = 659, F5 = 698, G5 = 784, A5 = 880;
const C3 = 131, E3 = 165, F3 = 175, G3 = 196, A3 = 220, B3 = 247;

/** タイトルBGM: 120BPM, 軽快で明るいチップチューンメロディ */
const titleBGM: BGMDefinition = {
  scene: 'title',
  tempo: 120,
  loop: true,
  notes: [
    // メロディ（square波）
    {
      waveType: 'square',
      volume: 0.25,
      notes: [
        n(C5, 1), n(E5, 1), n(G5, 1), n(E5, 1),
        n(F5, 1), n(A5, 1), n(G5, 2),
        n(E5, 1), n(D5, 1), n(C5, 1), n(D5, 1),
        n(E5, 2), n(C5, 2),
        n(D5, 1), n(E5, 1), n(F5, 1), n(E5, 1),
        n(D5, 1), n(C5, 1), n(D5, 2),
        n(C5, 1), n(E5, 1), n(G5, 2),
        n(A5, 1), n(G5, 1), n(E5, 1), n(C5, 1),
      ],
    },
    // ベース（triangle波）
    {
      waveType: 'triangle',
      volume: 0.3,
      notes: [
        n(C3, 2), n(C3, 2),
        n(F3, 2), n(F3, 2),
        n(G3, 2), n(G3, 2),
        n(C3, 2), n(C3, 2),
        n(F3, 2), n(F3, 2),
        n(G3, 2), n(G3, 2),
        n(C3, 2), n(E3, 2),
        n(F3, 2), n(C3, 2),
      ],
    },
  ],
};

/** プレイBGM: 150BPM, テンポが速い戦闘BGM */
const playingBGM: BGMDefinition = {
  scene: 'playing',
  tempo: 150,
  loop: true,
  notes: [
    // メロディ（square波）
    {
      waveType: 'square',
      volume: 0.2,
      notes: [
        n(A4, 1), n(A4, 0.5), n(A4, 0.5), n(C5, 1), n(A4, 1),
        n(G4, 1), n(A4, 1), rest(2),
        n(A4, 1), n(C5, 1), n(D5, 1), n(E5, 1),
        n(D5, 1), n(C5, 1), n(A4, 2),
        n(E5, 1), n(E5, 0.5), n(E5, 0.5), n(D5, 1), n(C5, 1),
        n(D5, 2), n(A4, 2),
        n(C5, 1), n(D5, 1), n(E5, 1), n(C5, 1),
        n(A4, 2), rest(2),
      ],
    },
    // ベース（sawtooth波）
    {
      waveType: 'sawtooth',
      volume: 0.15,
      notes: [
        n(A3, 1), rest(1), n(A3, 1), rest(1),
        n(G3, 1), rest(1), n(G3, 1), rest(1),
        n(A3, 1), rest(1), n(A3, 1), rest(1),
        n(E3, 1), rest(1), n(E3, 1), rest(1),
        n(A3, 1), rest(1), n(A3, 1), rest(1),
        n(F3, 1), rest(1), n(F3, 1), rest(1),
        n(C3, 1), rest(1), n(C3, 1), rest(1),
        n(A3, 1), rest(1), n(A3, 1), rest(1),
      ],
    },
    // リズム（triangle波、パーカッション風）
    {
      waveType: 'triangle',
      volume: 0.12,
      notes: [
        n(B3, 0.5), rest(0.5), n(B3, 0.5), rest(0.5),
        n(B3, 0.5), rest(0.5), n(B3, 0.5), rest(0.5),
        n(B3, 0.5), rest(0.5), n(B3, 0.5), rest(0.5),
        n(B3, 0.5), rest(0.5), n(B3, 0.5), rest(0.5),
        n(B3, 0.5), rest(0.5), n(B3, 0.5), rest(0.5),
        n(B3, 0.5), rest(0.5), n(B3, 0.5), rest(0.5),
        n(B3, 0.5), rest(0.5), n(B3, 0.5), rest(0.5),
        n(B3, 0.5), rest(0.5), n(B3, 0.5), rest(0.5),
      ],
    },
  ],
};

/** ゲームオーバーBGM: 80BPM, 短い下降フレーズ（2小節） */
const gameoverBGM: BGMDefinition = {
  scene: 'gameover',
  tempo: 80,
  loop: false,
  notes: [
    // メロディ（triangle波、寂しい下降音）
    {
      waveType: 'triangle',
      volume: 0.3,
      notes: [
        n(E5, 2), n(D5, 2),
        n(C5, 2), n(B4, 2),
        n(A4, 2), n(G4, 2),
        n(E4, 4),
      ],
    },
  ],
};

/** BGM定義マップ（GameScene → BGMDefinition） */
export const BGM_DEFINITIONS: Partial<Record<GameScene, BGMDefinition>> = {
  title: titleBGM,
  playing: playingBGM,
  gameover: gameoverBGM,
};
