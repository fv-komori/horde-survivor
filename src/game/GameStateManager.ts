import { GameState } from '../types';
import { GAME_CONFIG } from '../config/gameConfig';

type StateChangeCallback = (oldState: GameState, newState: GameState) => void;

/** 有効な状態遷移マップ（BR-ST01） */
const VALID_TRANSITIONS: Record<GameState, GameState[]> = {
  [GameState.TITLE]: [GameState.PLAYING],
  [GameState.PLAYING]: [GameState.LEVEL_UP, GameState.GAME_OVER],
  [GameState.LEVEL_UP]: [GameState.PLAYING],
  [GameState.GAME_OVER]: [GameState.TITLE],
};

/**
 * M-01: ゲーム状態管理
 * 状態遷移制約（BR-ST01）を強制
 */
export class GameStateManager {
  private currentState: GameState = GameState.TITLE;
  private listeners: StateChangeCallback[] = [];

  getCurrentState(): GameState {
    return this.currentState;
  }

  changeState(newState: GameState): void {
    const validTargets = VALID_TRANSITIONS[this.currentState];
    if (!validTargets.includes(newState)) {
      console.warn(
        `${GAME_CONFIG.logPrefix}[WARN][GameStateManager] Invalid transition: ${this.currentState} → ${newState}`
      );
      return;
    }

    const oldState = this.currentState;
    this.currentState = newState;

    for (const listener of this.listeners) {
      listener(oldState, newState);
    }
  }

  onStateChange(callback: StateChangeCallback): void {
    this.listeners.push(callback);
  }

  /** 状態をリセット（ゲームリスタート用） */
  reset(): void {
    this.currentState = GameState.TITLE;
  }
}
