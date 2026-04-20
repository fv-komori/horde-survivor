import { World } from '../ecs/World';
import { GameStateManager } from './GameStateManager';
import { ScoreService } from './ScoreService';
import { EntityFactory } from '../factories/EntityFactory';
import { WaveManager } from '../managers/WaveManager';
import { SpawnManager } from '../managers/SpawnManager';
import { AssetManager } from '../managers/AssetManager';
import { InputHandler } from '../input/InputHandler';

// Three.js rendering
import { BoxGeometry, ConeGeometry, CylinderGeometry, MeshToonMaterial, SphereGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SceneManager } from '../rendering/SceneManager';
import { InstancedMeshPool } from '../rendering/InstancedMeshPool';
import { QualityManager } from '../rendering/QualityManager';
import { EffectManager3D } from '../rendering/EffectManager3D';
import { PostFXManager } from '../rendering/PostFXManager';
import { HTMLOverlayManager } from '../ui/HTMLOverlayManager';
import { ThreeJSRenderSystem } from '../systems/ThreeJSRenderSystem';

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
import { AnimationSystem } from '../systems/AnimationSystem';

// Components
import { HealthComponent } from '../components/HealthComponent';
import { AllyComponent } from '../components/AllyComponent';
import { BuffComponent } from '../components/BuffComponent';
import { WeaponComponent } from '../components/WeaponComponent';
import { AudioManager } from '../audio/AudioManager';
import { SettingsManager } from './SettingsManager';
import { SettingsScreen } from '../ui/SettingsScreen';
import { MetricsProbe } from '../services/MetricsProbe';
import { EventLogger } from '../services/EventLogger';
import { DebugConfigLoader } from '../services/DebugConfigLoader';
import { DeterministicRng } from '../services/DeterministicRng';
import { ForceSpawnApi } from '../services/ForceSpawnApi';
import { GameStartScreen } from '../ui/GameStartScreen';
import { GAME_CONFIG } from '../config/gameConfig';
import { GameState, WeaponType } from '../types';
import type { EntityId } from '../ecs/Entity';

const LOG_PREFIX = GAME_CONFIG.logPrefix;

/**
 * S-SVC-01: ゲームサービス（Iteration 3: Three.js統合）
 */
export class GameService {
  private container: HTMLElement;
  private world: World;
  private gameStateManager: GameStateManager;
  private scoreService: ScoreService;
  private entityFactory: EntityFactory;
  private waveManager: WaveManager;
  private spawnManager: SpawnManager;
  private assetManager: AssetManager;
  private inputHandler!: InputHandler;
  private weaponSystem: WeaponSystem;
  private allyConversionSystem: AllyConversionSystem;
  private allyFireRateSystem: AllyFireRateSystem;
  private audioManager: AudioManager;
  private settingsManager!: SettingsManager;
  private settingsScreen!: SettingsScreen;
  private metricsProbe: MetricsProbe;
  private gameStartScreen!: GameStartScreen;

  // Three.js
  private sceneManager!: SceneManager;
  private qualityManager!: QualityManager;
  private effectManager3D!: EffectManager3D;
  private postFXManager: PostFXManager | null = null;
  private overlayManager!: HTMLOverlayManager;
  private renderSystem!: ThreeJSRenderSystem;
  private cleanupSystem!: CleanupSystem;
  private animationSystem!: AnimationSystem;

  // InstancedMeshプール
  private bulletPool!: InstancedMeshPool;
  private enemyNormalPool!: InstancedMeshPool;
  private itemPool!: InstancedMeshPool;

  // 設定画面用オーバーレイCanvas
  private overlayCanvas!: HTMLCanvasElement;

