import { HUD } from './HUD';
import { TitleScreen } from './TitleScreen';
import { LevelUpScreen } from './LevelUpScreen';
import { GameOverScreen } from './GameOverScreen';
import type { HUDState, ScoreData, UpgradeChoice } from '../types';

/**
 * M-05: UI統括マネージャー
 */
export class UIManager {
  readonly hud = new HUD();
  readonly titleScreen = new TitleScreen();
  readonly levelUpScreen = new LevelUpScreen();
  readonly gameOverScreen = new GameOverScreen();

  renderHUD(ctx: CanvasRenderingContext2D, state: HUDState): void {
    this.hud.render(ctx, state);
  }

  renderTitleScreen(ctx: CanvasRenderingContext2D): void {
    this.titleScreen.render(ctx);
  }

  renderLevelUpScreen(ctx: CanvasRenderingContext2D, choices: UpgradeChoice[]): void {
    this.levelUpScreen.render(ctx, choices);
  }

  renderGameOverScreen(ctx: CanvasRenderingContext2D, score: ScoreData): void {
    this.gameOverScreen.render(ctx, score);
  }
}
