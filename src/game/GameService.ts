import { World } from '../ecs/World';
import { GameStateManager } from './GameStateManager';
import { ScoreService } from './ScoreService';
import { EntityFactory } from '../factories/EntityFactory';
import { WaveManager } from '../managers/WaveManager';
import { SpawnManager } from '../managers/SpawnManager';
import { LevelUpManager } from '../managers/LevelUpManager';
import { AssetManager } from '../managers/AssetManager';
import { InputHandler } from '../input/InputHandler';
import { UIManager } from '../ui/UIManager';

// Systems
import { InputSystem } from '../systems/InputSystem';
import { PlayerMovementSystem } from '../systems/PlayerMovementSystem';
import { MovementSystem } from '../systems/MovementSystem';
import { AllyFollowSystem } from '../systems/AllyFollowSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { DefenseLineSystem } from '../systems/DefenseLineSystem';
import { HealthSystem } from '../systems/HealthSystem';
import { XPCollectionSystem } from '../systems/XPCollectionSystem';
import { EffectSystem } from '../systems/EffectSystem';
import { CleanupSystem } from '../systems/CleanupSystem';
import { RenderSystem } from '../systems/RenderSystem';

// Components
import { PlayerComponent } from '../components/PlayerComponent';
import { HealthComponent } from '../components/HealthComponent';

import { GAME_CONFIG } from '../config/gameConfig';
import { GameState } from '../types';
import type { EntityId } from '../ecs/Entity';
import type { UpgradeChoice } from '../types';

/**
 * S-SVC-01: ゲームサービス（メインオーケストレーター）
 * services.md, business-logic-model セクション1
 */
export class GameService {
  private canvas: HTMLCanvasElement;
  private world: World;
  private gameStateManager: GameStateManager;
  private scoreService: ScoreService;
  private entityFactory: EntityFactory;
  private waveManager: WaveManager;
  private spawnManager: SpawnManager;
  private levelUpManager: LevelUpManager;
  private assetManager: AssetManager;
  private inputHandler: InputHandler;
  private uiManager: UIManager;
  private renderSystem: RenderSystem;
  private weaponSystem: WeaponSystem;

  private playerId: EntityId = 0;
  private previousTimestamp: number = 0;
  private running: boolean = false;
  private animationFrameId: number = 0;

  // LEVEL_UP state
  private currentChoices: UpgradeChoice[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.world = new World();
    this.gameStateManager = new GameStateManager();
    this.scoreService = new ScoreService();
    this.entityFactory = new EntityFactory();
    this.waveManager = new WaveManager();
    this.spawnManager = new SpawnManager(this.entityFactory, this.waveManager);
    this.levelUpManager = new LevelUpManager(this.entityFactory);
    this.assetManager = new AssetManager();
    this.inputHandler = new InputHandler(canvas);
    this.uiManager = new UIManager();
    this.renderSystem = new RenderSystem(canvas);
    this.weaponSystem = new WeaponSystem(this.entityFactory);

    this.renderSystem.setInputHandler(this.inputHandler);
  }

  /** 初期化 */
  async init(): Promise<void> {
    this.setupErrorHandlers();

    // アセットロード
    await this.assetManager.loadAll();

    // デバッグモード判定
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') {
      (GAME_CONFIG as { debug: { enabled: boolean; fpsHistorySize: number } }).debug.enabled = true;
    }

    // ECSシステム登録
    this.world.addSystem(new InputSystem(this.inputHandler));
    this.world.addSystem(new PlayerMovementSystem());
    this.world.addSystem(new MovementSystem());
    this.world.addSystem(new AllyFollowSystem());
    this.world.addSystem(this.weaponSystem);
    this.world.addSystem(new CollisionSystem(this.entityFactory, this.scoreService));
    this.world.addSystem(new DefenseLineSystem());
    this.world.addSystem(new HealthSystem(this.gameStateManager));
    this.world.addSystem(new XPCollectionSystem(this.levelUpManager));
    this.world.addSystem(new EffectSystem());
    this.world.addSystem(new CleanupSystem());
    this.world.addSystem(this.renderSystem);

    // UI操作リスナー
    this.inputHandler.enableUITapListener();

