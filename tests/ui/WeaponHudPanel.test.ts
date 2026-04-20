import { installDomStub, type StubElement } from '../__mocks__/dom-stub';

let root: StubElement;
beforeEach(() => {
  root = installDomStub();
});

describe('WeaponHudPanel (Iter6 Phase 5)', () => {
  test('setGenre で flash が 0.3 秒発火、updateFlash で減算', async () => {
    const { WeaponHudPanel } = await import('../../src/ui/WeaponHudPanel');
    const { WeaponGenre } = await import('../../src/types');
    const p = new WeaponHudPanel(root as unknown as HTMLElement);

    expect(p.getFlashRemaining()).toBe(0);

    p.setGenre(WeaponGenre.SHOTGUN);
    expect(p.getCurrentGenre()).toBe(WeaponGenre.SHOTGUN);
    expect(p.getFlashRemaining()).toBeGreaterThan(0);

    p.updateFlash(0.2);
    expect(p.getFlashRemaining()).toBeCloseTo(0.1, 5);

    p.updateFlash(0.2);
    expect(p.getFlashRemaining()).toBe(0);
  });

  test('同じ genre への setGenre は flash 再発火しない', async () => {
    const { WeaponHudPanel } = await import('../../src/ui/WeaponHudPanel');
    const { WeaponGenre } = await import('../../src/types');
    const p = new WeaponHudPanel(root as unknown as HTMLElement);

    p.setGenre(WeaponGenre.MACHINEGUN);
    p.updateFlash(0.3);
    expect(p.getFlashRemaining()).toBe(0);

    p.setGenre(WeaponGenre.MACHINEGUN); // 同じ genre
    expect(p.getFlashRemaining()).toBe(0);
  });
});
