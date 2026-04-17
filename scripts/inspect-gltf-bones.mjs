/** Character_Soldier.glb の bone 名一覧を出力する（Day 1 調査結果の確認用） */
import fs from 'node:fs/promises';
import path from 'node:path';

const GLB_PATH = path.resolve(process.cwd(), 'public/models/toon-shooter/v1/characters/Character_Soldier.glb');

// GLB は先頭 12B がヘッダ、その後に JSON chunk + BIN chunk
const buf = await fs.readFile(GLB_PATH);
if (buf.toString('ascii', 0, 4) !== 'glTF') {
  console.error('not a GLB file');
  process.exit(1);
}
const jsonLen = buf.readUInt32LE(12);
const jsonText = buf.toString('utf8', 20, 20 + jsonLen);
const json = JSON.parse(jsonText);

console.log('Nodes / Bones in Character_Soldier.glb:');
for (const n of json.nodes) {
  if (n.name) console.log(`  ${n.name}`);
}
