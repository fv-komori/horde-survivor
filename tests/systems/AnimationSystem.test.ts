import { World } from '../../src/ecs/World';
import { AnimationSystem } from '../../src/systems/AnimationSystem';
import { AnimationStateComponent } from '../../src/components/AnimationStateComponent';
import { HITREACT_DURATION, ANIM_DURATIONS } from '../../src/config/BoneAttachmentConfig';

describe('AnimationSystem', () => {
  let world: World;
  let system: AnimationSystem;

  beforeEach(() => {
    world = new World();
    system = new AnimationSystem();
  });

  describe('playHitReact', () => {
    it('sets current to HitReact and seeds the HITREACT_DURATION timer', () => {
      const id = world.createEntity();
      world.addComponent(id, new AnimationStateComponent('Idle'));

      system.playHitReact(world, id);

      const anim = world.getComponent(id, AnimationStateComponent)!;
      expect(anim.current).toBe('HitReact');
      expect(anim.oneShotRemaining).toBeCloseTo(HITREACT_DURATION);
    });

    it('is ignored while the entity is already in Death', () => {
      const id = world.createEntity();
      const anim = new AnimationStateComponent('Death');
      anim.oneShotRemaining = 0.5;
      world.addComponent(id, anim);

      system.playHitReact(world, id);

      expect(anim.current).toBe('Death');
      expect(anim.oneShotRemaining).toBe(0.5);
    });

    it('is a no-op when the entity has no AnimationStateComponent', () => {
      const id = world.createEntity();
      expect(() => system.playHitReact(world, id)).not.toThrow();
    });

    it('skips retrigger while more than half of HITREACT_DURATION remains (rapid-fire throttle)', () => {
      const id = world.createEntity();
      world.addComponent(id, new AnimationStateComponent('Idle'));

      system.playHitReact(world, id);
      const anim = world.getComponent(id, AnimationStateComponent)!;
      const firstRemaining = anim.oneShotRemaining;
      // 連射相当の即時再呼び出し: 残り時間が減らないことを期待
      system.playHitReact(world, id);
      expect(anim.oneShotRemaining).toBeCloseTo(firstRemaining);
    });

    it('allows retrigger once remaining falls to half or below', () => {
      const id = world.createEntity();
      world.addComponent(id, new AnimationStateComponent('Idle'));

      system.playHitReact(world, id);
      const anim = world.getComponent(id, AnimationStateComponent)!;
      // HitReact 再生中盤に進める
      anim.oneShotRemaining = HITREACT_DURATION * 0.4;

      system.playHitReact(world, id);
      expect(anim.oneShotRemaining).toBeCloseTo(HITREACT_DURATION);
    });
  });

  describe('playDeath', () => {
    it('sets current to Death and seeds ANIM_DURATIONS.Death', () => {
      const id = world.createEntity();
      world.addComponent(id, new AnimationStateComponent('Run'));

      system.playDeath(world, id);

      const anim = world.getComponent(id, AnimationStateComponent)!;
      expect(anim.current).toBe('Death');
      expect(anim.oneShotRemaining).toBeCloseTo(ANIM_DURATIONS.Death);
      expect(anim.deathComplete).toBe(false);
    });

    it('overrides an in-flight HitReact (Death has highest priority)', () => {
      const id = world.createEntity();
      const anim = new AnimationStateComponent('HitReact');
      anim.oneShotRemaining = 0.2;
      world.addComponent(id, anim);

      system.playDeath(world, id);

      expect(anim.current).toBe('Death');
      expect(anim.oneShotRemaining).toBeCloseTo(ANIM_DURATIONS.Death);
    });
  });

  it('reset() clears internal action cache without touching components', () => {
    const id = world.createEntity();
    world.addComponent(id, new AnimationStateComponent('Idle'));
    expect(() => system.reset()).not.toThrow();

    const anim = world.getComponent(id, AnimationStateComponent)!;
    expect(anim.current).toBe('Idle');
  });
});
