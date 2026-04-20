import { Component } from '../ecs/Component';

/** アニメーション状態（state machine 優先度: Death > HitReact > Idle_Shoot/Run_Shoot > Run > Idle） */
export type AnimState =
  | 'Idle'
  | 'Run'
  | 'Run_Shoot'
  | 'Idle_Shoot'
  | 'HitReact'
  | 'Death';

/**
 * Iter5: アニメーション状態コンポーネント（C-07）
 *
 * AnimationSystem が本コンポーネントを参照し、mixer 上で対応する clip を再生する。
 * `current` の変化でクロスフェード or 即切替を決定。
 */
export class AnimationStateComponent extends Component {
  static readonly componentName = 'AnimationStateComponent';

  /** 現在のアニメ状態 */
  current: AnimState = 'Idle';

  /** 前フレームの状態（遷移判定用） */
  previous: AnimState | null = null;

  /** HitReact / Death 等のワンショット残り時間（秒、> 0 で再生中） */
  oneShotRemaining: number = 0;

  /** Death 完了フラグ（再生終了後に静止ポーズ保持） */
  deathComplete: boolean = false;

  constructor(initial: AnimState = 'Idle') {
    super();
    this.current = initial;
  }
}
