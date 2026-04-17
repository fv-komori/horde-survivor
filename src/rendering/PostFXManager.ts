import {
  type PerspectiveCamera,
  type Scene,
  Vector2,
  type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GAME_CONFIG } from '../config/gameConfig';

const LOG_PREFIX = GAME_CONFIG.logPrefix;

/**
 * Iter4: PostFXManager - EffectComposer + UnrealBloomPass + OutputPass ライフサイクル管理
 *
 * 責務: ポストプロセスパイプラインの初期化・レンダ呼び出し・リサイズ・dispose・
 *       WebGLコンテキストロスト復帰・初期化失敗時フォールバック。
 *
 * 設計:
 * - `tryCreate` で例外捕捉、失敗時は null を返し呼び出し側で renderer.render フォールバック。
 * - `render(dt)` 内部で enabled/contextLost/null ガードを集約、外部は常にこれを呼ぶ。
 * - OutputPass を末尾に追加することで `renderer.toneMapping` (ACES) を EffectComposer 経由で適用。
 * - dpr 最大2・RenderTarget 最大2048 でリソース枯渇DoSを抑止。
 */
export class PostFXManager {
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private renderPass: RenderPass | null = null;
  private outputPass: OutputPass | null = null;
  private enabled: boolean = true;
  private contextLost: boolean = false;
  private restoringInFlight: boolean = false;

  private constructor(
    private renderer: WebGLRenderer,
    private scene: Scene,
    private camera: PerspectiveCamera,
  ) {
    this.build();
  }

  /** Iter4: 初期化失敗時は null を返すファクトリ */
  static tryCreate(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
  ): PostFXManager | null {
    try {
      return new PostFXManager(renderer, scene, camera);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.warn(`${LOG_PREFIX} [PostFX] disabled: ${reason}`);
      return null;
    }
  }

  /** composer/passes を構築（初期化 or コンテキスト復帰時） */
  private build(): void {
    const cfg = GAME_CONFIG.three.postFX;
    const size = this.clampSize(
      this.renderer.domElement.width,
      this.renderer.domElement.height,
    );

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.maxPixelRatio));
    this.composer.setSize(size.w, size.h);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new Vector2(size.w, size.h),
      cfg.bloomStrength,
      cfg.bloomRadius,
      cfg.bloomThreshold,
    );
    this.composer.addPass(this.bloomPass);

    // OutputPass: EffectComposer経由でACES Tonemappingを正しく適用
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  /** 描画。内部で enabled/contextLost/null 分岐、外部は常にこれを呼ぶ */
  render(_dt: number): void {
    if (this.enabled && !this.contextLost && this.composer != null) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /** Low品質時の有効/無効切替 */
  setEnabled(enabled: boolean): void {
    // 初期化失敗後（composer=null）は true にできない（O-NG-5'対応）
    if (enabled && this.composer == null) return;
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled && this.composer != null && !this.contextLost;
  }

  /** リサイズ。dpr最大2/RenderTarget最大2048でクランプ */
  resize(width: number, height: number): void {
    if (this.composer == null || this.bloomPass == null) return;
    const cfg = GAME_CONFIG.three.postFX;
    const size = this.clampSize(width, height);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.maxPixelRatio));
    this.composer.setSize(size.w, size.h);
    this.bloomPass.resolution.set(size.w, size.h);
  }

  private clampSize(width: number, height: number): { w: number; h: number } {
    const cfg = GAME_CONFIG.three.postFX;
    const dpr = Math.min(window.devicePixelRatio, cfg.maxPixelRatio);
    return {
      w: Math.min(width * dpr, cfg.maxRenderTargetSize),
      h: Math.min(height * dpr, cfg.maxRenderTargetSize),
    };
  }

  /** WebGLコンテキストロスト: render呼び出しを抑止 */
  handleContextLost(): void {
    this.contextLost = true;
  }

  /** WebGLコンテキスト復帰: composer/passes を再生成。失敗時は enabled=false */
  handleContextRestored(): void {
    if (this.restoringInFlight) return;
    this.restoringInFlight = true;
    try {
      this.safeDispose();
      this.build();
      this.contextLost = false;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.warn(`${LOG_PREFIX} [PostFX] restore failed: ${reason}`);
      this.composer = null;
      this.bloomPass = null;
      this.renderPass = null;
      this.outputPass = null;
      this.enabled = false;
      this.contextLost = false;
    } finally {
      this.restoringInFlight = false;
    }
  }

  /** dispose 例外を飲み込みながら安全に解放（S-NG-2対応） */
  private safeDispose(): void {
    try { this.composer?.dispose(); } catch {/* ignore */}
    try { this.bloomPass?.dispose(); } catch {/* ignore */}
    try { this.renderPass?.dispose(); } catch {/* ignore */}
    try { this.outputPass?.dispose(); } catch {/* ignore */}
  }

  /** 解放（composer → bloomPass → renderPass → outputPass の順） */
  dispose(): void {
    this.safeDispose();
    this.composer = null;
    this.bloomPass = null;
    this.renderPass = null;
    this.outputPass = null;
    this.enabled = false;
  }
}
