/** GLB の AnimationClip 名一覧を出力（Iter5 動作検証用） */
import fs from 'node:fs/promises';
import path from 'node:path';

const ARG = process.argv[2] || 'public/models/toon-shooter/v1/characters/Character_Soldier.glb';
const GLB_PATH = path.resolve(process.cwd(), ARG);

const buf = await fs.readFile(GLB_PATH);
const jsonLen = buf.readUInt32LE(12);
const jsonText = buf.toString('utf8', 20, 20 + jsonLen);
const json = JSON.parse(jsonText);

console.log(`Animations in ${path.basename(GLB_PATH)}:`);
for (const a of json.animations ?? []) console.log(`  ${a.name}`);
