/** 設定画面・遊び方ヘルプの定数定義（Unit-02: BR-ST01〜ST05, BR-UI01〜06） */

import { ControlType } from '../types';

/** localStorageキー */
export const SETTINGS_STORAGE_KEY = 'fv-game-settings';

/** 品質設定タイプ */
export type QualityPreference = 'auto' | 'high' | 'low';

/** デフォルト設定値（BR-ST02） */
export const DEFAULT_SETTINGS = {
  bgmVolume: 70,
  seVolume: 80,
  controlType: ControlType.BOTH,
  quality: 'auto' as QualityPreference,
} as const;

/** 操作タイプ選択肢 */
export const CONTROL_TYPE_OPTIONS = [
  { type: ControlType.BUTTONS, label: 'ボタン操作' },
  { type: ControlType.SWIPE, label: 'スワイプ操作' },
  { type: ControlType.BOTH, label: '両方' },
] as const;

/** 設定画面UI座標定数（論理座標系 720x1280） */
export const SETTINGS_UI = {
  /** オーバーレイ背景 */
  overlay: {
    color: 'rgba(0,0,0,0.7)',
  },

  /** パネル */
  panel: {
    x: 40,
    y: 100,
    w: 640,
    h: 1080,
    bgColor: '#2a2a2a',
    borderRadius: 16,
  },

  /** タブバー */
  tabs: {
    settingsTab: { x: 40, y: 100, w: 320, h: 60 },
    helpTab: { x: 360, y: 100, w: 320, h: 60 },
    activeColor: '#444444',
    inactiveColor: '#2a2a2a',
    textColor: '#ffffff',
    activeIndicatorColor: '#88aaff',
    fontSize: 22,
  },

  /** 閉じるボタン（BR-UI03, NFR-02準拠: ヒットエリア48x48） */
  closeButton: {
    drawX: 640,
    drawY: 110,
    drawSize: 40,
    hitX: 636,
    hitY: 106,
    hitW: 48,
    hitH: 48,
  },

  /** スライダー（BR-UI05） */
  slider: {
    trackLeft: 100,
    trackWidth: 420,
    trackHeight: 8,
    knobRadius: 12,
    hitAreaPadding: 24,
    knobHitPadding: 20,
    trackColor: '#555555',
    fillColor: '#88aaff',
    knobColor: '#ffffff',
    labelFontSize: 20,
    valueFontSize: 18,
  },

  /** BGM音量スライダー配置 */
  bgmSlider: {
    labelY: 210,
    trackY: 250,
  },

  /** SE音量スライダー配置 */
  seSlider: {
    labelY: 330,
    trackY: 370,
  },

  /** 操作タイプ選択（BR-UI06） */
  controlType: {
    labelY: 460,
    optionStartY: 510,
    optionSpacing: 60,
    optionHitW: 500,
    optionHitH: 50,
    optionX: 100,
    radioRadius: 10,
    fontSize: 20,
  },

  /** 遊び方ヘルプ */
  help: {
    contentY: 200,
    contentH: 830,
    titleFontSize: 26,
    bodyFontSize: 18,
    lineHeight: 30,
    iconSize: 36,
    /** ページインジケータ */
    navY: 1080,
    navButtonW: 60,
    navButtonH: 44,
    prevButtonX: 100,
    nextButtonX: 560,
    dotY: 1090,
    dotRadius: 6,
    dotSpacing: 24,
    dotActiveColor: '#88aaff',
    dotInactiveColor: '#555555',
    pageNumFontSize: 16,
  },
} as const;

/** ヘルプページタイトル（BR-HP01） */
export const HELP_PAGE_TITLES = [
  '操作方法',
  'ゲームルール',
  '敵タイプ',
  'アイテム・バフ',
  '武器',
  '仲間化',
] as const;

export const HELP_TOTAL_PAGES = HELP_PAGE_TITLES.length;