  private playerId: EntityId = 0;
  private previousTimestamp: number = 0;
  private running: boolean = false;
  private animationFrameId: number = 0;
  private debugEnabled: boolean = false;
  private titleBGMStarted: boolean = false;
  private gameOverBGMStarted: boolean = false;
  private titleUIShown: boolean = false;
  private gameOverUIShown: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.world = new World();
    this.gameStateManager = new GameStateManager();
    this.scoreService = new ScoreService();
    this.entityFactory = new EntityFactory();
    this.waveManager = new WaveManager();
    this.audioManager = new AudioManager();
    this.spawnManager = new SpawnManager(this.entityFactory, this.waveManager, this.audioManager);
    this.assetManager = new AssetManager();
    this.weaponSystem = new WeaponSystem(this.entityFactory, this.audioManager);
    this.allyConversionSystem = new AllyConversionSystem(this.entityFactory, this.audioManager);
    this.allyFireRateSystem = new AllyFireRateSystem();
    this.metricsProbe = new MetricsProbe();
  }

  /** 初期化 */
  async init(): Promise<void> {
    // Iter6: debug 基盤を最優先で初期化（error ログ経路を他より先に確保）
    EventLogger.init();
    const debugCfg = DebugConfigLoader.load();
    DeterministicRng.init(debugCfg.rngSeed);
    ForceSpawnApi.init({ forcedBarrel: debugCfg.forceNextBarrel, forcedGate: debugCfg.forceNextGate });

    this.setupErrorHandlers();

    // WebGL2チェック（BL-12）
    if (!this.checkWebGL2Support()) {
      return;
    }

    // アセットロード
    await this.assetManager.loadAll();

    // デバッグモード判定
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === '1') {
        this.debugEnabled = true;
      }
    }

    // Three.js初期化
    this.initThreeJS();

    // InputHandler（renderer.domElement — BL-10）
    this.inputHandler = new InputHandler(this.renderSystem.domElement);

    // 設定画面用オーバーレイCanvas
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.className = 'settings-overlay-canvas';
    this.overlayCanvas.style.position = 'absolute';
    this.overlayCanvas.style.top = '0';
    this.overlayCanvas.style.left = '0';
    this.overlayCanvas.style.width = '100%';
    this.overlayCanvas.style.height = '100%';
    this.overlayCanvas.style.pointerEvents = 'none';
    this.overlayCanvas.style.display = 'none';
    this.overlayCanvas.style.zIndex = '150'; // タイトル/ゲームオーバー(z-index:100)より前面
    this.container.appendChild(this.overlayCanvas);

    // HTMLOverlayManager初期化
    this.overlayManager = new HTMLOverlayManager(this.container);
    this.overlayManager.initHUD();
    this.overlayManager.hideHUD(); // タイトル画面からスタートなのでHUD非表示
    this.renderSystem.setOverlayManager(this.overlayManager);

    // SettingsManager & SettingsScreen（Unit-02互換）
    this.settingsManager = new SettingsManager(this.audioManager, this.inputHandler);
    this.settingsScreen = new SettingsScreen(this.settingsManager, this.inputHandler, this.overlayCanvas);

    // Iter5 / S-SVC-07: タイトル画面キャラプレビュー mini-renderer
    this.gameStartScreen = new GameStartScreen(this.assetManager);

    // EntityFactoryにThree.js依存を注入（Iter5: AssetManager 渡し、enemyNormalPool 不要）
    this.entityFactory.initThree(
      this.assetManager,
      this.sceneManager,
      this.bulletPool,
      this.itemPool,
    );

    // CleanupSystemにThree.js依存を注入
    this.cleanupSystem.initThree(this.sceneManager);

    // World.onDestroyでメッシュクリーンアップ（BR-MEM01）
    this.world.onDestroy((entityId) => {
      this.cleanupSystem.cleanupMesh(this.world, entityId);
    });

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
      this.animationSystem,
    ));
    this.world.addSystem(new DefenseLineSystem(this.audioManager, this.animationSystem));
    this.world.addSystem(new HealthSystem(this.gameStateManager, this.animationSystem));
    this.world.addSystem(new ItemCollectionSystem());
    this.world.addSystem(new BuffSystem());
    this.world.addSystem(this.allyConversionSystem);
    this.world.addSystem(this.allyFireRateSystem);
    this.world.addSystem(new EffectSystem());
    this.world.addSystem(this.animationSystem);
    this.world.addSystem(this.cleanupSystem);
    this.world.addSystem(this.renderSystem);

    // AudioContext初回インタラクション初期化（BR-AU01）
    this.audioManager.setupVisibilityHandler();
    this.inputHandler.onFirstInteraction(() => {
      this.audioManager.resumeContext();
    });

    // 設定復元
    this.settingsManager.init();

    // UI操作リスナー
    this.inputHandler.enableUITapListener();

    // Iter5 S-SVC-08: MetricsProbe 開始（Chrome なら 5 分後に heap 差分を console に出力）
    this.metricsProbe.start();
  }

  /** Three.js初期化 */
  private initThreeJS(): void {
    // シーンマネージャー
    this.sceneManager = new SceneManager();

    // InstancedMeshプール作成（BL-05、Iter5: enemyNormal は個別 GLTF Mesh 化のため enemyNormalPool は弾丸サイズ用に縮退=Boxプレースホルダ）
    this.bulletPool = new InstancedMeshPool(
      this.createBulletGeometry(),
      this.createBulletMaterial(),
      GAME_CONFIG.limits.maxBullets,
    );
    this.enemyNormalPool = new InstancedMeshPool(
      this.createEnemyNormalGeometry(),
      this.createEnemyNormalMaterial(),
      100, // 未使用 pool（将来削除予定、現状 SceneManager.init シグネチャ互換のため保持）
    );
    this.itemPool = new InstancedMeshPool(
      this.createItemGeometry(),
      this.createBulletMaterial(),
      GAME_CONFIG.limits.maxItems,
    );

    // シーン初期化（ライト・背景・プール追加）
    this.sceneManager.init([this.bulletPool, this.enemyNormalPool, this.itemPool]);

    // Iter5: 環境GLB配置（AssetManager は init() で先にロード済）
    this.sceneManager.setupEnvironment(this.assetManager);

    // 品質管理
    this.qualityManager = new QualityManager(this.sceneManager);

    // エフェクト管理
    this.effectManager3D = new EffectManager3D(this.sceneManager, this.qualityManager);

    // CleanupSystem / AnimationSystem（後でinitThree呼び出し）
    this.cleanupSystem = new CleanupSystem();
    this.animationSystem = new AnimationSystem();

    // レンダリングシステム
    this.renderSystem = new ThreeJSRenderSystem(
      this.container,
      this.sceneManager,
      this.qualityManager,
      null, // overlayManagerは後で設定
    );

    // Iter4: PostFXManager（初期化失敗時はnull→renderer直接レンダにフォールバック）
    this.postFXManager = PostFXManager.tryCreate(
      this.renderSystem.renderer,
      this.sceneManager.scene,
      this.renderSystem.camera,
    );
    this.renderSystem.setPostFXManager(this.postFXManager);
    this.qualityManager.setPostFXManager(this.postFXManager);
    this.qualityManager.setRenderer(this.renderSystem.renderer);

    // Iter5 / S-SVC-06b: context restored 時に AssetManager.restoreTextures を呼ぶため注入
    this.renderSystem.setAssetManager(this.assetManager);
  }

  /** WebGL2サポートチェック（BL-12） */
  private checkWebGL2Support(): boolean {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2');
    if (!gl) {
      const overlay = new HTMLOverlayManager(this.container);
      overlay.showFallbackMessage(
        'このブラウザはWebGL 2.0に対応していないため、ゲームをプレイできません。\n最新のChrome, Firefox, Safari, Edgeをお試しください。',
      );
      return false;
    }
    return true;
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
    this.metricsProbe.stop();
  }

  /** ゲーム状態リセット */
  private resetGame(): void {
    // Three.jsリソースクリーンアップ
    this.effectManager3D.clearAll();
    this.overlayManager.clearHPLabels();
    this.overlayManager.hideHUD();
    this.overlayManager.hideGameOver();

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
    this.titleUIShown = false;
    this.gameOverUIShown = false;

    // シーンを再構築
    this.sceneManager.dispose();
    this.sceneManager = new SceneManager();

    this.bulletPool = new InstancedMeshPool(
      this.createBulletGeometry(),
      this.createBulletMaterial(),
      GAME_CONFIG.limits.maxBullets,
    );
    this.enemyNormalPool = new InstancedMeshPool(
      this.createEnemyNormalGeometry(),
      this.createEnemyNormalMaterial(),
      100,
    );
    this.itemPool = new InstancedMeshPool(
      this.createItemGeometry(),
      this.createBulletMaterial(),
      GAME_CONFIG.limits.maxItems,
    );

    this.sceneManager.init([this.bulletPool, this.enemyNormalPool, this.itemPool]);
    this.sceneManager.setupEnvironment(this.assetManager);
    this.qualityManager = new QualityManager(this.sceneManager);
    this.effectManager3D = new EffectManager3D(this.sceneManager, this.qualityManager);
    this.animationSystem.reset();

    // Iter4: PostFXManagerは新SceneManagerのsceneを指すよう再構築（旧参照を破棄）
    this.postFXManager?.dispose();
    this.postFXManager = PostFXManager.tryCreate(
      this.renderSystem.renderer,
      this.sceneManager.scene,
      this.renderSystem.camera,
    );
    this.renderSystem.setPostFXManager(this.postFXManager);
    this.qualityManager.setPostFXManager(this.postFXManager);
    this.qualityManager.setRenderer(this.renderSystem.renderer);
    this.cleanupSystem.initThree(this.sceneManager);
    this.entityFactory.initThree(
      this.assetManager,
      this.sceneManager,
      this.bulletPool,
      this.itemPool,
    );

    // RenderSystemのシーン参照を更新
    this.renderSystem.updateSceneManager(this.sceneManager, this.qualityManager);

    // onDestroyコールバック再登録（world.clear()でクリアされるため）
    this.world.onDestroy((entityId) => {
      this.cleanupSystem.cleanupMesh(this.world, entityId);
    });
  }

  /** ゲームプレイ開始 */
  private startPlaying(): void {
    this.resetGame();
    this.playerId = this.entityFactory.createPlayer(this.world);
    this.gameStateManager.changeState(GameState.PLAYING);
    this.audioManager.playBGM('playing');

    this.overlayManager.hideTitle();
    // Iter5 / S-SVC-07: mini-renderer を停止＋dispose（メイン WebGL コンテキストと競合させない）
    this.gameStartScreen.detach();
    this.overlayManager.showHUD();
    this.titleUIShown = false;
    this.gameOverUIShown = false;
  }

  /** メインゲームループ */
  private gameLoop(timestamp: number): void {
    if (!this.running) return;

    try {
      const rawDt = timestamp - this.previousTimestamp;
      this.previousTimestamp = timestamp;
      const dt = Math.max(0, Math.min(rawDt / 1000, GAME_CONFIG.deltaTime.maxMs / 1000));

      if (dt > 0) {
        this.update(dt);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`${LOG_PREFIX}[ERROR][GameService] Fatal error in game loop:`, error);
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

    switch (state) {
      case GameState.TITLE:
        if (!this.titleBGMStarted) {
          this.audioManager.playBGM('title');
          this.titleBGMStarted = true;
        }
        // タイトルUI（初回のみ表示）
        if (!this.titleUIShown) {
          this.overlayManager.showTitle(
            () => {
              this.inputHandler.disableUITapListener();
              this.startPlaying();
              this.inputHandler.enableUITapListener();
            },
            () => {
              this.showSettingsScreen();
            },
          );
          // Iter5 / S-SVC-07: タイトルコンテナ生成後に mini-renderer を attach
          const titleEl = this.overlayManager.getTitleContainer();
          if (titleEl) this.gameStartScreen.attach(titleEl);
          this.titleUIShown = true;
        }
        // Three.js背景レンダリング（Iter4: PostFX経由）
        this.sceneManager.updateBackgroundScroll(dt);
        if (this.postFXManager) {
          this.postFXManager.render(dt);
        } else {
          this.renderSystem.renderer.render(this.sceneManager.scene, this.renderSystem.camera);
        }
        // 設定画面描画
        this.renderSettingsOverlay();
        this.handleTitleInput();
        break;

      case GameState.PLAYING: {
        const elapsed = this.scoreService.getElapsedTime();
        this.scoreService.updateElapsedTime(dt);
        this.waveManager.update(elapsed + dt);
        this.spawnManager.update(this.world, dt, elapsed + dt);
        this.allyFireRateSystem.setElapsedTime(elapsed + dt);

        const allyCount = this.world.query(AllyComponent).length;
        this.scoreService.setAllyCount(allyCount);

        // ECS更新（全システム — ThreeJSRenderSystemが最後に実行）
        this.world.update(dt);

        // 3Dエフェクト更新
        this.effectManager3D.updateEffects(dt);

        // HUD更新
        this.updateHUD();
        break;
      }

      case GameState.GAME_OVER:
        if (!this.gameOverBGMStarted) {
          this.audioManager.playBGM('gameover');
          this.gameOverBGMStarted = true;
        }
        // ゲームオーバーUI（初回のみ表示）
        if (!this.gameOverUIShown) {
          this.overlayManager.showGameOver(this.scoreService.getScore(), () => {
            this.overlayManager.hideGameOver();
            this.gameStateManager.changeState(GameState.TITLE);
            this.resetGame();
            this.inputHandler.disableUITapListener();
            this.inputHandler.enableUITapListener();
          });
          this.gameOverUIShown = true;
        }
        // Three.js描画のみ（フリーズ、Iter4: PostFX経由）
        if (this.postFXManager) {
          this.postFXManager.render(0);
        } else {
          this.renderSystem.renderer.render(this.sceneManager.scene, this.renderSystem.camera);
        }
        break;
    }
  }

  private handleTitleInput(): void {
    const tap = this.inputHandler.consumeLastTapPosition();
    if (!tap) return;

    if (this.settingsScreen.visible) {
      this.settingsScreen.handleInput(tap.x, tap.y);
    }
  }

  private handleGameOverInput(): void {
    // ゲームオーバーのリトライはHTMLOverlayManagerのボタンで処理
  }

  private updateHUD(): void {
    const buffComp = this.world.getComponent(this.playerId, BuffComponent);
    const activeBuffs = buffComp?.activeBuffs ?? new Map();
    const weaponComp = this.world.getComponent(this.playerId, WeaponComponent);
    const weaponType = weaponComp?.weaponType ?? WeaponType.FORWARD;
    const allyCount = this.world.query(AllyComponent).length;

    this.overlayManager.updateHUD({
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

  private showSettingsScreen(): void {
    this.overlayCanvas.style.display = '';
    this.overlayCanvas.style.pointerEvents = 'auto';
    this.settingsScreen.show();
  }

  private renderSettingsOverlay(): void {
    if (!this.settingsScreen.visible) {
      this.overlayCanvas.style.display = 'none';
      this.overlayCanvas.style.pointerEvents = 'none';
      return;
    }

    // オーバーレイCanvasのサイズをコンテナに合わせる
    const dpr = window.devicePixelRatio || 1;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.overlayCanvas.width = w * dpr;
    this.overlayCanvas.height = h * dpr;
    this.overlayCanvas.style.width = `${w}px`;
    this.overlayCanvas.style.height = `${h}px`;

    const ctx = this.overlayCanvas.getContext('2d');
    if (!ctx) return;

    // スケーリング（論理座標に合わせる）
    const scaleX = w / GAME_CONFIG.screen.logicalWidth;
    const scaleY = h / GAME_CONFIG.screen.logicalHeight;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (w - GAME_CONFIG.screen.logicalWidth * scale) / 2;
    const offsetY = (h - GAME_CONFIG.screen.logicalHeight * scale) / 2;

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
    ctx.clearRect(
      -offsetX / scale, -offsetY / scale,
      w / scale, h / scale,
    );

    this.inputHandler.updateScaling(scale, offsetX, offsetY);
    this.settingsScreen.render(ctx);
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
        console.error(`${LOG_PREFIX}[ERROR][Global] Unhandled error:`, error);
      }
      this.stop();
      this.showErrorScreen(error ?? new Error('Unknown error'));
    };

    window.addEventListener('unhandledrejection', (event) => {
      if (import.meta.env.DEV) {
        console.error(`${LOG_PREFIX}[ERROR][Global] Unhandled rejection:`, event.reason);
      }
      this.stop();
      this.showErrorScreen(new Error(String(event.reason)));
    });
  }

  /** エラー画面表示 */
  private showErrorScreen(error: Error): void {
    const overlay = this.overlayManager ?? new HTMLOverlayManager(this.container);
    const displayMessage = this.debugEnabled
      ? error.message.slice(0, 80)
      : 'An unexpected error occurred.';
    overlay.showFallbackMessage(`${displayMessage}\nClick to reload`);
    this.container.addEventListener('click', () => location.reload(), { once: true });
  }

  // --- InstancedMesh プール用 Geometry / Material（Iter5 Option B 移設）---
  // プール dispose 時に InstancedMeshPool が geometry/material を dispose するため、
  // ここは都度 new して返す（小サイズ、キャッシュ不要）。

  /** 弾丸用 Geometry（Iter5: 円筒ケース + 円錐先端、-Z 軸沿いに向ける） */
  private createBulletGeometry(): BufferGeometry {
    // 軸方向: CylinderGeometry/ConeGeometry は既定で Y 軸沿い
    // 本体ケース（ジャケット相当）
    const body = new CylinderGeometry(0.028, 0.028, 0.13, 8);
    // 先端コーン
    const tip = new ConeGeometry(0.028, 0.07, 8);
    tip.translate(0, 0.065 + 0.035, 0); // 本体上端 (+0.065) からコーン半長 (0.035) だけ上に

    const merged = mergeGeometries([body, tip], false);
    if (!merged) {
      // 失敗時は本体のみ返す（発生想定なし、型安全のため）
      return body;
    }
    body.dispose();
    tip.dispose();

    // 弾丸は -Z 方向へ飛ぶので、Y 軸沿い → -Z 軸沿いへ回転
    merged.rotateX(-Math.PI / 2);
    return merged;
  }

  /** 弾丸用 Material（Iter5: 真鍮/ゴールド系、発光控えめで金属感） */
  private createBulletMaterial(): MeshToonMaterial {
    return new MeshToonMaterial({
      color: 0xd4a94a,
      emissive: 0xd4a94a,
      emissiveIntensity: 0.15,
    });
  }

  /** アイテム用 Geometry（八面体ジェム） */
  private createItemGeometry(): BufferGeometry {
    return new SphereGeometry(0.08, 4, 2);
  }

  /** 敵 NORMAL 用 Geometry（簡易 Box、InstancedMesh 用） */
  private createEnemyNormalGeometry(): BoxGeometry {
    return new BoxGeometry(0.3, 0.7, 0.2);
  }

  /** 敵 NORMAL 用 Material（赤系） */
  private createEnemyNormalMaterial(): MeshToonMaterial {
    return new MeshToonMaterial({ color: 0xf44336 });
  }
}
