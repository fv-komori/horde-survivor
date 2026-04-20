import { installDomStub, type StubElement } from '../__mocks__/dom-stub';

let root: StubElement;
beforeEach(() => {
  root = installDomStub();
  // ResizeObserver はスタブ環境で undefined（WorldToScreenLabel 内部で else に分岐）
});

describe('WorldToScreenLabel (Iter6 Phase 5)', () => {
  test('プール 6 スロット、acquire/release で free/assigned 数が変動', async () => {
    const { WorldToScreenLabel } = await import('../../src/ui/WorldToScreenLabel');
    const label = new WorldToScreenLabel(root as unknown as HTMLElement);

    expect(label.getPoolSize()).toBe(6);
    expect(label.getFreeCount()).toBe(6);
    expect(label.getAssignedCount()).toBe(0);

    const el1 = label.acquire(1, '100', () => ({ x: 0, y: 0, z: 0 }));
    expect(el1).not.toBeNull();
    expect(label.getFreeCount()).toBe(5);
    expect(label.getAssignedCount()).toBe(1);

    label.release(1);
    expect(label.getFreeCount()).toBe(6);
    expect(label.getAssignedCount()).toBe(0);
  });

  test('プール枯渇時、normal は null を返すが bonus は normal を evict', async () => {
    const { WorldToScreenLabel } = await import('../../src/ui/WorldToScreenLabel');
    const label = new WorldToScreenLabel(root as unknown as HTMLElement);

    // 6 枠 normal で埋める
    for (let i = 1; i <= 6; i++) {
      label.acquire(i, `${i}`, () => ({ x: 0, y: 0, z: 0 }), 'normal');
    }
    expect(label.getFreeCount()).toBe(0);

    // 7 件目の normal は null
    const failed = label.acquire(7, '7', () => ({ x: 0, y: 0, z: 0 }), 'normal');
    expect(failed).toBeNull();
    expect(label.getAssignedCount()).toBe(6);

    // 7 件目の bonus は最古の normal(=1) を evict して assign 成功
    const bonus = label.acquire(7, '7', () => ({ x: 0, y: 0, z: 0 }), 'bonus');
    expect(bonus).not.toBeNull();
    expect(label.getAssignedCount()).toBe(6);
  });

  test('resetAll で全解放', async () => {
    const { WorldToScreenLabel } = await import('../../src/ui/WorldToScreenLabel');
    const label = new WorldToScreenLabel(root as unknown as HTMLElement);

    label.acquire(1, 'a', () => ({ x: 0, y: 0, z: 0 }));
    label.acquire(2, 'b', () => ({ x: 0, y: 0, z: 0 }));
    expect(label.getAssignedCount()).toBe(2);

    label.resetAll();
    expect(label.getAssignedCount()).toBe(0);
    expect(label.getFreeCount()).toBe(6);
  });

  test('XSS 攻撃文字列は textContent として保存 (実行されない)', async () => {
    const { WorldToScreenLabel } = await import('../../src/ui/WorldToScreenLabel');
    const label = new WorldToScreenLabel(root as unknown as HTMLElement);

    const hostile = '<img src=x onerror=window.hacked=true>';
    const el = label.acquire(1, hostile, () => ({ x: 0, y: 0, z: 0 })) as unknown as StubElement;
    expect(el.textContent).toBe(hostile);
    expect(el.children.length).toBe(0); // 子要素が生成されない
  });
});
