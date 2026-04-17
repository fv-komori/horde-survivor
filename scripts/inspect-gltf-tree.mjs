/** 指定 GLB の node ツリー構造を出力（親子関係 + mesh 有無） */
import fs from 'node:fs/promises';
import path from 'node:path';

const ARG = process.argv[2] || 'public/models/toon-shooter/v1/characters/Character_Enemy.glb';
const GLB_PATH = path.resolve(process.cwd(), ARG);

const buf = await fs.readFile(GLB_PATH);
const jsonLen = buf.readUInt32LE(12);
const jsonText = buf.toString('utf8', 20, 20 + jsonLen);
const json = JSON.parse(jsonText);

const nodes = json.nodes;

function printNode(idx, depth = 0) {
  const n = nodes[idx];
  const name = n.name ?? `(unnamed-${idx})`;
  const hasMesh = n.mesh !== undefined;
  const meshName = hasMesh ? json.meshes?.[n.mesh]?.name ?? '' : '';
  console.log(`${'  '.repeat(depth)}${name}${hasMesh ? `  [mesh=${meshName}]` : ''}`);
  if (n.children) for (const c of n.children) printNode(c, depth + 1);
}

const scene = json.scenes[0];
for (const root of scene.nodes) printNode(root);
