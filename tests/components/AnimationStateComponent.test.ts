import { AnimationStateComponent } from '../../src/components/AnimationStateComponent';

describe('AnimationStateComponent', () => {
  it('defaults to Idle state with zero one-shot timer', () => {
    const c = new AnimationStateComponent();
    expect(c.current).toBe('Idle');
    expect(c.previous).toBeNull();
    expect(c.oneShotRemaining).toBe(0);
    expect(c.deathComplete).toBe(false);
  });

  it('accepts an explicit initial state', () => {
    const c = new AnimationStateComponent('Run');
    expect(c.current).toBe('Run');
  });

  it('mutates current / oneShotRemaining / deathComplete without losing previous', () => {
    const c = new AnimationStateComponent();
    c.previous = 'Idle';
    c.current = 'HitReact';
    c.oneShotRemaining = 0.5;
    expect(c.current).toBe('HitReact');
    expect(c.previous).toBe('Idle');

    c.current = 'Death';
    c.oneShotRemaining = 0.77;
    c.deathComplete = true;
    expect(c.current).toBe('Death');
    expect(c.deathComplete).toBe(true);
  });
});
