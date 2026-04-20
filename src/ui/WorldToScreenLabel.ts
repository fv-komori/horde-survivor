/**
 * C6-08 / Iter6 Phase 5: ワールド座標 → スクリーン座標ラベル（プール 6 スロット）
 *
 * - 樽 HP / ゲート効果量ラベルを固定プールで管理（NFR-07 DOM 肥大防止）
 * - bonus が normal を押し退けるロールオーバー規則
 * - 30Hz ドレインで update(scene, camera) が呼ばれる想定
 * - ResizeObserver で canvas サイズキャッシュ更新（layout thrashing 回避）
 */

import { Vector3, type PerspectiveCamera } from 'three';
import type { EntityId } from '../types';

const POOL_SIZE = 6;

export type LabelPriority = 'normal' | 'bonus';

export type WorldPosProvider = () => { x: number; y: number; z: number } | null;

interface AssignedLabel {
  el: HTMLDivElement;
  acquiredAt: number;
  priority: LabelPriority;
  getWorldPos: WorldPosProvider;
}

export class WorldToScreenLabel {
  private readonly container: HTMLElement;
  private readonly pool: HTMLDivElement[] = [];
  private readonly freeSet: Set<HTMLDivElement> = new Set();
  private readonly assigned: Map<EntityId, AssignedLabel> = new Map();
  private wCache: number = 0;
  private hCache: number = 0;
  private resizeObserver: ResizeObserver | null = null;
  private readonly _ndc = new Vector3();
  private acquireCounter = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'world-label';
      el.style.visibility = 'hidden';
      el.style.position = 'absolute';
      el.style.top = '0';
      el.style.left = '0';
      el.style.pointerEvents = 'none';
      el.style.willChange = 'transform';
      this.pool.push(el);
      this.freeSet.add(el);
      container.appendChild(el);
    }
    this.wCache = container.clientWidth || 1;
    this.hCache = container.clientHeight || 1;
    this.installResizeObserver();
  }

  acquire(
    entityId: EntityId,
    initialText: string,
    getWorldPos: WorldPosProvider,
    priority: LabelPriority = 'normal',
  ): HTMLDivElement | null {
    if (this.assigned.has(entityId)) {
      const existing = this.assigned.get(entityId)!;
      existing.el.textContent = initialText;
      return existing.el;
    }

    let el: HTMLDivElement | null = null;
    const iter = this.freeSet.values().next();
    if (!iter.done) {
      el = iter.value;
      this.freeSet.delete(el);
    } else if (priority === 'bonus') {
      el = this.evictOldestNormal();
    }

    if (!el) return null;

    this.assigned.set(entityId, {
      el,
      acquiredAt: ++this.acquireCounter,
      priority,
      getWorldPos,
    });
    el.textContent = initialText;
    el.style.visibility = 'hidden';
    return el;
  }

  release(entityId: EntityId): void {
    const slot = this.assigned.get(entityId);
    if (!slot) return;
    slot.el.style.visibility = 'hidden';
    slot.el.textContent = '';
    this.freeSet.add(slot.el);
    this.assigned.delete(entityId);
  }

  setText(entityId: EntityId, text: string): void {
    const slot = this.assigned.get(entityId);
    if (!slot) return;
    slot.el.textContent = text;
  }

  update(_scene: unknown, camera: PerspectiveCamera): void {
    for (const slot of this.assigned.values()) {
      const pos = slot.getWorldPos();
      if (!pos) {
        slot.el.style.visibility = 'hidden';
        continue;
      }
      this._ndc.set(pos.x, pos.y, pos.z);
      this._ndc.project(camera);
      if (this._ndc.z > 1 || this._ndc.z < -1) {
        slot.el.style.visibility = 'hidden';
        continue;
      }
      const xPx = (this._ndc.x * 0.5 + 0.5) * this.wCache;
      const yPx = (1 - (this._ndc.y * 0.5 + 0.5)) * this.hCache;
      if (xPx < 0 || xPx > this.wCache || yPx < 0 || yPx > this.hCache) {
        slot.el.style.visibility = 'hidden';
      } else {
        slot.el.style.visibility = 'visible';
        slot.el.style.transform = `translate3d(${xPx}px, ${yPx}px, 0)`;
      }
    }
  }

  onResize(w: number, h: number): void {
    this.wCache = w;
    this.hCache = h;
  }

  resetAll(): void {
    for (const slot of this.assigned.values()) {
      slot.el.style.visibility = 'hidden';
      slot.el.textContent = '';
      this.freeSet.add(slot.el);
    }
    this.assigned.clear();
  }

  getPoolSize(): number {
    return POOL_SIZE;
  }

  getFreeCount(): number {
    return this.freeSet.size;
  }

  getAssignedCount(): number {
    return this.assigned.size;
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.resetAll();
    for (const el of this.pool) el.remove();
    this.pool.length = 0;
    this.freeSet.clear();
  }

  private evictOldestNormal(): HTMLDivElement | null {
    let oldest: { id: EntityId; slot: AssignedLabel } | null = null;
    for (const [id, slot] of this.assigned) {
      if (slot.priority !== 'normal') continue;
      if (!oldest || slot.acquiredAt < oldest.slot.acquiredAt) {
        oldest = { id, slot };
      }
    }
    if (!oldest) return null;
    const el = oldest.slot.el;
    el.style.visibility = 'hidden';
    el.textContent = '';
    this.assigned.delete(oldest.id);
    return el;
  }

  private installResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.contentRect;
        this.onResize(rect.width || 1, rect.height || 1);
      }
    });
    this.resizeObserver.observe(this.container);
  }
}
