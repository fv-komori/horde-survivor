import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        // data: 許可は dev のみ。glTF の埋め込み base64 buffer を
        // GLTFLoader 内部 FileLoader が fetch するための暫定緩和。
        // 本番は .glb（単一バイナリ）変換 + AssetManager.fetch+parse で data: URL を排除する想定（NFR-09）。
        "connect-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ].join('; '),
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
  },
});
