/** 最小限 DOM スタブ（tests/ui 向け）: jsdom 依存を避けつつ createElement / appendChild / textContent / classList / style を満たす */

export interface StubElement {
  tagName: string;
  className: string;
  textContent: string;
  style: Record<string, string>;
  children: StubElement[];
  parentElement: StubElement | null;
  attributes: Record<string, string>;
  classListSet: Set<string>;
  classList: {
    add: (c: string) => void;
    remove: (c: string) => void;
    toggle: (c: string) => void;
    contains: (c: string) => boolean;
  };
  appendChild: (child: StubElement) => StubElement;
  removeChild: (child: StubElement) => StubElement;
  remove: () => void;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  addEventListener: () => void;
  removeEventListener: () => void;
  querySelector: (sel: string) => StubElement | null;
  clientWidth: number;
  clientHeight: number;
  offsetWidth: number;
  firstChild: StubElement | null;
}

function createStubElement(tagName: string): StubElement {
  const el: StubElement = {
    tagName: tagName.toUpperCase(),
    className: '',
    textContent: '',
    style: {},
    children: [],
    parentElement: null,
    attributes: {},
    classListSet: new Set<string>(),
    get firstChild() {
      return this.children.length > 0 ? this.children[0] : null;
    },
    get clientWidth() { return 800; },
    get clientHeight() { return 600; },
    get offsetWidth() { return 0; },
    classList: {
      add(c: string) { el.classListSet.add(c); },
      remove(c: string) { el.classListSet.delete(c); },
      toggle(c: string) {
        if (el.classListSet.has(c)) el.classListSet.delete(c);
        else el.classListSet.add(c);
      },
      contains(c: string) { return el.classListSet.has(c); },
    },
    appendChild(child: StubElement) {
      if (child.parentElement) {
        const idx = child.parentElement.children.indexOf(child);
        if (idx >= 0) child.parentElement.children.splice(idx, 1);
      }
      el.children.push(child);
      child.parentElement = el;
      return child;
    },
    removeChild(child: StubElement) {
      const idx = el.children.indexOf(child);
      if (idx >= 0) el.children.splice(idx, 1);
      child.parentElement = null;
      return child;
    },
    remove() {
      if (el.parentElement) el.parentElement.removeChild(el);
    },
    setAttribute(k: string, v: string) { el.attributes[k] = v; },
    getAttribute(k: string) { return el.attributes[k] ?? null; },
    removeAttribute(k: string) { delete el.attributes[k]; },
    addEventListener() { /* no-op */ },
    removeEventListener() { /* no-op */ },
    querySelector(sel: string) {
      const cls = sel.startsWith('.') ? sel.slice(1) : null;
      if (!cls) return null;
      const stack = [...el.children];
      while (stack.length > 0) {
        const node = stack.shift()!;
        if (node.className.split(/\s+/).includes(cls)) return node;
        stack.unshift(...node.children);
      }
      return null;
    },
  };
  return el;
}

export function installDomStub(): StubElement {
  const root = createStubElement('div');
  const doc = {
    createElement: (tag: string) => createStubElement(tag),
    createElementNS: (_ns: string, tag: string) => createStubElement(tag),
  };
  (globalThis as unknown as { document: typeof doc }).document = doc;
  return root;
}
