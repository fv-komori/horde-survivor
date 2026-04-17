/**
 * public/models/toon-shooter/v1 配下の .gltf をすべて .glb（単一バイナリ）に変換する。
 *
 * 目的: glTF 埋め込み base64 buffer の data:URL を排除し、
 *       本番 CSP `connect-src 'self'` の最小権限（NFR-09）を維持する。
 *
 * 使い方: node scripts/convert-gltf-to-glb.mjs
 *
 * 出力先: 入力と同じディレクトリに .glb を追加作成（.gltf は残す）
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import gltfPipeline from 'gltf-pipeline';

const { gltfToGlb } = gltfPipeline;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'public', 'models', 'toon-shooter', 'v1');

/** @param {string} dir */
async function collectGltf(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await collectGltf(p)));
    else if (e.isFile() && e.name.toLowerCase().endsWith('.gltf')) out.push(p);
  }
  return out;
}

async function convert(gltfPath) {
  const rel = path.relative(ROOT, gltfPath);
  const raw = JSON.parse(await fs.readFile(gltfPath, 'utf8'));
  const { glb } = await gltfToGlb(raw);
  const glbPath = gltfPath.replace(/\.gltf$/i, '.glb');
  await fs.writeFile(glbPath, glb);
  const before = (await fs.stat(gltfPath)).size;
  const after = (await fs.stat(glbPath)).size;
  const delta = (((after - before) / before) * 100).toFixed(1);
  console.log(
    `  ${rel.padEnd(48)} ${(before / 1024).toFixed(0).padStart(6)} KB -> ${(after / 1024).toFixed(0).padStart(6)} KB  (${delta >= 0 ? '+' : ''}${delta}%)`
  );
}

async function main() {
  console.log(`root: ${ROOT}`);
  const files = await collectGltf(ROOT);
  console.log(`found ${files.length} .gltf files, converting to .glb ...`);
  for (const f of files) await convert(f);
  console.log('done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
