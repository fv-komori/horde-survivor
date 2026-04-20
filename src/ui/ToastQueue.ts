/**
 * C6-14 / Iter6 Phase 5: 中央トースト FIFO キュー（NFR-05 XSS 対策: textContent のみ）
 *
 * - 上限 3、同時表示 1、0.8 秒で次へ
 * - 同種連続時は current.remaining を durationSec にリセットし、新規 push しない
 * - キュー超過は古い順に破棄
 */

export type ToastKind = 'WEAPON' | 'GAIN' | 'BUFF' | 'MAX' | 'WAVE';

export interface ToastEntry {
  kind: ToastKind;
  text: string;
  durationSec?: number;
}

interface ActiveToast {
  entry: ToastEntry;
  remaining: number;
}

const DEFAULT_DURATION = 0.8;
const QUEUE_LIMIT = 3;

export class ToastQueue {
  private readonly root: HTMLDivElement;
  private readonly queue: ToastEntry[] = [];
  private current: ActiveToast | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud-toast';
    this.root.style.visibility = 'hidden';
    parent.appendChild(this.root);
  }

  push(entry: ToastEntry): void {
    const durationSec = entry.durationSec ?? DEFAULT_DURATION;

    if (this.current && this.current.entry.kind === entry.kind && this.current.entry.text === entry.text) {
      this.current.remaining = durationSec;
      return;
    }

    if (this.queue.length >= QUEUE_LIMIT) {
      this.queue.shift();
    }
    this.queue.push({ ...entry, durationSec });

    if (!this.current) {
      this.advance();
    }
  }

  tick(dt: number): void {
    if (!this.current) return;
    this.current.remaining -= dt;
    if (this.current.remaining <= 0) {
      this.current = null;
      if (this.queue.length > 0) {
        this.advance();
      } else {
        this.root.style.visibility = 'hidden';
        this.root.textContent = '';
        this.root.removeAttribute('data-kind');
      }
    }
  }

  reset(): void {
    this.queue.length = 0;
    this.current = null;
    this.root.style.visibility = 'hidden';
    this.root.textContent = '';
  }

  dispose(): void {
    this.reset();
    this.root.remove();
  }

  /** テスト用: 現在の表示テキスト（null なら非表示） */
  getCurrentText(): string | null {
    return this.current ? this.current.entry.text : null;
  }

  /** テスト用: キュー残件数 */
  getQueueSize(): number {
    return this.queue.length;
  }

  private advance(): void {
    const next = this.queue.shift();
    if (!next) return;
    const durationSec = next.durationSec ?? DEFAULT_DURATION;
    this.current = { entry: next, remaining: durationSec };
    this.root.textContent = next.text;
    this.root.setAttribute('data-kind', next.kind);
    this.root.style.visibility = 'visible';
  }
}
