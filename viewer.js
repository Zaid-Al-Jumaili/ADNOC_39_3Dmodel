// Existing Level 37 floor - 3D model only (dollhouse view: drag to orbit, scroll to zoom, click a zone label to fly there)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TEX, ZONES } from './data.js';

// Blender (x, y, z-up) -> three (x, z, -y)
const W3 = (x, y, z = 0) => new THREE.Vector3(x, z, -y);
const $ = (s) => document.querySelector(s);

const root = $('#viewer'), canvas = $('#viewer canvas'), loading = $('#viewer .m-load'), bar = $('#viewer .m-load .bar i'), tagsBox = $('#viewer .tags');
let renderer, scene, camera, controls, tween = null, preparing = false, touched = false;
const matLib = {}, texCache = new Map(), tags = [];

// ------------------------------------------------------------------ scene
function init() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a111d');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  camera = new THREE.PerspectiveCamera(42, 1, 0.05, 6000);
  camera.position.copy(homePos(innerWidth / innerHeight));
  controls = new OrbitControls(camera, canvas);
  controls.target.copy(W3(28, -10, 0));
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.addEventListener('start', () => { touched = true; tween = null; });
  controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 4; controls.maxDistance = 140;
  const hemi = new THREE.HemisphereLight(0xfff3e2, 0x3a3228, 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.4); sun.position.copy(W3(-30, -60, 60)); scene.add(sun);
  scene.userData.rtLights = [hemi, sun];
  window.addEventListener('resize', resize);
  resize();
}

// home view: looks north-north-west over the floor from the south, far enough to fit the ~87 m plate
function homePos(aspect) {
  const t = Math.tan(THREE.MathUtils.degToRad(21));
  const dist = Math.max(40, Math.min(135, Math.max(46 / (t * aspect), 17 / t)));
  const dir = new THREE.Vector3(2, -38, 42).normalize();
  return W3(28 + dir.x * dist, -10 + dir.y * dist, dir.z * dist);
}

function resize() {
  const w = root.clientWidth || innerWidth, hh = root.clientHeight || innerHeight;
  renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix();
  if (!touched) camera.position.copy(homePos(camera.aspect));
}

// ------------------------------------------------------------------ materials (same look as the design experience)
function texture(file, srgb, rx = 1, ry = 1) {
  const key = file + rx + ':' + ry;
  if (texCache.has(key)) return texCache.get(key);
  const t = new THREE.TextureLoader().load('media/tex/' + file);
  t.flipY = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  texCache.set(key, t);
  return t;
}
const PLAIN = {
  white_corian: [0xebebe9, 0.25], corian_warm: [0xdacdb5, 0.3], white: [0xe0e0de, 0.4], black_matte: [0x050505, 0.6], black_gloss: [0x030303, 0.1],
  charcoal: [0x131315, 0.5], alu_dark: [0x18191a, 0.35, 1], alu: [0x9da0a3, 0.3, 1], chrome: [0xc8c8cc, 0.08, 1], mesh_grey: [0x2e2f31, 0.7], mesh_white: [0xc4c4c2, 0.7],
  fabric_grey: [0x5a5c60, 0.95], fabric_blue: [0x1e3463, 0.95], fabric_felt_sand: [0x8f7a60, 0.98], fabric_felt_olive: [0x55593f, 0.98], blue_glass: [0x0b2a9e, 0.05],
  soil: [0x1f1711, 1], city: [0x9a8d7c, 0.9], city_tower: [0xa3abb4, 0.25, 0.4], screen_off: [0x020304, 0.06], leaf: [0x34502a, 0.6], leaf_olive: [0x5d6a48, 0.6],
  leaf_palm: [0x4d6630, 0.6], green_wall: [0x3f5a25, 0.95], sea: [0x06202c, 0.08], ext_facade: [0x1a2129, 0.1, 0.5],
};
const EMIT = { led_warm: 0xffd2a0, led_toe: 0xffd8ae, led_slot: 0xfff0dc, led_neutral: 0xffe7c8, led_lilac: 0xc88cff, led_blue: 0x5aa8ff, downlight: 0xfff1df,
  stretch_light: 0xfff6ea, holo: 0x8fd8ff, lantern_glow: 0xffc684 };
