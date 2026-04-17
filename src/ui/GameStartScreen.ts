import {
  AmbientLight,
  AnimationAction,
  AnimationMixer,
  DirectionalLight,
  Group,
  Mesh,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AssetManager } from '../managers/AssetManager';

/**
 * S-SVC-07 / C-16: GameStartScreen mini-renderer
 *
 * タイトル画面に Character_Soldier GLTF の Idle プレビューを表示する独立 Three.js シーン。
 * 本番 World とは別経路（独立 WebGLRenderer / Scene / rAF ループ）のため CleanupSystem の対象外。
 * detach() 時に mixer 停止 → SkeletonUtils.clone の破棄（geometries/materials はテンプレート参照共有のため dispose しない）
 * → 専用 renderer.dispose() → canvas 削除の順で明示クリーンアップ。
 */
export class GameStartScreen {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private mixer: AnimationMixer | null = null;
  private character: Group | null = null;
  private action: AnimationAction | null = null;
  private rafId: number = 0;
  private lastTime: number = 0;
  private running: boolean = false;

  constructor(private readonly assetManager: AssetManager) {}

  /** タイトルコンテナに mini-renderer 用 canvas を attach し、rAF 開始 */
  attach(parent: HTMLElement, size: number = 220): void {
    if (this.running) return;
    if (!this.assetManager.isLoaded()) return;

    const dpr = Math.min(window.devicePixelRatio, 2);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'title-preview';
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.canvas.style.display = 'block';
    this.canvas.style.margin = '8px auto';
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    parent.insertBefore(this.canvas, parent.firstChild);

    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(size, size, false);
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new Scene();
    this.scene.add(new AmbientLight(0xffffff, 0.75));
    const dir = new DirectionalLight(0xffffff, 1.1);
    dir.position.set(1.5, 2.5, 2.0);
    this.scene.add(dir);

    this.camera = new PerspectiveCamera(32, 1, 0.1, 20);
    this.camera.position.set(0, 1.2, 2.6);
    this.camera.lookAt(0, 0.9, 0);

    const template = this.assetManager.getCharacter('SOLDIER');
    const cloned = skeletonClone(template.scene) as Group;
    cloned.scale.setScalar(0.9);
    cloned.position.set(0, 0, 0);
    cloned.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    this.character = cloned;
    this.scene.add(cloned);

    this.mixer = new AnimationMixer(cloned);
    const idleClip = template.animations.find((c) => c.name === 'Idle') ?? template.animations[0];
    if (idleClip) {
      this.action = this.mixer.clipAction(idleClip);
      this.action.play();
    }

    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    if (!this.running || !this.renderer || !this.scene || !this.camera) return;
    this.rafId = requestAnimationFrame(this.tick);

    const dt = Math.min((now - this.lastTime) / 1000, 1 / 30);
    this.lastTime = now;

    this.mixer?.update(dt);
    if (this.character) this.character.rotation.y += dt * 0.45;
    this.renderer.render(this.scene, this.camera);
  };

  /** mini-renderer 停止＋クリーンアップ（Start 押下時に呼ぶ） */
  detach(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);

    this.action?.stop();
    this.action = null;
    this.mixer?.stopAllAction();
    this.mixer = null;

    if (this.character && this.scene) this.scene.remove(this.character);
    this.character = null;

    this.renderer?.dispose();
    this.renderer = null;

    this.scene?.clear();
    this.scene = null;
    this.camera = null;

    if (this.canvas?.parentElement) this.canvas.parentElement.removeChild(this.canvas);
    this.canvas = null;
  }
}
