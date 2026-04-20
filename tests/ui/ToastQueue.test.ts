import { installDomStub, type StubElement } from '../__mocks__/dom-stub';

let root: StubElement;
beforeEach(() => {
  root = installDomStub();
});

describe('ToastQueue (Iter6 Phase 5)', () => {
  test('push で表示、tick で remaining が 0 になったら消える', async () => {
    const { ToastQueue } = await import('../../src/ui/ToastQueue');
    const q = new (ToastQueue as unknown as new (p: unknown) => InstanceType<typeof ToastQueue>)(root as unknown as HTMLElement);

    q.push({ kind: 'WEAPON', text: 'RIFLE' });
    expect(q.getCurrentText()).toBe('RIFLE');

    q.tick(0.4);
    expect(q.getCurrentText()).toBe('RIFLE');

    q.tick(0.5); // default duration 0.8 を超過
    expect(q.getCurrentText()).toBeNull();
  });

  test('同種同文言連続 push は extend (キューを増やさない)', async () => {
    const { ToastQueue } = await import('../../src/ui/ToastQueue');
    const q = new (ToastQueue as unknown as new (p: unknown) => InstanceType<typeof ToastQueue>)(root as unknown as HTMLElement);

    q.push({ kind: 'GAIN', text: '+3 仲間' });
    q.tick(0.5);
    q.push({ kind: 'GAIN', text: '+3 仲間' }); // 同種同文言 → extend
    expect(q.getCurrentText()).toBe('+3 仲間');
    expect(q.getQueueSize()).toBe(0);

    // extend で remaining が 0.8 にリセット
    q.tick(0.5);
    expect(q.getCurrentText()).toBe('+3 仲間');
  });

  test('キューは上限 3、超過は古い順に破棄', async () => {
    const { ToastQueue } = await import('../../src/ui/ToastQueue');
    const q = new (ToastQueue as unknown as new (p: unknown) => InstanceType<typeof ToastQueue>)(root as unknown as HTMLElement);

    q.push({ kind: 'WEAPON', text: 'A' }); // current
    q.push({ kind: 'GAIN', text: 'B' });   // queue[0]
    q.push({ kind: 'BUFF', text: 'C' });   // queue[1]
    q.push({ kind: 'WAVE', text: 'D' });   // queue[2]
    q.push({ kind: 'MAX', text: 'E' });   // 上限超過: B を破棄

    expect(q.getCurrentText()).toBe('A');
    expect(q.getQueueSize()).toBe(3);
  });

  test('XSS 攻撃文字列は textContent として表示 (実行されない)', async () => {
    const { ToastQueue } = await import('../../src/ui/ToastQueue');
    const q = new (ToastQueue as unknown as new (p: unknown) => InstanceType<typeof ToastQueue>)(root as unknown as HTMLElement);

    const hostile = '<script>window.hacked=true</script>';
    q.push({ kind: 'GAIN', text: hostile });
    expect(q.getCurrentText()).toBe(hostile);
    // root の子 ( hud-toast DOM) は script を child として持たない、textContent でのみ保持
    const toast = root.children[0];
    expect(toast.children.length).toBe(0);
    expect(toast.textContent).toBe(hostile);
  });
});