const GLASS = { glass: [0xf3f7f8, 0.18], glass_balustrade: [0xe5f4f2, 0.2], pdlc_glass: [0xf5f7f8, 0.24], glass_tint: [0x8a9599, 0.45], facade_glass: [0x9fb0b6, 0.22], net: [0x111111, 0.15] };
const ALIAS = { walnut_stone: 'walnut', walnut_leather: 'walnut', walnut_brass: 'walnut', oak_acoustic: 'oak_slat', white_fluted: 'fluted_sand', granite: 'stone_grey',
  lift_steel: 'fluted_steel', decking: 'timber_floor', planter_stone: 'travertine', bark: 'walnut', fabric_sand: 'boucle_sand', fabric_olive: 'boucle_olive', bronze_light: 'bronze',
  column_steel: 'fluted_steel', column_steel_spiral: 'fluted_steel', sadu_rug: 'carpet_sadu' };
const TINT = { granite: 0xffffff, decking: 0xd9ccbf, bark: 0xbfae99 };
const METAL = { bronze: 1, brass: 1, gold: 1, fluted_steel: 1 };

function makeMaterial(rawName) {
  const name = rawName.replace(/\.\d{3}$/, '');
  if (matLib[name]) return matLib[name];
  let m;
  if (name.startsWith('screen:')) {
    let f = name.slice(7);
    if (!/\.(jpg|png)$/i.test(f)) f += '.jpg';
    const t = new THREE.TextureLoader().load('media/screens/' + f);
    t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
    m = new THREE.MeshBasicMaterial({ map: t, transparent: f.endsWith('.png'), toneMapped: false });
    m.color.setScalar(f.includes('adnoc_mark') ? 0.95 : 1.15);
  } else if (EMIT[name]) {
    m = new THREE.MeshBasicMaterial({ color: EMIT[name], toneMapped: false });
    m.color.multiplyScalar(1.6);
  } else if (GLASS[name]) {
    m = new THREE.MeshPhysicalMaterial({ color: GLASS[name][0], roughness: 0.05, metalness: 0, transparent: true, opacity: GLASS[name][1], depthWrite: false, envMapIntensity: 1.4 });
  } else if (PLAIN[name]) {
    const [c, r, met] = PLAIN[name];
    m = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: met || 0 });
  } else {
    const key = TEX[name] ? name : ALIAS[name];
    const meta = key && TEX[key];
    if (meta) {
      const [sx, sy] = meta.size;
      m = new THREE.MeshStandardMaterial({ map: texture(meta.col, true, 1 / sx, 1 / sy), roughness: meta.rough ?? 0.6, metalness: METAL[name] ?? METAL[key] ?? meta.metal ?? 0 });
      if (meta.nrm) { m.normalMap = texture(meta.nrm, false, 1 / sx, 1 / sy); m.normalScale.set(0.6, 0.6); }
      if (meta.rgh) m.roughnessMap = texture(meta.rgh, false, 1 / sx, 1 / sy);
      if (TINT[name]) m.color.set(TINT[name]);
    } else {
      m = new THREE.MeshStandardMaterial({ color: 0xbdb5a8, roughness: 0.6 });
    }
  }
  m.name = name;
  matLib[name] = m;
  return m;
}

// ------------------------------------------------------------------ loading
async function load() {
  const draco = new DRACOLoader(); draco.setDecoderPath('vendor/three/jsm/libs/draco/gltf/');
  const gl = new GLTFLoader(); gl.setDRACOLoader(draco);
  let lm = null;
  try { lm = await fetch('media/models/L37_existing.lightmaps.json').then((r) => (r.ok ? r.json() : null)); } catch (e) { lm = null; }
  const gltf = await new Promise((res, rej) => gl.load('media/models/L37_existing.glb', res, (p) => { if (p.total) bar.style.width = (p.loaded / p.total * 50) + '%'; }, rej));
  const group = gltf.scene;
  group.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const repl = mats.map((mm) => makeMaterial(mm.name || 'default'));
    o.material = Array.isArray(o.material) ? repl : repl[0];
    // ceilings off, so the dollhouse view looks into the rooms
    const ceil = /^(Ceiling|BAKE_ceilings|Downlight|Cove|Linear light|Light line|Accent lens|Acoustic baffle|Brass lantern)/i.test(o.name) || /^(Ceiling|BAKE_ceilings)/i.test(o.parent?.name || '');
    if (ceil) o.visible = false;
  });
  if (lm) applyLightmaps(group, lm);
  scene.add(group);
  preparing = true;
  try { await prepare(group); } finally { preparing = false; }
  loading.style.opacity = 0; setTimeout(() => { loading.style.display = 'none'; }, 600);
  buildTags();
}

