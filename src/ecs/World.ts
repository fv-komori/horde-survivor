import { Component } from './Component';
import type { Entity, EntityId } from './Entity';
import type { System } from './System';

/**
 * ECS World: エンティティ・コンポーネント・システムのルートコンテナ
 * component-methods.md の World インターフェース定義に基づく
 */
export class World {
  private nextEntityId: EntityId = 1;
  private entities: Map<EntityId, Entity> = new Map();
  private systems: System[] = [];
  private entitiesToDestroy: Set<EntityId> = new Set();

  /** エンティティを生成し、IDを返す */
  createEntity(): EntityId {
    const id = this.nextEntityId++;
    const entity: Entity = { id, components: new Map() };
    this.entities.set(id, entity);
    return id;
  }

  /** エンティティを破棄予約する（フレーム末尾で実際に削除） */
  destroyEntity(id: EntityId): void {
    this.entitiesToDestroy.add(id);
  }

  /** エンティティを即座に削除する（内部用） */
  private removeEntity(id: EntityId): void {
    this.entities.delete(id);
  }

  /** コンポーネントを追加 */
  addComponent<T extends Component>(entityId: EntityId, component: T): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entity.components.set(component.constructor as new (...args: any[]) => Component, component);
  }

  /** コンポーネントを削除 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeComponent<T extends Component>(entityId: EntityId, componentClass: new (...args: any[]) => T): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    entity.components.delete(componentClass);
  }

  /** コンポーネントを取得（存在しない場合undefined） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getComponent<T extends Component>(entityId: EntityId, componentClass: new (...args: any[]) => T): T | undefined {
    const entity = this.entities.get(entityId);
    if (!entity) return undefined;
    return entity.components.get(componentClass) as T | undefined;
  }

  /** 指定コンポーネントを全て持つエンティティIDのリストを返す */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(...componentClasses: (new (...args: any[]) => Component)[]): EntityId[] {
    const result: EntityId[] = [];
    for (const [id, entity] of this.entities) {
      if (this.entitiesToDestroy.has(id)) continue;
      let hasAll = true;
      for (const cls of componentClasses) {
        if (!entity.components.has(cls)) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) {
        result.push(id);
      }
    }
    return result;
  }

  /** システムを追加（優先度順にソート） */
  addSystem(system: System): void {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
  }

  /** 全システムを優先度順に実行 */
  update(dt: number): void {
    for (const system of this.systems) {
      system.update(this, dt);
    }
    this.flushDestroyQueue();
  }

  /** 破棄予約されたエンティティを実際に削除 */
  private flushDestroyQueue(): void {
    for (const id of this.entitiesToDestroy) {
      this.removeEntity(id);
    }
    this.entitiesToDestroy.clear();
  }

  /** エンティティが存在するかチェック */
  hasEntity(id: EntityId): boolean {
    return this.entities.has(id) && !this.entitiesToDestroy.has(id);
  }

  /** 全エンティティIDを取得 */
  getAllEntityIds(): EntityId[] {
    return Array.from(this.entities.keys()).filter(id => !this.entitiesToDestroy.has(id));
  }

  /** エンティティ総数 */
  getEntityCount(): number {
    return this.entities.size - this.entitiesToDestroy.size;
  }

  /** 全エンティティと状態をクリア（ゲームリセット用） */
  clear(): void {
    this.entities.clear();
    this.entitiesToDestroy.clear();
    this.nextEntityId = 1;
  }
}
