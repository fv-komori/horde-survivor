import { GAME_CONFIG } from '../config/gameConfig';

const LOG_PREFIX = GAME_CONFIG.logPrefix;

/** Chrome 限定の performance.memory 型（公開仕様外のため optional 扱い） */
interface PerformanceWithMemory extends Performance {
  memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number; totalJSHeapSize: number };
}

/**
 * S-SVC-08 / C-15: MetricsProbe（Iter5, O-NG-1 / O-NG-7 / NFR-07）
 *
 * ゲーム開始時と 5 分後の `performance.memory.usedJSHeapSize` 差分を取得し console に出力する。
 * Chrome 以外は `performance.memory` が無いため noop。
 */
export class MetricsProbe {
  private static readonly SNAPSHOT_DELAY_MS = 5 * 60 * 1000;

  private startHeap: number | null = null;
  private timerId: number | null = null;

  start(): void {
    const mem = (performance as PerformanceWithMemory).memory;
    if (!mem) return; // 非 Chrome: noop

    this.startHeap = mem.usedJSHeapSize;
    this.timerId = window.setTimeout(() => this.snapshot(), MetricsProbe.SNAPSHOT_DELAY_MS);
  }

  stop(): void {
    if (this.timerId != null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private snapshot(): void {
    const mem = (performance as PerformanceWithMemory).memory;
    if (!mem || this.startHeap == null) return;

    const startMB = this.startHeap / (1024 * 1024);
    const nowMB = mem.usedJSHeapSize / (1024 * 1024);
    const diffMB = nowMB - startMB;
    // NFR-07: 5 分で +10%（~20MB）以内が許容基準
    console.info(
      `${LOG_PREFIX}[Metrics] heap5min=${diffMB.toFixed(1)}MB (start=${startMB.toFixed(1)}MB → now=${nowMB.toFixed(1)}MB)`,
    );
  }
}