// upload textures and compile shaders behind the loading screen (no half-textured first frames)
async function prepare(group) {
  const label = loading.querySelector('.label'), was = label.textContent;
  label.textContent = 'Preparing materials';
  const texs = new Set();
  group.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) for (const k of ['map', 'normalMap', 'roughnessMap', 'lightMap']) if (m[k]) texs.add(m[k]);
  });
  const list = [...texs];
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const t0 = performance.now();
  while (list.some((t) => !t.image) && performance.now() - t0 < 15000) { bar.style.width = (50 + 25 * list.filter((t) => t.image).length / list.length) + '%'; await frame(); }
  for (let i = 0; i < list.length; i++) {
    if (list[i].image) renderer.initTexture(list[i]);
    if (i % 6 === 5) { bar.style.width = (75 + 22 * i / list.length) + '%'; await frame(); }
  }
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* first frame compiles instead */ }
  bar.style.width = '100%';
  label.textContent = was;
}

function applyLightmaps(group, man) {
  const ld = new THREE.TextureLoader();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const entry = man.objects?.[o.name] || man.objects?.[o.parent?.name];
    if (!entry || !o.geometry.attributes.uv1) return;
    const t = ld.load('media/models/' + entry.file);
    t.colorSpace = THREE.SRGBColorSpace; t.channel = 1; t.flipY = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((mm) => {
      if (mm.isMeshBasicMaterial || mm.transparent) return mm;
      const c = mm.clone();
      c.lightMap = t; c.lightMapIntensity = (man.scale || 4) * Math.PI * (entry.gain || 1);
      c.envMapIntensity = 0.35;
      return c;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  scene.userData.rtLights.forEach((l) => { l.intensity *= 0.75; });
}

// ------------------------------------------------------------------ zone labels
function buildTags() {
  ZONES.forEach((z) => {
    const el = document.createElement('div');
    el.className = 'tag3d';
    el.innerHTML = `<b>${z.n}</b>${z.title}`;
    el.addEventListener('click', () => flyTo(z));
    tagsBox.append(el);
    tags.push({ el, p: W3(z.at[0], z.at[1], 3.4) });
  });
}

function updateTags() {
  const w = canvas.clientWidth, hh = canvas.clientHeight;
  tags.forEach((t) => {
    const v = t.p.clone().project(camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    t.el.style.display = vis ? '' : 'none';
    if (vis) {
      const half = t.el.offsetWidth / 2 + 10;
      t.el.style.left = Math.max(half, Math.min(w - half, (v.x + 1) / 2 * w)) + 'px';
      t.el.style.top = Math.max(44, Math.min(hh - 70, (1 - v.y) / 2 * hh)) + 'px';
    }
  });
}

function flyTo(z) {
  touched = true;
  const target = W3(z.at[0], z.at[1], 0.8);
  const dir = camera.position.clone().sub(controls.target).normalize();
  const pos = target.clone().add(dir.multiplyScalar(16));
  pos.y = Math.max(pos.y, 9);
  const p0 = camera.position.clone(), t0 = controls.target.clone(), s = performance.now(), ms = 1400;
  tween = (now) => {
    const k = Math.min(1, (now - s) / ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(p0, pos, e); controls.target.lerpVectors(t0, target, e);
    if (k >= 1) tween = null;
  };
}

function loop() {
  requestAnimationFrame(loop);
  if (tween) tween(performance.now());
  controls.update();
  if (!preparing) renderer.render(scene, camera);
  updateTags();
}

init();
requestAnimationFrame(loop);
load().catch((e) => {
  loading.querySelector('.label').textContent = 'The 3D model could not be loaded';
  console.error(e);
});
