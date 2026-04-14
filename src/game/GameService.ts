import { World } from '../ecs/World';
import { GameStateManager } from './GameStateManager';
import { ScoreService } from './ScoreService';
import { EntityFactory } from '../factories/EntityFactory';
import { WaveManager } from '../managers/WaveManager';
import { SpawnManager } from '../managers/SpawnManager';
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
import { ItemCollectionSystem } from '../systems/ItemCollectionSystem';
import { BuffSystem } from '../systems/BuffSystem';
import { AllyConversionSystem } from '../systems/AllyConversionSystem';
import { AllyFireRateSystem } from '../systems/AllyFireRateSystem';
import { EffectSystem } from '../systems/EffectSystem';
import { CleanupSystem } from '../systems/CleanupSystem';
import { RenderSystem } from '../systems/RenderSystem';

// Components
import { HealthComponent } from '../components/HealthComponent';
import { AllyComponent } from '../components/AllyComponent';
import { BuffComponent } from '../components/BuffComponent';
import { WeaponComponent } from '../components/WeaponComponent';

import { AudioManager } from '../audio/AudioManager';
import { SettingsManager } from './SettingsManager';
import { SettingsScreen } from '../ui/SettingsScreen';
import { GAME_CONFIG } from '../config/gameConfig';
import { GameState, WeaponType } from '../types';
import type { EntityId } from '../ecs/Entity';

/**
 * S-SVC-01: ゲームサービス（メインオーケストレーター）
 * Iteration 2: XP/レベル廃止、アイテムドロップ/バフ/仲間化システム
 */
export class GameService {
  private canvas: HTMLCanvasElement;
  private world: World;
  private gameStateManager: GameStateManager;
  private scoreService: ScoreService;
  private entityFactory: EntityFactory;
  private waveManager: WaveManager;
  private spawnManager: SpawnManager;
  private assetManager: AssetManager;
  private inputHandler: InputHandler;
  private uiManager: UIManager;
  private renderSystem: RenderSystem;
  private weaponSystem: WeaponSystem;
  private allyConversionSystem: AllyConversionSystem;
  private allyFireRateSystem: AllyFireRateSystem;
  private audioManager: AudioManager;
  private settingsManager: SettingsManager;
  private settingsScreen: SettingsScreen;

  private playerId: EntityId = 0;
  private previousTimestamp: number = 0;
  private running: boolean = false;
  private animationFrameId: number = 0;
  private debugEnabled: boolean = false;
  private titleBGMStarted: boolean = false;
  private gameOverBGMStarted: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.world = new World();
    this.gameStateManager = new GameStateManager();
    this.scoreService = new ScoreService();
    this.entityFactory = new EntityFactory();
    this.waveManager = new WaveManager();
    this.audioManager = new AudioManager();
    this.spawnManager = new SpawnManager(this.entityFactory, this.waveManager, this.audioManager);
    this.assetManager = new AssetManager();
    this.inputHandler = new InputHandler(canvas);
    this.uiManager = new UIManager();
    this.renderSystem = new RenderSystem(canvas);
    this.weaponSystem = new WeaponSystem(this.entityFactory, this.audioManager);
    this.allyConversionSystem = new AllyConversionSystem(this.entityFactory, this.audioManager);
    this.allyFireRateSystem = new AllyFireRateSystem();

    this.renderSystem.setInputHandler(this.inputHandler);

