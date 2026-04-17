/**
 * Iter5 Construction Day 1 PoC: Inverted Hull Outline on SkinnedMesh
 *
 * 目的: geometry clone + skeleton 共有 bind 方式で、SkinnedMesh の反転ハル Outline が
 *       アニメーション（skinning）に追随するかを検証する。成立すれば設計書 FR-06 / C-06 の
 *       `outlineMesh?` 実装方針が確定。不成立なら Outline OFF でリリース（FR-06 退避策）。
 *
 * 備考: glTF は埋め込み base64 buffer を data:URL で持つため、GLTFLoader 内部 FileLoader が
 *       fetch() で再取得する際に `connect-src 'self'` CSP に阻まれる。
 *       dev だけ CSP を `connect-src 'self' data:` に緩和してPoCを通した。
 *       本番は .glb（単一バイナリ）変換 or 手動 base64 → Blob URL 経由で data: を排除する想定（NFR-09）。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const OUTLINE_VERTEX_SHADER = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>

uniform float outlineThickness;

void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>

  vec3 objectNormal = normalize(normal);
  #include <skinnormal_vertex>
  vec3 outlineNormal = normalize(normalMatrix * objectNormal);

  vec4 pos = modelViewMatrix * vec4(transformed, 1.0);
  pos.xyz += outlineNormal * outlineThickness;
  gl_Position = projectionMatrix * pos;
}
`;

const OUTLINE_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 outlineColor;
void main() {
  gl_FragColor = vec4(outlineColor, 1.0);
}
`;

const statusEl = document.getElementById('status')!;
const setStatus = (msg: string): void => {
  statusEl.textContent = msg;
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2a2a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(2.2, 1.8, 2.2);
camera.lookAt(0, 1.0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(3, 5, 2);
scene.add(dir);

const grid = new THREE.GridHelper(4, 8, 0x666666, 0x444444);
scene.add(grid);

type OutlineEntry = { mesh: THREE.SkinnedMesh; uniforms: { outlineThickness: { value: number }; outlineColor: { value: THREE.Color } } };
const outlineEntries: OutlineEntry[] = [];
let mixer: THREE.AnimationMixer | null = null;
let clips: THREE.AnimationClip[] = [];
let currentClipIdx = 0;
let currentAction: THREE.AnimationAction | null = null;
let outlineThickness = 0.02;

function createOutlineForSkinnedMesh(body: THREE.SkinnedMesh): void {
  const clonedGeo = body.geometry.clone();
  const uniforms = {
    outlineThickness: { value: outlineThickness },
    outlineColor: { value: new THREE.Color(0x000000) },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: OUTLINE_VERTEX_SHADER,
    fragmentShader: OUTLINE_FRAGMENT_SHADER,
    side: THREE.BackSide,
    uniforms,
  });
  const outline = new THREE.SkinnedMesh(clonedGeo, mat);
  outline.name = `${body.name}_outline`;
  outline.bind(body.skeleton, body.bindMatrix);
  outline.scale.copy(body.scale);
  outline.position.copy(body.position);
  outline.quaternion.copy(body.quaternion);

  body.parent!.add(outline);
  outlineEntries.push({ mesh: outline, uniforms });
}

function playClipByIndex(idx: number): void {
  if (!mixer || clips.length === 0) return;
  currentAction?.stop();
  const clip = clips[idx];
  currentAction = mixer.clipAction(clip);
  currentAction.reset().play();
  setStatus(`anim: ${clip.name} (${idx + 1}/${clips.length})  thickness=${outlineThickness.toFixed(3)}  outline=${outlineEntries[0]?.mesh.visible ? 'ON' : 'OFF'}`);
}

const loader = new GLTFLoader();
setStatus('loading Character_Soldier.gltf...');
loader.load(
  '/models/toon-shooter/v1/characters/Character_Soldier.gltf',
  (gltf) => {
    const root = gltf.scene;
    scene.add(root);

    const skinned: THREE.SkinnedMesh[] = [];
    root.traverse((obj) => {
      const sm = obj as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) skinned.push(sm);
    });

    if (skinned.length === 0) {
      setStatus('ERROR: no SkinnedMesh found in gltf.scene');
      return;
    }

    for (const body of skinned) createOutlineForSkinnedMesh(body);

    clips = gltf.animations;
    if (clips.length > 0) {
      mixer = new THREE.AnimationMixer(root);
      const runIdx = clips.findIndex((c) => c.name.toLowerCase() === 'run');
      currentClipIdx = runIdx >= 0 ? runIdx : 0;
      playClipByIndex(currentClipIdx);
    } else {
      setStatus(`loaded. SkinnedMesh=${skinned.length}, outlines=${outlineEntries.length}. No animations.`);
    }
  },
  undefined,
  (err) => {
    setStatus(`LOAD ERROR: ${(err as Error).message ?? err}`);
  }
);

window.addEventListener('keydown', (ev) => {
  if (ev.key === 'o' || ev.key === 'O') {
    for (const e of outlineEntries) e.mesh.visible = !e.mesh.visible;
    playClipByIndex(currentClipIdx);
  } else if (ev.key === ' ') {
    ev.preventDefault();
    if (clips.length > 0) {
      currentClipIdx = (currentClipIdx + 1) % clips.length;
      playClipByIndex(currentClipIdx);
    }
  } else if (ev.key === '+' || ev.key === '=') {
    outlineThickness = Math.min(outlineThickness + 0.005, 0.1);
    for (const e of outlineEntries) e.uniforms.outlineThickness.value = outlineThickness;
    playClipByIndex(currentClipIdx);
  } else if (ev.key === '-' || ev.key === '_') {
    outlineThickness = Math.max(outlineThickness - 0.005, 0.0);
    for (const e of outlineEntries) e.uniforms.outlineThickness.value = outlineThickness;
    playClipByIndex(currentClipIdx);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  mixer?.update(dt);
  renderer.render(scene, camera);
});
