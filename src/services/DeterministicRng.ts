export class DeterministicRng {
  private static seed: number | null = null;
  private static state: number = 0;

  static init(seedFromDebugConfig?: number): void {
    if (typeof seedFromDebugConfig === 'number' && Number.isFinite(seedFromDebugConfig)) {
      this.seed = seedFromDebugConfig;
      this.state = seedFromDebugConfig >>> 0;
    } else {
      this.seed = null;
      this.state = 0;
    }
    if (__DEBUG_API__) {
      (window as unknown as { __setRngSeed?: (n: number) => void }).__setRngSeed = (n: number) => {
        if (!Number.isFinite(n)) return;
        this.seed = n;
        this.state = n >>> 0;
      };
    }
  }

  static next(): number {
    if (this.seed === null) return Math.random();
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  static resetToSeed(): void {
    if (this.seed !== null) this.state = this.seed >>> 0;
  }
}
