import { AssetManager } from '../../src/managers/AssetManager';

describe('AssetManager', () => {
  describe('initial state', () => {
    it('reports not loaded until loadAll completes', () => {
      const am = new AssetManager();
      expect(am.isLoaded()).toBe(false);
      expect(am.hasCharacter('SOLDIER')).toBe(false);
    });

    it('throws on getCharacter / getGun / getEnv before load', () => {
      const am = new AssetManager();
      expect(() => am.getCharacter('SOLDIER')).toThrow();
      expect(() => am.getGun('AK')).toThrow();
      expect(() => am.getEnv('Crate')).toThrow();
    });

    it('restoreTextures is safe to call before any templates are loaded', () => {
      const am = new AssetManager();
      expect(() => am.restoreTextures()).not.toThrow();
    });
  });
});
