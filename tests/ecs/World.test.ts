import { World } from '../../src/ecs/World';
import { Component } from '../../src/ecs/Component';
import type { System } from '../../src/ecs/System';

class TestComponentA extends Component {
  constructor(public value: number = 0) { super(); }
}

class TestComponentB extends Component {
  constructor(public name: string = '') { super(); }
}

describe('World', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('createEntity', () => {
    it('should create entities with unique IDs', () => {
      const id1 = world.createEntity();
      const id2 = world.createEntity();
      expect(id1).not.toBe(id2);
    });

    it('should increment entity count', () => {
      world.createEntity();
      world.createEntity();
      expect(world.getEntityCount()).toBe(2);
    });
  });

  describe('addComponent / getComponent', () => {
    it('should add and retrieve components', () => {
      const id = world.createEntity();
      world.addComponent(id, new TestComponentA(42));
      const comp = world.getComponent(id, TestComponentA);
      expect(comp).toBeDefined();
      expect(comp!.value).toBe(42);
    });

    it('should return undefined for missing component', () => {
      const id = world.createEntity();
      expect(world.getComponent(id, TestComponentA)).toBeUndefined();
    });

    it('should return undefined for non-existent entity', () => {
      expect(world.getComponent(999, TestComponentA)).toBeUndefined();
    });
  });

  describe('removeComponent', () => {
    it('should remove a component', () => {
      const id = world.createEntity();
      world.addComponent(id, new TestComponentA(10));
      world.removeComponent(id, TestComponentA);
      expect(world.getComponent(id, TestComponentA)).toBeUndefined();
    });
  });

  describe('query', () => {
    it('should return entities with all specified components', () => {
      const id1 = world.createEntity();
      world.addComponent(id1, new TestComponentA(1));
      world.addComponent(id1, new TestComponentB('one'));

      const id2 = world.createEntity();
      world.addComponent(id2, new TestComponentA(2));

      const result = world.query(TestComponentA, TestComponentB);
      expect(result).toEqual([id1]);
    });

    it('should return empty array when no matches', () => {
      world.createEntity();
      expect(world.query(TestComponentA)).toEqual([]);
    });
  });

  describe('destroyEntity', () => {
    it('should destroy entity after flush', () => {
      const id = world.createEntity();
      world.destroyEntity(id);
      // Before flush, still counted in entities but excluded from query
      expect(world.query(TestComponentA).length).toBe(0);
    });

    it('should remove entity after update (flush)', () => {
      const id = world.createEntity();
      world.addComponent(id, new TestComponentA());
      world.destroyEntity(id);
      world.update(0); // triggers flush
      expect(world.hasEntity(id)).toBe(false);
    });
  });

  describe('system execution', () => {
    it('should execute systems in priority order', () => {
      const order: number[] = [];
      const systemA: System = {
        priority: 2,
        update: () => { order.push(2); },
      };
      const systemB: System = {
        priority: 1,
        update: () => { order.push(1); },
      };

      world.addSystem(systemA);
      world.addSystem(systemB);
      world.update(0.016);

      expect(order).toEqual([1, 2]);
    });
  });

  describe('clear', () => {
    it('should remove all entities', () => {
      world.createEntity();
      world.createEntity();
      world.clear();
      expect(world.getEntityCount()).toBe(0);
    });
  });
});
