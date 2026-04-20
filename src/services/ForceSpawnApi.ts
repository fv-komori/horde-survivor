type ForcedGameState = Record<string, unknown>;

export class ForceSpawnApi {
  private static forcedBarrel: string | null = null;
  private static forcedGate: string | null = null;
  private static gameStateGetter: (() => ForcedGameState) | null = null;

  static init(initial?: { forcedBarrel?: string; forcedGate?: string }): void {
    this.forcedBarrel = initial?.forcedBarrel ?? null;
    this.forcedGate = initial?.forcedGate ?? null;
    if (__DEBUG_API__) {
      const w = window as unknown as {
        __SPAWN_FORCE_NEXT?: { barrel?: string; gate?: string };
        __gameState?: ForcedGameState;
      };
      Object.defineProperty(w, '__SPAWN_FORCE_NEXT', {
        get: () => ({ barrel: this.forcedBarrel, gate: this.forcedGate }),
        set: (v: { barrel?: string | null; gate?: string | null }) => {
          if (!v) return;
          if (typeof v.barrel === 'string' || v.barrel === null) this.forcedBarrel = v.barrel ?? null;
          if (typeof v.gate === 'string' || v.gate === null) this.forcedGate = v.gate ?? null;
        },
        configurable: true,
      });
      Object.defineProperty(w, '__gameState', {
        get: () => this.gameStateGetter?.() ?? {},
        configurable: true,
      });
    }
  }

  static setGameStateGetter(getter: () => ForcedGameState): void {
    this.gameStateGetter = getter;
  }

  static consumeForcedBarrel(): string | null {
    const v = this.forcedBarrel;
    this.forcedBarrel = null;
    return v;
  }

  static consumeForcedGate(): string | null {
    const v = this.forcedGate;
    this.forcedGate = null;
    return v;
  }

  static reset(): void {
    this.forcedBarrel = null;
    this.forcedGate = null;
  }
}
