import { World } from '../../src/ecs/World';
import { EntityFactory } from '../../src/factories/EntityFactory';
import { PositionComponent } from '../../src/components/PositionComponent';
import { VelocityComponent } from '../../src/components/VelocityComponent';
import { ColliderComponent } from '../../src/components/ColliderComponent';
import { HitCountComponent } from '../../src/components/HitCountComponent';
import { MeshComponent } from '../../src/components/MeshComponent';
import { BarrelItemComponent } from '../../src/components/BarrelItemComponent';
import { GateComponent } from '../../src/components/GateComponent';
import { BarrelItemType, GateType, ColliderType } from '../../src/types';
import { BARREL_HP } from '../../src/config/barrelConfig';
import { GATE_EFFECTS } from '../../src/config/gateConfig';

describe('EntityFactory.createBarrelItem', () => {
  let world: World;
  let factory: EntityFactory;

  beforeEach(() => {
    world = new World();
    factory = new EntityFactory();
    // assetManager 未注入（Jest 環境では Three アセット読み込みなし）→ フォールバック Box mesh を使用
  });

  it('creates barrel with position / velocity / collider / hit count / BarrelItemComponent', () => {
    const id = factory.createBarrelItem(world, BarrelItemType.WEAPON_RIFLE, { x: 360, y: 0 });

    expect(world.getComponent(id, PositionComponent)).toBeDefined();
    expect(world.getComponent(id, VelocityComponent)).toBeDefined();
    expect(world.getComponent(id, ColliderComponent)).toBeDefined();
    expect(world.getComponent(id, HitCountComponent)).toBeDefined();
    expect(world.getComponent(id, MeshComponent)).toBeDefined();
    const barrel = world.getComponent(id, BarrelItemComponent)!;
    expect(barrel.type).toBe(BarrelItemType.WEAPON_RIFLE);
    expect(barrel.hp).toBe(BARREL_HP[BarrelItemType.WEAPON_RIFLE].baseHp);
    expect(barrel.maxHp).toBe(BARREL_HP[BarrelItemType.WEAPON_RIFLE].baseHp);
    expect(barrel.isBonus).toBe(false);
    expect(barrel.weaponTransferred).toBe(false);
  });

  it('uses BARREL ColliderType with configured radius', () => {
    const id = factory.createBarrelItem(world, BarrelItemType.WEAPON_SHOTGUN, { x: 200, y: -10 });
    const col = world.getComponent(id, ColliderComponent)!;
    expect(col.type).toBe(ColliderType.BARREL);
    expect(col.radius).toBeGreaterThan(0);
  });

  it('scales HP by 1.5 for isBonus=true (rounded down)', () => {
    const id = factory.createBarrelItem(world, BarrelItemType.WEAPON_MACHINEGUN, { x: 0, y: 0 }, true);
    const barrel = world.getComponent(id, BarrelItemComponent)!;
    const expected = Math.floor(BARREL_HP[BarrelItemType.WEAPON_MACHINEGUN].baseHp * 1.5);
    expect(barrel.hp).toBe(expected);
    expect(barrel.isBonus).toBe(true);
  });

  it('moves downward (positive Y velocity)', () => {
    const id = factory.createBarrelItem(world, BarrelItemType.WEAPON_RIFLE, { x: 360, y: 0 });
    const vel = world.getComponent(id, VelocityComponent)!;
    expect(vel.vx).toBe(0);
    expect(vel.vy).toBeGreaterThan(0);
  });
});

describe('EntityFactory.createGate', () => {
  let world: World;
  let factory: EntityFactory;

  beforeEach(() => {
    world = new World();
    factory = new EntityFactory();
  });

  it('creates gate with GateComponent but no ColliderComponent', () => {
    const id = factory.createGate(world, GateType.ALLY_ADD, { x: 360, y: 0 });

    expect(world.getComponent(id, PositionComponent)).toBeDefined();
    expect(world.getComponent(id, VelocityComponent)).toBeDefined();
    expect(world.getComponent(id, MeshComponent)).toBeDefined();
    expect(world.getComponent(id, ColliderComponent)).toBeUndefined();
    const gate = world.getComponent(id, GateComponent)!;
    expect(gate.type).toBe(GateType.ALLY_ADD);
    expect(gate.amount).toBe(GATE_EFFECTS[GateType.ALLY_ADD].amount);
    expect(gate.unit).toBe('count');
    expect(gate.consumed).toBe(false);
  });

  it('carries durationSec for buff gate types', () => {
    const id = factory.createGate(world, GateType.ATTACK_UP, { x: 360, y: 0 });
    const gate = world.getComponent(id, GateComponent)!;
    expect(gate.durationSec).toBe(GATE_EFFECTS[GateType.ATTACK_UP].durationSec);
  });

  it('applies bonus 1.5x amount and 1.2x widthHalf', () => {
    const normal = factory.createGate(world, GateType.HEAL, { x: 0, y: 0 }, false);
    const bonus = factory.createGate(world, GateType.HEAL, { x: 0, y: 0 }, true);
    const n = world.getComponent(normal, GateComponent)!;
    const b = world.getComponent(bonus, GateComponent)!;
    expect(b.amount).toBeCloseTo(n.amount * 1.5);
    expect(b.widthHalf).toBeCloseTo(n.widthHalf * 1.2);
    expect(b.isBonus).toBe(true);
  });
});
