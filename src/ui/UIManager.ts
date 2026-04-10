import { HUD } from './HUD';
import { TitleScreen } from './TitleScreen';
import { GameOverScreen } from './GameOverScreen';
import type { HUDState, ScoreData } from '../types';

/**
 * M-05: UI統括マネージャー（Iteration 2: LevelUpScreen廃止）
 */
export class UIManager {
  readonly hud = new HUD();
  readonly titleScreen = new TitleScreen();
  readonly gameOverScreen = new GameOverScreen();

  renderHUD(ctx: CanvasRenderingContext2D, state: HUDState): void {
    this.hud.render(ctx, state);
  }

  renderTitleScreen(ctx: CanvasRenderingContext2D): void {
    this.titleScreen.render(ctx);
  }

  renderGameOverScreen(ctx: CanvasRenderingContext2D, score: ScoreData): void {
    this.gameOverScreen.render(ctx, score);
  }
}
