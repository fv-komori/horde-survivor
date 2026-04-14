import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { PositionComponent } from '../components/PositionComponent';
import { SpriteComponent } from '../components/SpriteComponent';
import { PlayerComponent } from '../components/PlayerComponent';
import { EnemyComponent } from '../components/EnemyComponent';
import { BulletComponent } from '../components/BulletComponent';
import { ItemDropComponent } from '../components/ItemDropComponent';
import { AllyComponent } from '../components/AllyComponent';
import { EffectComponent } from '../components/EffectComponent';
import { HitCountComponent } from '../components/HitCountComponent';
import { WeaponComponent } from '../components/WeaponComponent';
import { GAME_CONFIG } from '../config/gameConfig';
import { ITEM_COLORS } from '../types';
import type { InputHandler } from '../input/InputHandler';

/** 描画レイヤー定義（Z-order: 小さい方が先に描画される） */
enum RenderLayer {
  ITEM_DROP = 0,
  ENEMY = 1,
  ALLY = 2,
  PLAYER = 3,
  BULLET = 4,
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
 * Iteration 2: ヒットカウント表示・アイテムドロップ描画
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

    // Canvas物理サイズ設定（DPR対応）
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

    // 全体クリア（レターボックス含む）
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    // ゲーム用変換を設定（DPR対応）
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
      items.length = GAME_CONFIG.limits.maxDrawObjects;
    }

    // レイヤー順に描画: background → items → enemies → allies → player → bullets → effects
    items.sort((a, b) => a.layer - b.layer);
    for (const item of items) {
      this.renderItem(ctx, world, item);
    }

    // モバイルUI描画（BR-IN02: スワイプモード時はボタン非表示）
    if (this.inputHandler?.isMobileDevice() && this.inputHandler.isButtonsEnabled()) {
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
      else if (world.getComponent(id, ItemDropComponent)) layer = RenderLayer.ITEM_DROP;
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

    // プレイヤー無敵時点滅
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
      case 'player': {
        const weapon = world.getComponent(item.entityId, WeaponComponent);
        const weaponType = weapon?.weaponType ?? 'FORWARD';
        this.drawPlayer(ctx, item.x, item.y, hw, weaponType);
        break;
      }
      case 'ally':
        this.drawAlly(ctx, item.x, item.y, hw);
        break;
      case 'enemy_normal':
      case 'enemy_fast':
      case 'enemy_tank':
      case 'enemy_boss':
        this.drawEnemy(ctx, item.x, item.y, hw, item.color, item.spriteType);
        this.drawHitCount(ctx, world, item);
        break;
      case 'bullet':
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(item.x, item.y, 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'item_drop':
        this.drawItemDrop(ctx, world, item);
        this.drawItemHitCount(ctx, world, item);
        break;
      case 'effect_muzzle':
      case 'effect_destroy':
      case 'effect_buff':
      case 'effect_ally_convert': {
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

  /** ヒットカウント表示（敵の上に残りヒット数を描画） */
  private drawHitCount(ctx: CanvasRenderingContext2D, world: World, item: RenderItem): void {
    const hitCount = world.getComponent(item.entityId, HitCountComponent);
    if (!hitCount) return;

    const isBoss = item.spriteType === 'enemy_boss';
    const fontSize = isBoss ? 28 : 20;
    const yOffset = item.height / 2 + fontSize + 4;

    ctx.save();
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // 被弾フラッシュ中は赤色
    const textColor = hitCount.flashTimer > 0 ? '#FF0000' : '#FFFFFF';

    // 黒アウトライン
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(`${hitCount.currentHits}`, item.x, item.y - yOffset + fontSize);

    // テキスト本体
    ctx.fillStyle = textColor;
    ctx.fillText(`${hitCount.currentHits}`, item.x, item.y - yOffset + fontSize);

    ctx.restore();
  }

  /** アイテムドロップ描画（射撃破壊方式: 大きめの宝石風、被弾フラッシュ対応） */
  private drawItemDrop(ctx: CanvasRenderingContext2D, world: World, item: RenderItem): void {
    const itemDrop = world.getComponent(item.entityId, ItemDropComponent);
    if (!itemDrop) return;

    const hitCount = world.getComponent(item.entityId, HitCountComponent);
    const color = ITEM_COLORS[itemDrop.itemType] ?? item.color;
    const x = item.x;
    const y = item.y;
    const s = item.width / 2; // half-size

    // 被弾フラッシュ
    if (hitCount && hitCount.flashTimer > 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, s + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // 外枠（白い縁取りでアイテムを強調）
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.stroke();

    // 本体（宝石風ダイヤ形状）
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.fill();

    // 上部ハイライト
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.4, y - s * 0.2);
    ctx.lineTo(x - s * 0.4, y - s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  /** アイテムのヒットカウント表示 */
  private drawItemHitCount(ctx: CanvasRenderingContext2D, world: World, item: RenderItem): void {
    const hitCount = world.getComponent(item.entityId, HitCountComponent);
    if (!hitCount) return;

    const fontSize = 16;
    const yOffset = item.height / 2 + fontSize + 2;

    ctx.save();
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const textColor = hitCount.flashTimer > 0 ? '#FF0000' : '#FFFFFF';

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(`${hitCount.currentHits}`, item.x, item.y - yOffset + fontSize);

    ctx.fillStyle = textColor;
    ctx.fillText(`${hitCount.currentHits}`, item.x, item.y - yOffset + fontSize);

    ctx.restore();
  }

  /** プレイヤーのドット絵描画（武器タイプ表示付き） */
  private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, half: number, weaponType: string): void {
    const s = half;

    // 足（ブーツ）
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x - s * 0.45, y + s * 0.4, s * 0.3, s * 0.3);
    ctx.fillRect(x + s * 0.15, y + s * 0.4, s * 0.3, s * 0.3);

    // 武器描画（体の後ろに描画して腕が上に来るように）
    this.drawWeapon(ctx, x, y, s, weaponType);

    // 体（ボディアーマー）
    ctx.fillStyle = '#1565C0';
    ctx.fillRect(x - s * 0.5, y - s * 0.3, s * 1.0, s * 0.75);
    // 胴体ハイライト
    ctx.fillStyle = '#1E88E5';
    ctx.fillRect(x - s * 0.3, y - s * 0.25, s * 0.6, s * 0.6);

    // 左腕（下げている）
    ctx.fillStyle = '#1565C0';
    ctx.fillRect(x - s * 0.65, y - s * 0.2, s * 0.18, s * 0.5);
    // 左手
    ctx.fillStyle = '#FFCCAA';
    ctx.fillRect(x - s * 0.63, y + s * 0.25, s * 0.14, s * 0.1);

    // 右腕（銃を構えて前方へ伸ばす）
    ctx.fillStyle = '#1565C0';
    ctx.fillRect(x + s * 0.5, y - s * 0.25, s * 0.2, s * 0.35);
    // 右前腕（前方＝上方向に曲げる）
    ctx.fillRect(x + s * 0.52, y - s * 0.55, s * 0.16, s * 0.35);
    // 右手（銃を握る）
    ctx.fillStyle = '#FFCCAA';
    ctx.fillRect(x + s * 0.53, y - s * 0.58, s * 0.14, s * 0.1);

    // ヘルメット
    ctx.fillStyle = '#0D47A1';
    ctx.beginPath();
    ctx.arc(x, y - s * 0.52, s * 0.4, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - s * 0.4, y - s * 0.52, s * 0.8, s * 0.25);

    // 顔（バイザー）
    ctx.fillStyle = '#B0BEC5';
    ctx.fillRect(x - s * 0.28, y - s * 0.48, s * 0.56, s * 0.2);

    // 目（バイザー越し）
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(x - s * 0.18, y - s * 0.44, s * 0.12, s * 0.1);
    ctx.fillRect(x + s * 0.06, y - s * 0.44, s * 0.12, s * 0.1);
  }

  /** 武器描画（タイプ別・右手に構えるポーズ） */
  private drawWeapon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, weaponType: string): void {
    // 銃の基準位置: 右腕の先端あたり
    const gunX = x + s * 0.45;
    const gunTopY = y - s * 0.55;

    switch (weaponType) {
      case 'FORWARD': {
        // アサルトライフル（右手で構え、銃身が上方へ）
        // ストック（肩付近）
        ctx.fillStyle = '#6D4C41';
        ctx.fillRect(gunX - s * 0.06, y - s * 0.15, s * 0.18, s * 0.12);
        // 本体
        ctx.fillStyle = '#555555';
        ctx.fillRect(gunX - s * 0.04, gunTopY, s * 0.14, s * 0.5);
        // レシーバー
        ctx.fillStyle = '#666666';
        ctx.fillRect(gunX - s * 0.07, gunTopY + s * 0.15, s * 0.2, s * 0.12);
        // 銃身
        ctx.fillStyle = '#444444';
        ctx.fillRect(gunX, gunTopY - s * 0.3, s * 0.08, s * 0.35);
        // マズル
        ctx.fillStyle = '#333333';
        ctx.fillRect(gunX - s * 0.02, gunTopY - s * 0.36, s * 0.12, s * 0.08);
        break;
      }
      case 'SPREAD': {
        // ショットガン（太い銃身）
        ctx.fillStyle = '#6D4C41';
        ctx.fillRect(gunX - s * 0.06, y - s * 0.15, s * 0.2, s * 0.14);
        // 本体（太め）
        ctx.fillStyle = '#555555';
        ctx.fillRect(gunX - s * 0.06, gunTopY, s * 0.2, s * 0.5);
        // 銃身（太い）
        ctx.fillStyle = '#444444';
        ctx.fillRect(gunX - s * 0.04, gunTopY - s * 0.3, s * 0.16, s * 0.35);
        // ワイドマズル
        ctx.fillStyle = '#333333';
        ctx.fillRect(gunX - s * 0.08, gunTopY - s * 0.36, s * 0.24, s * 0.08);
        break;
      }
      case 'PIERCING': {
        // スナイパーライフル（長い銃身＋スコープ）
        ctx.fillStyle = '#6D4C41';
        ctx.fillRect(gunX - s * 0.05, y - s * 0.15, s * 0.16, s * 0.14);
        // 本体
        ctx.fillStyle = '#37474F';
        ctx.fillRect(gunX - s * 0.03, gunTopY - s * 0.05, s * 0.12, s * 0.55);
        // 長い銃身
        ctx.fillStyle = '#444444';
        ctx.fillRect(gunX, gunTopY - s * 0.5, s * 0.08, s * 0.5);
        // スコープ
        ctx.fillStyle = '#00BCD4';
        ctx.fillRect(gunX - s * 0.06, gunTopY + s * 0.05, s * 0.06, s * 0.12);
        ctx.fillStyle = '#00ACC1';
        ctx.beginPath();
        ctx.arc(gunX - s * 0.03, gunTopY + s * 0.03, s * 0.04, 0, Math.PI * 2);
        ctx.fill();
        // マズル
        ctx.fillStyle = '#333333';
        ctx.fillRect(gunX - s * 0.01, gunTopY - s * 0.56, s * 0.1, s * 0.08);
        break;
      }
      default:
        ctx.fillStyle = '#555555';
        ctx.fillRect(gunX - s * 0.04, gunTopY, s * 0.12, s * 0.5);
    }
  }

  /** 仲間のドット絵描画 */
  private drawAlly(ctx: CanvasRenderingContext2D, x: number, y: number, half: number): void {
    const s = half;
    const gunX = x + s * 0.42;
    const gunTopY = y - s * 0.5;

    // 足
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x - s * 0.4, y + s * 0.4, s * 0.28, s * 0.25);
    ctx.fillRect(x + s * 0.12, y + s * 0.4, s * 0.28, s * 0.25);

    // 武器（体の後ろに描画）
    ctx.fillStyle = '#6D4C41';
    ctx.fillRect(gunX - s * 0.05, y - s * 0.1, s * 0.15, s * 0.1);
    ctx.fillStyle = '#555555';
    ctx.fillRect(gunX - s * 0.03, gunTopY, s * 0.12, s * 0.45);
    ctx.fillStyle = '#444444';
    ctx.fillRect(gunX, gunTopY - s * 0.25, s * 0.07, s * 0.3);
    ctx.fillStyle = '#333333';
    ctx.fillRect(gunX - s * 0.02, gunTopY - s * 0.3, s * 0.1, s * 0.07);

    // 体
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(x - s * 0.45, y - s * 0.25, s * 0.9, s * 0.7);
    ctx.fillStyle = '#43A047';
    ctx.fillRect(x - s * 0.28, y - s * 0.2, s * 0.56, s * 0.55);

    // 左腕（下げる）
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(x - s * 0.6, y - s * 0.15, s * 0.18, s * 0.45);
    ctx.fillStyle = '#FFCCAA';
    ctx.fillRect(x - s * 0.58, y + s * 0.25, s * 0.14, s * 0.08);

    // 右腕（銃を構える）
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(x + s * 0.45, y - s * 0.2, s * 0.18, s * 0.3);
    ctx.fillRect(x + s * 0.47, y - s * 0.5, s * 0.14, s * 0.35);
    ctx.fillStyle = '#FFCCAA';
    ctx.fillRect(x + s * 0.48, y - s * 0.53, s * 0.12, s * 0.08);

    // ヘルメット
    ctx.fillStyle = '#1B5E20';
    ctx.beginPath();
    ctx.arc(x, y - s * 0.48, s * 0.36, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - s * 0.36, y - s * 0.48, s * 0.72, s * 0.22);

    // バイザー
    ctx.fillStyle = '#A5D6A7';
    ctx.fillRect(x - s * 0.23, y - s * 0.43, s * 0.46, s * 0.16);

    // 目
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - s * 0.14, y - s * 0.4, s * 0.1, s * 0.08);
    ctx.fillRect(x + s * 0.04, y - s * 0.4, s * 0.1, s * 0.08);
  }

  /** 敵のドット絵描画 */
  private drawEnemy(ctx: CanvasRenderingContext2D, x: number, y: number, half: number, color: string, type: string): void {
    const s = half;

    if (type === 'enemy_boss') {
      // ボス: 大型の装甲兵
      // 体
      ctx.fillStyle = color;
      ctx.fillRect(x - s * 0.7, y - s * 0.5, s * 1.4, s * 1.0);
      ctx.fillStyle = '#CC0000';
      ctx.fillRect(x - s * 0.55, y - s * 0.4, s * 1.1, s * 0.8);

      // 肩アーマー
      ctx.fillStyle = color;
      ctx.fillRect(x - s * 0.85, y - s * 0.5, s * 0.3, s * 0.4);
      ctx.fillRect(x + s * 0.55, y - s * 0.5, s * 0.3, s * 0.4);

      // 頭（角付きヘルメット）
      ctx.fillStyle = '#880000';
      ctx.fillRect(x - s * 0.35, y - s * 0.8, s * 0.7, s * 0.35);
      // 角
      ctx.fillStyle = '#FFCC00';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.35, y - s * 0.8);
      ctx.lineTo(x - s * 0.25, y - s * 1.0);
      ctx.lineTo(x - s * 0.15, y - s * 0.8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + s * 0.15, y - s * 0.8);
      ctx.lineTo(x + s * 0.25, y - s * 1.0);
      ctx.lineTo(x + s * 0.35, y - s * 0.8);
      ctx.fill();

      // 目（赤く光る）
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(x - s * 0.25, y - s * 0.7, s * 0.18, s * 0.12);
      ctx.fillRect(x + s * 0.07, y - s * 0.7, s * 0.18, s * 0.12);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - s * 0.2, y - s * 0.68, s * 0.08, s * 0.06);
      ctx.fillRect(x + s * 0.12, y - s * 0.68, s * 0.08, s * 0.06);

      // 足
      ctx.fillStyle = '#660000';
      ctx.fillRect(x - s * 0.5, y + s * 0.5, s * 0.35, s * 0.3);
      ctx.fillRect(x + s * 0.15, y + s * 0.5, s * 0.35, s * 0.3);
      return;
    }

    // 通常敵キャラ共通
    // 足
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - s * 0.4, y + s * 0.35, s * 0.28, s * 0.22);
    ctx.fillRect(x + s * 0.12, y + s * 0.35, s * 0.28, s * 0.22);

    // 体
    ctx.fillStyle = color;
    ctx.fillRect(x - s * 0.5, y - s * 0.3, s * 1.0, s * 0.7);

    // 体のハイライト
    const lighter = type === 'enemy_fast' ? '#FFcc44' : type === 'enemy_tank' ? '#9966AA' : '#FF6666';
    ctx.fillStyle = lighter;
    ctx.fillRect(x - s * 0.3, y - s * 0.25, s * 0.6, s * 0.55);

    // 腕
    ctx.fillStyle = color;
    ctx.fillRect(x - s * 0.65, y - s * 0.2, s * 0.18, s * 0.4);
    ctx.fillRect(x + s * 0.47, y - s * 0.2, s * 0.18, s * 0.4);

    // ヘルメット（赤系）
    const helmetColor = type === 'enemy_fast' ? '#CC8800' : type === 'enemy_tank' ? '#663366' : '#CC2222';
    ctx.fillStyle = helmetColor;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.48, s * 0.36, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - s * 0.36, y - s * 0.48, s * 0.72, s * 0.2);

    // 顔
    ctx.fillStyle = '#FFCCAA';
    ctx.fillRect(x - s * 0.22, y - s * 0.4, s * 0.44, s * 0.18);

    // 目
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - s * 0.15, y - s * 0.38, s * 0.1, s * 0.1);
    ctx.fillRect(x + s * 0.05, y - s * 0.38, s * 0.1, s * 0.1);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - s * 0.12, y - s * 0.36, s * 0.05, s * 0.06);
    ctx.fillRect(x + s * 0.08, y - s * 0.36, s * 0.05, s * 0.06);

    // タンクは盾を持つ
    if (type === 'enemy_tank') {
      ctx.fillStyle = '#444444';
      ctx.fillRect(x - s * 0.75, y - s * 0.35, s * 0.18, s * 0.6);
      ctx.fillStyle = '#666666';
      ctx.fillRect(x - s * 0.73, y - s * 0.3, s * 0.14, s * 0.5);
    }
  }

  /** モバイル操作UI描画 */
  private renderMobileUI(ctx: CanvasRenderingContext2D): void {
    const alpha = 0.3;

    // 左移動ボタン
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    this.drawRoundRect(ctx, 32 - 40, 1180 - 40, 80, 80, 12);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u25C0', 32, 1180);

    // 右移動ボタン
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    this.drawRoundRect(ctx, 608 - 40, 1180 - 40, 80, 80, 12);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('\u25B6', 608, 1180);
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
