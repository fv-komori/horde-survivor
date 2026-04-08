import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { PositionComponent } from '../components/PositionComponent';
import { SpriteComponent } from '../components/SpriteComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { BulletComponent } from '../components/BulletComponent';
import { XPDropComponent } from '../components/XPDropComponent';
import { AllyComponent } from '../components/AllyComponent';
import { EffectComponent } from '../components/EffectComponent';
import { GAME_CONFIG } from '../config/gameConfig';
import type { InputHandler } from '../input/InputHandler';

/** 描画レイヤー定義 */
enum RenderLayer {
  XP_DROP = 0,
  ENEMY = 1,
  BULLET = 2,
  ALLY = 3,
  PLAYER = 4,
  EFFECT = 5,
}

interface RenderItem {
  entityId: number;
  layer: RenderLayer;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  spriteType: string;
}

/**
 * S-10: 描画システム（優先度99）
 * Canvas 2D描画、レターボックス、devicePixelRatio対応
 * business-logic-model セクション14-15
 */
export class RenderSystem implements System {
  readonly priority = 99;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private inputHandler: InputHandler | null = null;
  private abortController: AbortController;

  // デバッグ
  private fpsHistory: number[] = [];
  private lastFrameTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    this.abortController = new AbortController();

    this.initCanvas();
    this.setupResizeObserver();
  }

  setInputHandler(inputHandler: InputHandler): void {
    this.inputHandler = inputHandler;
    // 初期化済みのスケーリング情報を即座に同期
    inputHandler.updateScaling(this.scale, this.offsetX, this.offsetY);
  }

  /** Canvas初期化（NFR-05） */
  private initCanvas(): void {
    this.handleResize();
  }

  /** リサイズ処理（business-logic-model 14.1） */
  handleResize(): void {
    const dpr = window.devicePixelRatio || 1;
    const logicalW = GAME_CONFIG.screen.logicalWidth;
    const logicalH = GAME_CONFIG.screen.logicalHeight;

    // 利用可能領域
    const physW = window.innerWidth;
    const physH = window.innerHeight;

    // スケール計算（アスペクト比維持）
    const scaleX = physW / logicalW;
    const scaleY = physH / logicalH;
    this.scale = Math.min(scaleX, scaleY);

    // レターボックスオフセット
    this.offsetX = (physW - logicalW * this.scale) / 2;
    this.offsetY = (physH - logicalH * this.scale) / 2;

    // Canvas物理サイズ設定
    this.canvas.width = physW * dpr;
    this.canvas.height = physH * dpr;
    this.canvas.style.width = `${physW}px`;
    this.canvas.style.height = `${physH}px`;

    // InputHandlerにスケーリング情報を通知
    if (this.inputHandler) {
      this.inputHandler.updateScaling(this.scale, this.offsetX, this.offsetY);
    }
  }

  private setupResizeObserver(): void {
    window.addEventListener('resize', () => this.handleResize(), { signal: this.abortController.signal });
  }

  /** リソース解放: resizeリスナーを解除 */
  destroy(): void {
    this.abortController.abort();
  }

  update(world: World, dt: number): void {
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.ctx;

    // 全体クリア（レターボックス含む）（business-logic-model 14.4）
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    // ゲーム用変換を設定
    ctx.setTransform(
      this.scale * dpr, 0,
      0, this.scale * dpr,
      this.offsetX * dpr, this.offsetY * dpr,
    );

    // ゲーム領域背景
    ctx.fillStyle = '#111122';
    ctx.fillRect(0, 0, GAME_CONFIG.screen.logicalWidth, GAME_CONFIG.screen.logicalHeight);

    // 防衛ライン描画
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GAME_CONFIG.defenseLine.y);
    ctx.lineTo(GAME_CONFIG.screen.logicalWidth, GAME_CONFIG.defenseLine.y);
    ctx.stroke();

    // レンダーアイテム収集
    const items = this.collectRenderItems(world);

    // カリング（NFR-01）: 描画上限チェック
    if (items.length > GAME_CONFIG.limits.maxDrawObjects) {
      // 優先度低いもの（XPアイテム等）を先にスキップするためソート済みを逆から削���
      items.length = GAME_CONFIG.limits.maxDrawObjects;
    }

    // レイヤー順に描画
    items.sort((a, b) => a.layer - b.layer);
    for (const item of items) {
      this.renderItem(ctx, world, item);
    }

    // モバイルUI描画
    if (this.inputHandler?.isMobileDevice()) {
      this.renderMobileUI(ctx);
    }

    // FPS計測
    if (GAME_CONFIG.debug.enabled) {
      this.updateFPS(dt);
      this.renderDebugOverlay(ctx, world);
    }
  }

  private collectRenderItems(world: World): RenderItem[] {
    const items: RenderItem[] = [];
    const ids = world.query(SpriteComponent, PositionComponent);
    const margin = 50;
    const w = GAME_CONFIG.screen.logicalWidth;
    const h = GAME_CONFIG.screen.logicalHeight;

    for (const id of ids) {
      const pos = world.getComponent(id, PositionComponent)!;
      const sprite = world.getComponent(id, SpriteComponent)!;

      // カリング: 画面外スキップ
      if (pos.x < -margin || pos.x > w + margin || pos.y < -margin || pos.y > h + margin) continue;

      // レイヤー判定
      let layer = RenderLayer.ENEMY;
      if (world.getComponent(id, PlayerComponent)) layer = RenderLayer.PLAYER;
      else if (world.getComponent(id, AllyComponent)) layer = RenderLayer.ALLY;
      else if (world.getComponent(id, BulletComponent)) layer = RenderLayer.BULLET;
      else if (world.getComponent(id, XPDropComponent)) layer = RenderLayer.XP_DROP;
      else if (world.getComponent(id, EffectComponent)) layer = RenderLayer.EFFECT;

      items.push({
        entityId: id,
        layer,
        x: pos.x,
        y: pos.y,
        width: sprite.width,
        height: sprite.height,
        color: sprite.color,
        spriteType: sprite.spriteType,
      });
    }

    return items;
  }

  private renderItem(ctx: CanvasRenderingContext2D, world: World, item: RenderItem): void {
    ctx.save();

    // プレイヤー無敵時点滅（business-logic-model 15.9）
    if (item.layer === RenderLayer.PLAYER) {
      const player = world.getComponent(item.entityId, PlayerComponent);
      if (player?.isInvincible) {
        const alpha = (Math.floor(player.invincibleTimer / 0.1) % 2 === 0) ? 1.0 : 0.3;
        ctx.globalAlpha = alpha;
      }
    }

    const hw = item.width / 2;
    const hh = item.height / 2;

    switch (item.spriteType) {
      case 'player':
        this.drawPlayer(ctx, item.x, item.y, hw);
        break;
      case 'ally':
        this.drawAlly(ctx, item.x, item.y, hw);
        break;
      case 'enemy_normal':
      case 'enemy_fast':
      case 'enemy_tank':
      case 'enemy_boss':
        this.drawEnemy(ctx, item.x, item.y, hw, item.color, item.spriteType);
        break;
      case 'bullet':
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(item.x, item.y, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'xp_drop':
        this.drawXPDrop(ctx, item.x, item.y);
        break;
      case 'effect_muzzle':
      case 'effect_destroy': {
        const effect = world.getComponent(item.entityId, EffectComponent);
        if (effect) {
          const progress = effect.elapsed / effect.duration;
          ctx.globalAlpha = 1 - progress;
        }
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(item.x, item.y, hw * (1 + (ctx.globalAlpha < 1 ? 0.5 : 0)), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        ctx.fillStyle = item.color;
        ctx.fillRect(item.x - hw, item.y - hh, item.width, item.height);
    }

    ctx.restore();
  }

  /** プレイヤーのドット絵描画 */
  private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, half: number): void {
    // 体
    ctx.fillStyle = '#00CC00';
    ctx.fillRect(x - half * 0.6, y - half * 0.8, half * 1.2, half * 1.6);
    // 頭
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(x - half * 0.4, y - half, half * 0.8, half * 0.4);
    // 武器（銃口）
    ctx.fillStyle = '#AAAAAA';
    ctx.fillRect(x - 2, y - half - 6, 4, 8);
  }

  /** 仲間のドット絵描画 */
  private drawAlly(ctx: CanvasRenderingContext2D, x: number, y: number, half: number): void {
    ctx.fillStyle = '#00AA00';
    ctx.fillRect(x - half * 0.5, y - half * 0.7, half, half * 1.4);
    ctx.fillStyle = '#00CC00';
    ctx.fillRect(x - half * 0.3, y - half * 0.9, half * 0.6, half * 0.3);
    ctx.fillStyle = '#888888';
    ctx.fillRect(x - 1.5, y - half - 4, 3, 6);
  }

  /** 敵のドット絵描画 */
  private drawEnemy(ctx: CanvasRenderingContext2D, x: number, y: number, half: number, color: string, type: string): void {
    ctx.fillStyle = color;
    if (type === 'enemy_boss') {
      // ボス: 大きな菱形
      ctx.beginPath();
      ctx.moveTo(x, y - half);
      ctx.lineTo(x + half, y);
      ctx.lineTo(x, y + half);
      ctx.lineTo(x - half, y);
      ctx.closePath();
      ctx.fill();
      // 目
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - half * 0.3, y - half * 0.2, half * 0.2, half * 0.2);
      ctx.fillRect(x + half * 0.1, y - half * 0.2, half * 0.2, half * 0.2);
    } else {
      // 通常敵: 四角
      ctx.fillRect(x - half * 0.7, y - half * 0.7, half * 1.4, half * 1.4);
      // 目
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - half * 0.3, y - half * 0.2, 3, 3);
      ctx.fillRect(x + half * 0.1, y - half * 0.2, 3, 3);
    }
  }

  /** XPドロップのドット絵描画 */
  private drawXPDrop(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // 光る宝石風
    ctx.fillStyle = '#00FFFF';
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 5, y);
    ctx.closePath();
    ctx.fill();
    // ハイライト
    ctx.fillStyle = '#AAFFFF';
    ctx.fillRect(x - 1, y - 3, 2, 2);
  }

  /** モバイル操作UI描画（business-logic-model 15.8） */
  private renderMobileUI(ctx: CanvasRenderingContext2D): void {
    const alpha = 0.3;
    // TODO: pressedAlpha (0.5) — ボタン押下フィードバック未実装（要InputHandler連携）

    // 左移動ボタン
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    this.drawRoundRect(ctx, 32 - 40, 1180 - 40, 80, 80, 12);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('◀', 32, 1180);

    // 右移動ボタン
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    this.drawRoundRect(ctx, 608 - 40, 1180 - 40, 80, 80, 12);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('▶', 608, 1180);
  }

  private drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private updateFPS(dt: number): void {
    if (dt > 0) {
      this.fpsHistory.push(1 / dt);
      if (this.fpsHistory.length > GAME_CONFIG.debug.fpsHistorySize) {
        this.fpsHistory.shift();
      }
    }
  }

  /** デバッグオーバーレイ（NFR-09） */
  private renderDebugOverlay(ctx: CanvasRenderingContext2D, world: World): void {
    const avgFps = this.fpsHistory.length > 0
      ? Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length)
      : 0;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(4, 60, 200, 80);
    ctx.fillStyle = '#00FF00';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`FPS: ${avgFps}`, 8, 64);
    ctx.fillText(`Entities: ${world.getEntityCount()}`, 8, 80);
    ctx.fillText(`Enemies: ${world.query(EnemyComponent).length}`, 8, 96);
    ctx.fillText(`Bullets: ${world.query(BulletComponent).length}`, 8, 112);
    ctx.restore();
  }

  getScale(): number { return this.scale; }
  getOffsetX(): number { return this.offsetX; }
  getOffsetY(): number { return this.offsetY; }
}
