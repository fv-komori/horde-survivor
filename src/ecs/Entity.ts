import { Component } from './Component';

export type EntityId = number;

/** ECSエンティティ: 一意IDとコンポーネントの集合 */
export interface Entity {
  id: EntityId;
  components: Map<Function, Component>;
}
