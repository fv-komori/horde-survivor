import { GameService } from './game/GameService';

/** エントリポイント（Iteration 3: Three.js対応） */
async function main(): Promise<void> {
  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Container element #game-container not found');
  }

  const game = new GameService(container);
  await game.init();
  game.start();
}

main().catch((error) => {
  console.error('[FV-GAME][ERROR][Init] Failed to initialize game:', error);
});
