import { BarrelItemComponent } from '../../src/components/BarrelItemComponent';
import { GateComponent } from '../../src/components/GateComponent';
import { PlayerWeaponComponent } from '../../src/components/PlayerWeaponComponent';
import { ActiveBuffsComponent } from '../../src/components/ActiveBuffsComponent';
import { BarrelItemType, GateType, WeaponGenre } from '../../src/types';

describe('BarrelItemComponent', () => {
  it('holds type / hp / maxHp with defaults', () => {
    const c = new BarrelItemComponent(BarrelItemType.WEAPON_RIFLE, 30, 30);
    expect(c.type).toBe(BarrelItemType.WEAPON_RIFLE);
    expect(c.hp).toBe(30);
    expect(c.maxHp).toBe(30);
    expect(c.labelDomId).toBeNull();
    expect(c.isBonus).toBe(false);
    expect(c.weaponTransferred).toBe(false);
  });

  it('respects explicit isBonus / labelDomId / weaponTransferred', () => {
    const c = new BarrelItemComponent(BarrelItemType.WEAPON_MACHINEGUN, 75, 75, 'slot-3', true, true);
    expect(c.isBonus).toBe(true);
    expect(c.labelDomId).toBe('slot-3');
    expect(c.weaponTransferred).toBe(true);
  });
});

describe('GateComponent', () => {
  it('defaults consumed=false / isBonus=false / widthHalf=1.5', () => {
    const c = new GateComponent(GateType.ALLY_ADD, 5, 'count', null);
    expect(c.type).toBe(GateType.ALLY_ADD);
    expect(c.amount).toBe(5);
    expect(c.unit).toBe('count');
    expect(c.durationSec).toBeNull();
    expect(c.widthHalf).toBe(1.5);
    expect(c.consumed).toBe(false);
    expect(c.isBonus).toBe(false);
  });

  it('stores durationSec for buff gates', () => {
    const c = new GateComponent(GateType.ATTACK_UP, 30, 'percent', 10);
    expect(c.durationSec).toBe(10);
  });
});

describe('PlayerWeaponComponent', () => {
  it('defaults switchedAt=0 / currentWeaponMesh=null', () => {
    const c = new PlayerWeaponComponent(WeaponGenre.RIFLE);
    expect(c.genre).toBe(WeaponGenre.RIFLE);
    expect(c.switchedAt).toBe(0);
    expect(c.currentWeaponMesh).toBeNull();
  });
});

describe('ActiveBuffsComponent', () => {
  it('starts empty and allows applying buffs', () => {
    const c = new ActiveBuffsComponent();
    expect(c.buffs.size).toBe(0);
    c.buffs.set(GateType.ATTACK_UP, { remaining: 10, amount: 30 });
    expect(c.buffs.get(GateType.ATTACK_UP)).toEqual({ remaining: 10, amount: 30 });
  });

  it('accepts pre-populated buffs map', () => {
    const init = new Map();
    init.set(GateType.SPEED_UP, { remaining: 5, amount: 20 });
    const c = new ActiveBuffsComponent(init);
    expect(c.buffs.size).toBe(1);
    expect(c.buffs.get(GateType.SPEED_UP)?.amount).toBe(20);
  });
});
