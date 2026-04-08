import { GameService } from './game/GameService';

/** エントリポイント */
async function main(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element #game-canvas not found');
  }

  const game = new GameService(canvas);
  await game.init();
  game.start();
}

main().catch((error) => {
  console.error('[FV-GAME][ERROR][Init] Failed to initialize game:', error);
});
