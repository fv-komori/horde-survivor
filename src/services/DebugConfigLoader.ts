import { EventLogger } from './EventLogger';

export interface DebugConfig {
  rngSeed?: number;
  barrelIntervalMin?: number;
  barrelIntervalMax?: number;
  gateIntervalMin?: number;
  gateIntervalMax?: number;
  forceNextBarrel?: string;
  forceNextGate?: string;
}

const NUMBER_FIELDS: Record<string, [number, number]> = {
  rngSeed: [0, Number.MAX_SAFE_INTEGER],
  barrelIntervalMin: [0.1, 60],
  barrelIntervalMax: [0.1, 60],
  gateIntervalMin: [0.1, 60],
  gateIntervalMax: [0.1, 60],
};

const STRING_FIELDS = new Set(['forceNextBarrel', 'forceNextGate']);
const EXCLUDED = new Set(['__proto__', 'constructor', 'prototype']);

export class DebugConfigLoader {
  static load(): DebugConfig {
    const cfg: DebugConfig = {};
    if (!__DEBUG_API__) return cfg;

    const params = new URLSearchParams(location.search);
    for (const key of Object.keys(NUMBER_FIELDS)) {
      this.pickNumber(params, key, cfg);
    }
    for (const key of STRING_FIELDS) {
      const raw = params.get(key);
      if (raw !== null) (cfg as Record<string, unknown>)[key] = raw;
    }

    try {
      const ls = localStorage.getItem('debugConfig');
      if (ls) Object.assign(cfg, this.sanitize(JSON.parse(ls)));
    } catch (e) {
      EventLogger.instance.error('debug_config_parse', { reason: String(e) });
    }
    return cfg;
  }

  private static pickNumber(params: URLSearchParams, key: string, cfg: DebugConfig): void {
    if (!params.has(key)) return;
    const raw = params.get(key);
    const v = Number(raw);
    const [min, max] = NUMBER_FIELDS[key];
    if (!Number.isFinite(v) || v < min || v > max) {
      EventLogger.instance.error('debug_config_invalid_query', { key, raw, min, max });
      return;
    }
    (cfg as Record<string, unknown>)[key] = v;
  }

  private static sanitize(obj: unknown): DebugConfig {
    if (typeof obj !== 'object' || obj === null) return {};
    const out: DebugConfig = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (EXCLUDED.has(k)) continue;
      if (k in NUMBER_FIELDS) {
        const [min, max] = NUMBER_FIELDS[k];
        if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
          EventLogger.instance.error('debug_config_invalid_ls', { key: k, value: v });
          continue;
        }
        (out as Record<string, unknown>)[k] = v;
      } else if (STRING_FIELDS.has(k)) {
        if (typeof v === 'string') (out as Record<string, unknown>)[k] = v;
      }
    }
    return out;
  }
}
