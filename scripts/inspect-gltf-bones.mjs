/** 指定 GLB の node 名一覧を出力（Iter5: 武器名調査用） */
import fs from 'node:fs/promises';
import path from 'node:path';

const ARG = process.argv[2] || 'public/models/toon-shooter/v1/characters/Character_Enemy.glb';
const GLB_PATH = path.resolve(process.cwd(), ARG);

const buf = await fs.readFile(GLB_PATH);
if (buf.toString('ascii', 0, 4) !== 'glTF') {
  console.error('not a GLB file');
  process.exit(1);
}
const jsonLen = buf.readUInt32LE(12);
const jsonText = buf.toString('utf8', 20, 20 + jsonLen);
const json = JSON.parse(jsonText);

console.log(`Nodes in ${path.basename(GLB_PATH)}:`);
for (const n of json.nodes) {
  if (n.name) console.log(`  ${n.name}`);
}