    // 状態遷移リスナー
    this.gameStateManager.onStateChange((oldState, newState) => {
      if (newState === GameState.LEVEL_UP) {
        this.currentChoices = this.levelUpManager.generateChoices(this.world, this.playerId);
      }
    });
  }

  /** ゲーム開始 */
  start(): void {
    this.gameStateManager.reset();
    this.running = true;
    this.previousTimestamp = performance.now();
    this.gameLoop(this.previousTimestamp);
  }

  /** ゲームループ停止 */
  stop(): void {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  /** ゲーム状態リセット */
  private resetGame(): void {
    this.world.clear();
    this.scoreService.reset();
    this.waveManager.reset();
    this.spawnManager.reset();
    this.levelUpManager.reset();
    this.weaponSystem.reset();
    this.inputHandler.reset();
    this.currentChoices = [];
  }

  /** ゲームプレイ開始 */
  private startPlaying(): void {
    this.resetGame();
    this.playerId = this.entityFactory.createPlayer(this.world);
    this.gameStateManager.changeState(GameState.PLAYING);
  }

  /** メインゲームループ（services.md GameService.gameLoop） */
  private gameLoop(timestamp: number): void {
    if (!this.running) return;

    try {
      // deltaTime計算（business-logic-model セクション11）
      const rawDt = timestamp - this.previousTimestamp;
      this.previousTimestamp = timestamp;
      const dt = Math.max(0, Math.min(rawDt / 1000, GAME_CONFIG.deltaTime.maxMs / 1000));

      if (dt > 0) {
        this.update(dt);
      }
    } catch (error) {
      console.error(`${GAME_CONFIG.logPrefix}[ERROR][GameService] Fatal error in game loop:`, error);
      this.stop();
      this.showErrorScreen(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  /** フレーム更新 */
  private update(dt: number): void {
    const state = this.gameStateManager.getCurrentState();
    const ctx = this.canvas.getContext('2d')!;

    switch (state) {
      case GameState.TITLE:
        this.renderSystem.update(this.world, dt); // 背景クリア
        this.uiManager.renderTitleScreen(ctx);
        this.handleTitleInput();
        break;

      case GameState.PLAYING:
        // ゲーム更新
        this.scoreService.updateElapsedTime(dt);
        this.waveManager.update(this.scoreService.getElapsedTime());
        this.spawnManager.update(this.world, dt, this.scoreService.getElapsedTime());
        this.scoreService.setLevel(this.levelUpManager.getCurrentLevel());

        // ECS更新（全システム）
        this.world.update(dt);

        // レベル���ップ判定
        if (this.levelUpManager.checkLevelUp()) {
          this.gameStateManager.changeState(GameState.LEVEL_UP);
        }

        // HUD描画
        const xpProgress = this.levelUpManager.getXPProgress();
        this.uiManager.renderHUD(ctx, {
          hp: this.getPlayerHP(),
          maxHp: this.getPlayerMaxHP(),
          xpCurrent: xpProgress.current,
          xpRequired: xpProgress.required,
          level: this.levelUpManager.getCurrentLevel(),
          elapsedTime: this.scoreService.getElapsedTime(),
          killCount: this.scoreService.getKillCount(),
          wave: this.waveManager.getCurrentWave(),
        });
        break;

      case GameState.LEVEL_UP:
        // ゲーム一時停止中（BR-ST02: エンティティ更新停止）
        this.renderSystem.update(this.world, 0); // 描画のみ（dt=0）

        // HUD + レベルアップ画面
        const xpProg2 = this.levelUpManager.getXPProgress();
        this.uiManager.renderHUD(ctx, {
          hp: this.getPlayerHP(),
          maxHp: this.getPlayerMaxHP(),
          xpCurrent: xpProg2.current,
          xpRequired: xpProg2.required,
          level: this.levelUpManager.getCurrentLevel(),
          elapsedTime: this.scoreService.getElapsedTime(),
          killCount: this.scoreService.getKillCount(),
          wave: this.waveManager.getCurrentWave(),
        });
        this.uiManager.renderLevelUpScreen(ctx, this.currentChoices);
        this.handleLevelUpInput();
        break;

      case GameState.GAME_OVER:
        this.renderSystem.update(this.world, 0); // 描画のみ
        this.uiManager.renderGameOverScreen(ctx, this.scoreService.getScore());
        this.handleGameOverInput();
        break;
    }
  }

  private handleTitleInput(): void {
    const tap = this.inputHandler.getLastTapPosition();
    if (tap && this.uiManager.titleScreen.isStartButtonClicked(tap.x, tap.y)) {
      this.inputHandler.disableUITapListener();
      this.startPlaying();
      this.inputHandler.enableUITapListener();
    }
  }

  private handleLevelUpInput(): void {
    const tap = this.inputHandler.getLastTapPosition();
    if (!tap) return;

    const idx = this.uiManager.levelUpScreen.getClickedCardIndex(tap.x, tap.y);
    if (idx >= 0 && idx < this.currentChoices.length) {
      this.levelUpManager.applyChoice(this.world, this.playerId, this.currentChoices[idx], this.gameStateManager);
      this.currentChoices = [];
      // タップ位置リセット
      this.inputHandler.disableUITapListener();
      this.inputHandler.enableUITapListener();
    }
  }

  private handleGameOverInput(): void {
    const tap = this.inputHandler.getLastTapPosition();
    if (tap && this.uiManager.gameOverScreen.isRetryButtonClicked(tap.x, tap.y)) {
      this.gameStateManager.changeState(GameState.TITLE);
      this.resetGame();
      this.inputHandler.disableUITapListener();
      this.inputHandler.enableUITapListener();
    }
  }

  private getPlayerHP(): number {
    const health = this.world.getComponent(this.playerId, HealthComponent);
    return health?.hp ?? 0;
  }

  private getPlayerMaxHP(): number {
    const health = this.world.getComponent(this.playerId, HealthComponent);
    return health?.maxHp ?? 100;
  }

  /** エラーハンドラー設定（NFR-08） */
  private setupErrorHandlers(): void {
    window.onerror = (_msg, _source, _line, _col, error) => {
      console.error(`${GAME_CONFIG.logPrefix}[ERROR][Global] Unhandled error:`, error);
      this.stop();
      this.showErrorScreen(error ?? new Error('Unknown error'));
    };

    window.addEventListener('unhandledrejection', (event) => {
      console.error(`${GAME_CONFIG.logPrefix}[ERROR][Global] Unhandled rejection:`, event.reason);
      this.stop();
      this.showErrorScreen(new Error(String(event.reason)));
    });
  }

  /** エラー画面��示（NFR-08） */
  private showErrorScreen(error: Error): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#FF0000';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = this.canvas.width / (2 * dpr);
    const centerY = this.canvas.height / (2 * dpr);
    ctx.fillText('An error occurred', centerX, centerY - 40);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px monospace';
    ctx.fillText(error.message.slice(0, 50), centerX, centerY);

    ctx.fillStyle = '#AAAAAA';
    ctx.font = '16px monospace';
    ctx.fillText('Click to reload', centerX, centerY + 50);

    this.canvas.addEventListener('click', () => location.reload(), { once: true });
  }
}
