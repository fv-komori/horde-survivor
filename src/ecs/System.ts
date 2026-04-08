import type { World } from './World';

/** ECSシステムインターフェース */
export interface System {
  /** システムの優先度（小さいほど先に実行） */
  readonly priority: number;
  /** 毎フレームの更新処理 */
  update(world: World, dt: number): void;
}
