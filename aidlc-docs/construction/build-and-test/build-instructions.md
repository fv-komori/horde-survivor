# Build Instructions

## Prerequisites
- **Node.js**: v18以上
- **npm**: v9以上
- **Build Tool**: Vite 5.2+ / TypeScript 5.4+

## Build Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. TypeScript Type Check
```bash
npx tsc --noEmit
```
- エラーなしで完了すること

### 3. Lint
```bash
npm run lint
```
- エラー0件、ワーニング0件で完了すること

### 4. Production Build
```bash
npm run build
```
- `tsc` + `vite build` が順に実行される
- 成果物は `dist/` ディレクトリに出力

### 5. Verify Build Success
- **Expected Output**:
  ```
  vite v5.x building for production...
  ✓ 51 modules transformed.
  dist/index.html                 ~1.1 kB │ gzip: ~0.6 kB
  dist/assets/index-XXXX.js      ~44.6 kB │ gzip: ~13.2 kB
  ✓ built in ~120ms
  ```
- **Build Artifacts**:
  - `dist/index.html` — CSPメタタグ付きHTML
  - `dist/assets/index-*.js` — ミニファイ済みバンドル（esbuild）
  - `dist/assets/index-*.js.map` — ソースマップ

### 6. Preview (Optional)
```bash
npm run preview
```
- ローカルで本番ビルド結果を確認

## Troubleshooting

### Build Fails with "terser not found"
- **Cause**: `vite.config.ts`の`minify`が`'terser'`になっている
- **Solution**: `minify: 'esbuild'`に変更（Vite標準ミニファイヤ）

### TypeScript Compilation Errors
- **Cause**: 型定義の不整合
- **Solution**: `npx tsc --noEmit` で個別確認し修正
