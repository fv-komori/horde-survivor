import { DEBUG_LOG_ENABLED } from '../config/logConfig';

type Payload = Record<string, unknown>;

export class EventLogger {
  private static _instance: EventLogger | null = null;

  static get instance(): EventLogger {
    if (!this._instance) this._instance = new EventLogger();
    return this._instance;
  }

  static init(): EventLogger {
    if (!this._instance) this._instance = new EventLogger();
    return this._instance;
  }

  info(event: string, payload: Payload = {}): void {
    if (!__DEBUG_API__ && !DEBUG_LOG_ENABLED) return;
    console.info(JSON.stringify({ event, ...payload, t: performance.now() }));
  }

  error(event: string, payload: Payload = {}): void {
    console.error(JSON.stringify({ event, ...payload, t: performance.now() }));
  }
}
