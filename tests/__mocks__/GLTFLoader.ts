/** Jest: GLTFLoader の簡易スタブ（テストでは AssetManager.loadAll() を呼ばないため最小 shim） */
export class GLTFLoader {
  async loadAsync(): Promise<{ scene: object; animations: unknown[] }> {
    return { scene: {}, animations: [] };
  }
  load(): void {}
  parse(): void {}
}
