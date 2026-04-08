import { Component } from './Component';
import type { EntityId } from '../types';

export type { EntityId };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentClass = new (...args: any[]) => Component;

/** ECSエンティティ: 一意IDとコンポーネントの集合 */
export interface Entity {
  id: EntityId;
  components: Map<ComponentClass, Component>;
}
