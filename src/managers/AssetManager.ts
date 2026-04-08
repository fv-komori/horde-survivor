import { GAME_CONFIG } from '../config/gameConfig';

/**
 * M-06: アセットマネージャー
 * スプライト画像・フォント等のアセット読み込みとキャッシュ
 * 初期実装ではドット絵をコード描画するため、プレースホルダー実装
 */
export class AssetManager {
  private loaded: boolean = false;

  /** アセット読み込み（NFR-08: 失敗時はプレースホルダーで���替） */
  async loadAll(): Promise<void> {
    try {
      // 現時点ではコード描画のため、外部アセットは不要
      // 将来的にスプライトシート等を読み込む場合はここに追加
      this.loaded = true;
    } catch (error) {
      console.warn(
        `${GAME_CONFIG.logPrefix}[WARN][AssetManager] Asset loading failed, using placeholders`,
        error,
      );
      this.loaded = true; // プレースホルダーで続行
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  /** スプライト取得（将来用） */
  getSprite(_key: string): ImageBitmap | null {
    return null; // コード描画のためnull
  }
}
