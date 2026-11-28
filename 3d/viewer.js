// Fit & Food – 3D-speler: scène, camera, draaien, thumbnails.
import * as THREE from 'three';
import { Figure, solve, makeProps, updateProps, sample, tick } from './fig3d.js';
import { EX3D, MUS3D } from './ex3d.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function buildScene(id, sex, mus) {
  const def = EX3D[id]; if (!def) return null;
  const scene = new THREE.Scene(); scene.background = null;
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9b9c2', 1.25));
  const key = new THREE.DirectionalLight('#ffffff', 2.0); key.position.set(2.2, 4.2, 2.8); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 2.6, bottom: -2.2, near: 0.5, far: 12 }); key.shadow.radius = 4; key.shadow.bias = -0.0005;
  scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight('#ffffff', 0.6); rim.position.set(-3, 2, -2.5); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.15 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const fig = new Figure(scene, sex, mus ?? def.mus ?? MUS3D[id] ?? '');
  const props = makeProps(scene, def.props);
  // camera-doel: omhullende van figuur + attributen over de beweging
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  for (let i = 0; i < 10; i++) { const tt = i / 10 * 6, J = solve(sample(def, tt), sex); fig.pose(J); updateProps(props, J, tt); tmp.setFromObject(fig.g); box.union(tmp); props.forEach(o => { tmp.setFromObject(o.g); if (!tmp.isEmpty()) box.union(tmp); }); }
  box.min.y = Math.max(0, box.min.y);
  const c = box.getCenter(V()), sz = box.getSize(V());
  const size = Math.max(Math.hypot(sz.x, sz.z) * 0.7, sz.y * 1.02) + 0.12;
  return { scene, def, fig, props, center: c, size, sex };
}

function frame(S, t) { tick(t); const pose = sample(S.def, t, S.sex); const J = solve(pose, S.sex); S.fig.pose(J); updateProps(S.props, J, t); }

function camPos(cam, S, az, el, aspect, zoom = 1) {
  const fov = cam.fov * Math.PI / 180, fit = S.size * 0.5 / Math.tan(fov / 2) / Math.min(1, aspect) * 1.05 * zoom;
  const d = fit;
  cam.position.set(S.center.x + d * Math.cos(el) * Math.sin(az), S.center.y + d * Math.sin(el), S.center.z + d * Math.cos(el) * Math.cos(az));
  cam.lookAt(S.center);
}

let shared = null;
function sharedRenderer() { if (shared) return shared; const c = document.createElement('canvas'); shared = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true }); shared.setPixelRatio(1); shared.shadowMap.enabled = true; shared.shadowMap.type = THREE.PCFSoftShadowMap; shared.outputColorSpace = THREE.SRGBColorSpace; return shared; }
const thumbCache = new Map();
export function thumb(id, sex = 'm', size = 160, mus) {
  const k = id + sex + size; if (thumbCache.has(k)) return thumbCache.get(k);
  const S = buildScene(id, sex, mus); if (!S) return null;
  const r = sharedRenderer(); r.setSize(size, size, false);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  frame(S, S.def.thumbT ?? 1.3); camPos(cam, S, (S.def.az ?? 0.75), (S.def.el ?? 0.32), 1, 0.8);
  r.setClearColor(0xffffff, 1); r.render(S.scene, cam);
  const url = r.domElement.toDataURL('image/jpeg', 0.82);
  S.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  thumbCache.set(k, url); return url;
}

export function mount(el, id, sex = 'm', opts = {}) {
  const S = buildScene(id, sex, opts.mus); if (!S) return null;
  const canvas = document.createElement('canvas'); canvas.className = 'f3d'; canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
  el.innerHTML = ''; el.appendChild(canvas);
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xffffff, 0);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  let az = S.def.az ?? 0.75, el0 = S.def.el ?? 0.32, elv = el0, drag = null, alive = true, t0 = performance.now(), last = 0, auto = true;
  const down = e => { drag = { x: e.clientX, y: e.clientY, az, el: elv, moved: false }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; };
  const move = e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) > 3) { drag.moved = true; auto = false; } az = drag.az - dx * 0.01; elv = Math.max(0.02, Math.min(1.25, drag.el + dy * 0.006)); if (drag.moved) e.preventDefault(); };
  const up = () => { drag = null; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('dblclick', () => { az = S.def.az ?? 0.75; elv = el0; });
  const ro = new ResizeObserver(() => size()); ro.observe(el);
  function size() { const w = el.clientWidth || 300, h = el.clientHeight || 200; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  size();
  const speed = opts.speed || 1, fixed = opts.t;
  function tick(now) {
    if (!alive) return;
    if (!el.isConnected) { api.dispose(); return; }
    const t = fixed != null ? fixed : (now - t0) / 1000 * speed;
    frame(S, t); camPos(cam, S, az, elv, cam.aspect); renderer.render(S.scene, cam);
    if (fixed == null) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  const api = { dispose() { if (!alive) return; alive = false; ro.disconnect(); S.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); }, reset() { az = S.def.az ?? 0.75; elv = el0; } };
  return api;
}

export const has = id => !!EX3D[id];
export const ids = () => Object.keys(EX3D);