    // Unit-02: 設定管理・設定画面（BLM §7.1）
    this.settingsManager = new SettingsManager(this.audioManager, this.inputHandler);
    this.settingsScreen = new SettingsScreen(this.settingsManager, this.inputHandler, canvas);
  }

  /** 初期化 */
  async init(): Promise<void> {
    this.setupErrorHandlers();

    // アセットロード
    await this.assetManager.loadAll();

    // デバッグモード判定（開発環境のみ有効化）
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === '1') {
        this.debugEnabled = true;
      }
    }

    // ECSシステム登録
    this.world.addSystem(new InputSystem(this.inputHandler));
    this.world.addSystem(new PlayerMovementSystem());
    this.world.addSystem(new MovementSystem());
    this.world.addSystem(new AllyFollowSystem());
    this.world.addSystem(this.weaponSystem);
    this.world.addSystem(new CollisionSystem(
      this.entityFactory,
      this.scoreService,
      this.allyConversionSystem,
      this.audioManager,
    ));
    this.world.addSystem(new DefenseLineSystem(this.audioManager));
    this.world.addSystem(new HealthSystem(this.gameStateManager));
    this.world.addSystem(new ItemCollectionSystem());
    this.world.addSystem(new BuffSystem());
    this.world.addSystem(this.allyConversionSystem);
    this.world.addSystem(this.allyFireRateSystem);
    this.world.addSystem(new EffectSystem());
    this.world.addSystem(new CleanupSystem());
    this.world.addSystem(this.renderSystem);

    // AudioContext初回インタラクション初期化（BR-AU01）
    this.audioManager.setupVisibilityHandler();
    this.inputHandler.onFirstInteraction(() => {
      this.audioManager.resumeContext();
    });

    // Unit-02: 設定復元（localStorage → AudioManager/InputHandler反映）
    this.settingsManager.init();

    // UI操作リスナー
    this.inputHandler.enableUITapListener();
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
    this.weaponSystem.reset();
    this.allyFireRateSystem.reset();
    this.inputHandler.reset();
    this.audioManager.reset();
    this.titleBGMStarted = false;
    this.gameOverBGMStarted = false;
  }

  /** ゲームプレイ開始 */
  private startPlaying(): void {
    this.resetGame();
    this.playerId = this.entityFactory.createPlayer(this.world);
    this.gameStateManager.changeState(GameState.PLAYING);
    this.audioManager.playBGM('playing');
  }

  /** メインゲームループ */
  private gameLoop(timestamp: number): void {
    if (!this.running) return;

    try {
      // deltaTime計算
      const rawDt = timestamp - this.previousTimestamp;
      this.previousTimestamp = timestamp;
      const dt = Math.max(0, Math.min(rawDt / 1000, GAME_CONFIG.deltaTime.maxMs / 1000));

      if (dt > 0) {
        this.update(dt);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`${GAME_CONFIG.logPrefix}[ERROR][GameService] Fatal error in game loop:`, error);
      }
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
        if (!this.titleBGMStarted) {
          this.audioManager.playBGM('title');
          this.titleBGMStarted = true;
        }
        this.renderSystem.update(this.world, dt); // 背景クリア
        this.uiManager.renderTitleScreen(ctx);
        // Unit-02: 設定画面オーバーレイ（BR-UI02）
        this.settingsScreen.render(ctx);
        this.handleTitleInput();
        break;

      case GameState.PLAYING: {
        // ゲーム更新
        const elapsed = this.scoreService.getElapsedTime();
        this.scoreService.updateElapsedTime(dt);
        this.waveManager.update(elapsed + dt);
        this.spawnManager.update(this.world, dt, elapsed + dt);

        // 仲間連射ボーナスシステムに経過時間を同期
        this.allyFireRateSystem.setElapsedTime(elapsed + dt);

        // 仲間数をスコアに反映
        const allyCount = this.world.query(AllyComponent).length;
        this.scoreService.setAllyCount(allyCount);

        // ECS更新（全システム）
        this.world.update(dt);

        // HUD描画
        this.renderHUD(ctx);
        break;
      }

      case GameState.GAME_OVER:
        if (!this.gameOverBGMStarted) {
          this.audioManager.playBGM('gameover');
          this.gameOverBGMStarted = true;
        }
        this.renderSystem.update(this.world, 0); // 描画のみ
        this.uiManager.renderGameOverScreen(ctx, this.scoreService.getScore());
        this.handleGameOverInput();
        break;
    }
  }

  private handleTitleInput(): void {
    const tap = this.inputHandler.consumeLastTapPosition();
    if (!tap) return;

    // 設定画面表示中 → 設定画面が入力を処理（BR-UI02: 背景入力ブロック）
    if (this.settingsScreen.visible) {
      this.settingsScreen.handleInput(tap.x, tap.y);
      return;
    }

    if (this.uiManager.titleScreen.isStartButtonClicked(tap.x, tap.y)) {
      this.inputHandler.disableUITapListener();
      this.startPlaying();
      this.inputHandler.enableUITapListener();
    } else if (this.uiManager.titleScreen.isSettingsButtonClicked(tap.x, tap.y)) {
      this.settingsScreen.show();
    }
  }

  private handleGameOverInput(): void {
    const tap = this.inputHandler.consumeLastTapPosition();
    if (tap && this.uiManager.gameOverScreen.isRetryButtonClicked(tap.x, tap.y)) {
      this.gameStateManager.changeState(GameState.TITLE);
      this.resetGame();
      this.inputHandler.disableUITapListener();
      this.inputHandler.enableUITapListener();
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    // バフ情報取得
    const buffComp = this.world.getComponent(this.playerId, BuffComponent);
    const activeBuffs = buffComp?.activeBuffs ?? new Map();

    // 武器タイプ取得
    const weaponComp = this.world.getComponent(this.playerId, WeaponComponent);
    const weaponType = weaponComp?.weaponType ?? WeaponType.FORWARD;

    // 仲間数取得
    const allyCount = this.world.query(AllyComponent).length;

    this.uiManager.renderHUD(ctx, {
      hp: this.getPlayerHP(),
      maxHp: this.getPlayerMaxHP(),
      elapsedTime: this.scoreService.getElapsedTime(),
      killCount: this.scoreService.getKillCount(),
      wave: this.waveManager.getCurrentWave(),
      activeBuffs,
      allyCount,
      maxAllies: GAME_CONFIG.ally.maxCount,
      weaponType,
    });
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
      if (import.meta.env.DEV) {
        console.error(`${GAME_CONFIG.logPrefix}[ERROR][Global] Unhandled error:`, error);
      }
      this.stop();
      this.showErrorScreen(error ?? new Error('Unknown error'));
    };

    window.addEventListener('unhandledrejection', (event) => {
      if (import.meta.env.DEV) {
        console.error(`${GAME_CONFIG.logPrefix}[ERROR][Global] Unhandled rejection:`, event.reason);
      }
      this.stop();
      this.showErrorScreen(new Error(String(event.reason)));
    });
  }

  /** エラー画面表示（NFR-08） */
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
    const displayMessage = this.debugEnabled
      ? error.message.slice(0, 50)
      : 'An unexpected error occurred.';
    ctx.fillText(displayMessage, centerX, centerY);

    ctx.fillStyle = '#AAAAAA';
    ctx.font = '16px monospace';
    ctx.fillText('Click to reload', centerX, centerY + 50);

    this.canvas.addEventListener('click', () => location.reload(), { once: true });
  }
}
