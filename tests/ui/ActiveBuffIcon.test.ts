import { installDomStub, type StubElement } from '../__mocks__/dom-stub';

let root: StubElement;
beforeEach(() => {
  root = installDomStub();
});

describe('ActiveBuffIcon (Iter6 Phase 5)', () => {
  test('setBuffs は 3 スロットまで表示し、超過分は無視', async () => {
    const { ActiveBuffIcon } = await import('../../src/ui/ActiveBuffIcon');
    const { BuffType } = await import('../../src/types');

    const icon = new ActiveBuffIcon(root as unknown as HTMLElement);

    icon.setBuffs([
      { type: BuffType.ATTACK_UP, remaining: 5 },
      { type: BuffType.SPEED_UP, remaining: 3 },
    ]);

    // root 直下は buff-container、さらに子が 3 スロット（最大）
    const container = root.children[0];
    expect(container.className).toBe('hud-buff-container');
    expect(container.children.length).toBe(3);

    // slot 0,1 は表示、slot 2 は非表示
    expect(container.children[0].style.display).toBe('');
    expect(container.children[1].style.display).toBe('');
    expect(container.children[2].style.display).toBe('none');
  });

  test('reset で全スロット非表示', async () => {
    const { ActiveBuffIcon } = await import('../../src/ui/ActiveBuffIcon');
    const { BuffType } = await import('../../src/types');

    const icon = new ActiveBuffIcon(root as unknown as HTMLElement);
    icon.setBuffs([{ type: BuffType.ATTACK_UP, remaining: 1 }]);

    const container = root.children[0];
    expect(container.children[0].style.display).toBe('');

    icon.reset();
    expect(container.children[0].style.display).toBe('none');
  });
});
