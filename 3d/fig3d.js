// Fit & Food – 3D-oefenfiguur (Three.js). Eén figuur, bewegingen als keyframes.
import * as THREE from 'three';

const D2R = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const COL = { skin: '#dadadd', skinD: '#c7c7cb', prim: '#ff5a2c', sec: '#ffb196', dark: '#121418', frame: '#6b7078', steel: '#a3a8ae', pad: '#121418', mat: '#2a2d33', floor: '#ffffff' };

// ---------- lichaamsmaten
const BODY = {
  m: { sh: 0.195, hip: 0.1, spine: 0.47, ua: 0.3, fa: 0.27, th: 0.44, sn: 0.43, head: 0.105, s: 1 },
  f: { sh: 0.17, hip: 0.11, spine: 0.47, ua: 0.3, fa: 0.27, th: 0.44, sn: 0.43, head: 0.098, s: 1 }, // zelfde ledematen als de man: houdingen passen dan voor beiden
};

// ---------- standaardpose: rechtop staan
export const STAND = { r: [0, 0.99, 0], o: [0, 0, 0], s: [0, 0, 0], h: [0, 0], hb: ['c', 0.02, -0.55, 0.05], fb: ['p', 0, -0.86, 0.02] };

function frameQ(o) { return new THREE.Quaternion().setFromEuler(new THREE.Euler((o[0] || 0) * D2R, (o[1] || 0) * D2R, (o[2] || 0) * D2R, 'YXZ')); }
function axes(q) { return { F: V(0, 0, 1).applyQuaternion(q), U: V(0, 1, 0).applyQuaternion(q), L: V(1, 0, 0).applyQuaternion(q) }; }
const lerp = (a, b, t) => a + (b - a) * t;
function lerpArr(a, b, t) { if (!a) return b; if (!b) return a; return a.map((v, i) => typeof v === 'number' ? lerp(v, b[i], t) : (t < 0.5 ? v : b[i])); }
const DEF = { pe: [-0.35, -0.5, 0.45], pk: [1, 0, 0.12] };
// per ledemaat interpoleren; verschillende modi (borst/wereld/bekken) eerst naar wereldcoördinaten
function norm(A) {
  const o = { r: A.r || STAND.r, o: A.o || [0, 0, 0], s: A.s || [0, 0, 0], h: A.h || [0, 0, 0], sg: A.sg || 0, gy: A.gy || 0, lgy: A.lgy ?? A.gy ?? 0, rgy: A.rgy ?? A.gy ?? 0, noDrop: A.noDrop || 0, lhf: A.lhf || 0, rhf: A.rhf || 0 };
  for (const k of ['l', 'r']) { o[k + 'h'] = A[k + 'h'] || A.hb || STAND.hb; o[k + 'f'] = A[k + 'f'] || A.fb || STAND.fb; o[k + 'pe'] = A[k + 'pe'] || A.pe || DEF.pe; o[k + 'pk'] = A[k + 'pk'] || A.pk || null; o[k + 'pkw'] = A[k + 'pkw'] || A.pkw || null; o[k + 'pew'] = A[k + 'pew'] || A.pew || null; o[k + 'fperp'] = A[k + 'fperp'] ?? A.fperp ?? 0; o[k + 'sa'] = A[k + 'sa'] ?? A.sa ?? 0; o[k + 'sl'] = A[k + 'sl'] ?? A.sl ?? 0; }
  for (const k of ['toe', 'ltoe', 'rtoe']) if (A[k]) o[k] = A[k]; return o;
}
function lerpPose(A0, B0, t, sex = 'm') {
  const A = norm(A0), B = norm(B0), o = {};
  for (const k of ['r', 'o', 's', 'h', 'lpe', 'rpe']) o[k] = lerpArr(A[k], B[k], t);
  for (const k of ['lpew', 'rpew']) { const a = A[k], b = B[k]; o[k] = a && b ? lerpArr(a, b, t) : (a || b || null); }
  for (const k of ['lfperp', 'rfperp']) o[k] = t < 0.5 ? A[k] : B[k];
  for (const k of ['lpk', 'rpk', 'lpkw', 'rpkw']) { const a = A[k], b = B[k]; o[k] = a && b ? lerpArr(a, b, t) : (a || b) && !k.endsWith('w') ? lerpArr(a || DEF.pk, b || DEF.pk, t) : (a || b || null); }
  for (const k of ['lsa', 'rsa', 'lsl', 'rsl']) o[k] = lerp(A[k] || 0, B[k] || 0, t);
  o.sg = lerp(A.sg, B.sg, t); o.gy = lerp(A.gy, B.gy, t); o.lgy = lerp(A.lgy, B.lgy, t); o.rgy = lerp(A.rgy, B.rgy, t); o.noDrop = A.noDrop || B.noDrop; o.lhf = lerp(A.lhf, B.lhf, t); o.rhf = lerp(A.rhf, B.rhf, t);
  for (const k of ['l', 'r']) { const ka = A[k + 'toe'] || A.toe, kb = B[k + 'toe'] || B.toe; if (!ka && !kb) continue;
    const a = ka || autoToe(A, k, sex), b = kb || autoToe(B, k, sex); o[k + 'toe'] = lerpArr(a, b, t); }
  let FA, FB; const Bd = BODY[sex] || BODY.m;
  for (const k of ['l', 'r']) for (const ty of ['h', 'f']) {
    const a = A[k + ty], b = B[k + ty];
    if (a[0] === b[0]) { o[k + ty] = lerpArr(a, b, t); continue; }
    FA = FA || frames(A, Bd); FB = FB || frames(B, Bd);
    const pa = target(FA, Bd, A, k, ty, a), pb = target(FB, Bd, B, k, ty, b);
    o[k + ty] = ['w', lerp(pa.x, pb.x, t), lerp(pa.y, pb.y, t), lerp(pa.z, pb.z, t)];
  }
  for (const k of ['toe', 'ltoe', 'rtoe']) if (!o[k]) delete o[k];
  return o;
}
const TOEC = new WeakMap();
function autoToe(P0, k, sex) { let c = TOEC.get(P0); if (!c) { c = {}; TOEC.set(P0, c); } const key = k + sex; if (!c[key]) { const q = { ...P0 }; delete q.toe; delete q.ltoe; delete q.rtoe; const t = solve(q, sex)[k + 'toe']; c[key] = [t.x, t.y, t.z]; } return c[key];
}
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// twee-segment IK
function ik(S, H, L1, L2, pole) {
  const d = V().subVectors(H, S); let L = d.length(); const max = L1 + L2 - 1e-4; if (L > max) { H = S.clone().addScaledVector(d.normalize(), max); L = max; }
  const dir = V().subVectors(H, S).normalize();
  const a = (L1 * L1 - L2 * L2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pv = V().subVectors(pole, S); pv.addScaledVector(dir, -pv.dot(dir)); if (pv.lengthSq() < 1e-8) pv.set(0, -1, 0); pv.normalize();
  return { mid: S.clone().addScaledVector(dir, a).addScaledVector(pv, h), end: H };
}

// ankers: schouder (arm) en heup (been) voor een pose
function frames(p, B) {
  const qP = frameQ(p.o || [0, 0, 0]), P = V(...p.r), aP = axes(qP);
  const qC = qP.clone().multiply(frameQ(p.s || [0, 0, 0])), aC = axes(qC);
  const qM = qP.clone().slerp(qC, 0.5), aM = axes(qM);
  const T = P.clone().addScaledVector(aM.U, B.spine);
  return { P, aP, aC, T };
}
function anchor(F, B, p, k, type) {
  const s = k === 'l' ? 1 : -1;
  return type === 'h' ? F.T.clone().addScaledVector(F.aC.U, -0.045 + (p.sg || 0)).addScaledVector(F.aC.L, s * B.sh)
    : F.P.clone().addScaledVector(F.aP.U, -0.04).addScaledVector(F.aP.L, s * B.hip);
}
function target(F, B, p, k, type, spec) {
  const s = k === 'l' ? 1 : -1;
  if (spec[0] === 'w') return V(spec[1], spec[2], spec[3]);
  if (spec[0] === 'm') return V(s * spec[1], spec[2], spec[3]);
  const a = anchor(F, B, p, k, type), fr = type === 'h' ? F.aC : F.aP;
  return a.addScaledVector(fr.F, spec[1]).addScaledVector(fr.U, spec[2]).addScaledVector(fr.L, s * spec[3]);
}

// ---------- pose → gewrichtsposities
// voeten die op de grond staan moeten bereikbaar blijven: zo nodig zakt het bekken iets (anders zweeft of glijdt de voet)
export function solve(pose, sex = 'm') {
  if (pose.noDrop) return solve0(pose, sex);
  const B = BODY[sex] || BODY.m, p = { ...STAND, ...pose }, F = frames(p, B), gy = p.gy || 0, L = B.th + B.sn - 0.006;
  let dy = 0;
  for (const k of ['l', 'r']) { const sp = p[k + 'f'] || p.fb; if (sp[0] === 'p') continue; const A = target(F, B, p, k, 'f', sp); if (A.y > (p[k + 'gy'] ?? gy) + 0.2) continue;
    const Hp = anchor(F, B, p, k, 'f'), v = V().subVectors(Hp, A), h2 = v.x * v.x + v.z * v.z;
    if (v.y > 0.45 && v.length() > L && h2 < L * L) dy = Math.max(dy, v.y - Math.sqrt(L * L - h2)); }
  if (dy > 0.0005) { const r = p.r || STAND.r; return solve0({ ...pose, r: [r[0], r[1] - dy, r[2]] }, sex); }
  return solve0(pose, sex);
}
function solve0(pose, sex = 'm') {
  const B = BODY[sex] || BODY.m, p = { ...STAND, ...pose };
  const qP = frameQ(p.o), P = V(...p.r), aP = axes(qP);
  const qC = qP.clone().multiply(frameQ(p.s)), aC = axes(qC);
  const qM = qP.clone().slerp(qC, 0.5), aM = axes(qM);
  const T = P.clone().addScaledVector(aM.U, B.spine);
  const qH = qC.clone().multiply(frameQ([p.h[0] || 0, p.h[1] || 0, p.h[2] || 0])), aH = axes(qH);
  const head = T.clone().addScaledVector(aC.U, 0.07).addScaledVector(aH.U, B.head + 0.02);
  const J = { P, T, head, aP, aC, aH, aM, qC, qP, qH, B, sex };
  const side = { l: 1, r: -1 };
  for (const k of ['l', 'r']) {
    const s = side[k];
    const S = T.clone().addScaledVector(aC.U, -0.045 + (p.sg || 0)).addScaledVector(aC.L, s * B.sh);
    const FR = { P, aP, aC, T };
    const H = target(FR, B, p, k, 'h', p[k + 'h'] || p.hb);
    const pe = p[k + "pe"] || p.pe || DEF.pe;
    const pew = p[k + 'pew'] || p.pew;
    const pole = pew ? S.clone().add(V(s * pew[0], pew[1], pew[2])) : S.clone().addScaledVector(aC.F, pe[0]).addScaledVector(aC.U, pe[1]).addScaledVector(aC.L, s * pe[2]);
    if (p[k + 'sa'] || p.sa) { const sa = p[k + 'sa'] ?? p.sa, d = V().subVectors(H, S), L0 = d.length(); H.copy(S).addScaledVector(d.normalize(), L0 + (0.565 - L0) * Math.min(1, sa)); }
    const arm = ik(S, H, B.ua, B.fa, pole);
    J[k + 'S'] = S; J[k + 'E'] = arm.mid; J[k + 'H'] = arm.end;
    { const sh = V().subVectors(arm.end, S).normalize(), ef = V().subVectors(pole, S); ef.addScaledVector(sh, -ef.dot(sh)); if (ef.lengthSq() < 1e-6) ef.copy(aC.F); J[k + 'ef'] = ef.normalize(); } // richting van de elleboog, ook bij een gestrekte arm
    const Hp = P.clone().addScaledVector(aP.U, -0.04).addScaledVector(aP.L, s * B.hip);
    const A = target(FR, B, p, k, 'f', p[k + 'f'] || p.fb);
    if (p[k + 'sl'] || p.sl) { const sl = p[k + 'sl'] ?? p.sl, d = V().subVectors(A, Hp), L0 = d.length(); A.copy(Hp).addScaledVector(d.normalize(), L0 + (0.865 - L0) * Math.min(1, sl)); }
    const pk = p[k + "pk"] || p.pk, pkw = p[k + 'pkw'] || p.pkw;
    let kp;
    if (pkw) kp = Hp.clone().add(V(s * pkw[0], pkw[1], pkw[2]));
    else { const q = pk || DEF.pk; kp = Hp.clone().addScaledVector(aP.F, q[0]).addScaledVector(aP.U, q[1]).addScaledVector(aP.L, s * q[2]);
      if (!pk) { // staand met voeten op de grond: knieën wijzen in de looprichting, ook als de romp voorover buigt
        const sat = x => Math.min(1, Math.max(0, x)), yw = ((p.o && p.o[1]) || 0) * D2R, hdg = V(Math.sin(yw), 0, Math.cos(yw)), hf = V().subVectors(A, Hp).normalize(), wa = sat(((p[k + 'gy'] ?? p.gy ?? 0) + 0.24 - A.y) / 0.08) * sat((1 - Math.abs(hf.dot(hdg))) / 0.3) * sat((Hp.y - A.y - 0.15) / 0.15);
        if (wa > 0) { const y = ((p.o && p.o[1]) || 0) * D2R; kp.lerp(Hp.clone().add(V(Math.sin(y) + s * 0.12 * Math.cos(y), 0, Math.cos(y) - s * 0.12 * Math.sin(y))), wa); } } }
    const leg = ik(Hp, A, B.th, B.sn, kp);
    const G = p[k + 'gy'] ?? p.gy ?? 0; J[k + 'gy'] = G;
    J[k + 'Hp'] = Hp; J[k + 'K'] = leg.mid; J[k + 'A'] = leg.end;
    // voorkant van de knie: richting van de pool, loodrecht op heup→enkel (blijft stabiel bij een gestrekt been)
    const hA = V().subVectors(leg.end, Hp).normalize(), kf = V().subVectors(kp, Hp); kf.addScaledVector(hA, -kf.dot(hA));
    if (kf.lengthSq() < 1e-6) kf.copy(aP.F); kf.normalize(); J[k + 'kf'] = kf;
    const tv = p[k + 'toe'] || p.toe;
    let toe;
    if (tv) toe = V(...tv);
    else if (p[k + 'fperp'] ?? p.fperp) { const sn = V().subVectors(leg.end, leg.mid).normalize(); toe = kf.clone().addScaledVector(sn, -kf.dot(sn)); if (toe.lengthSq() < 1e-6) toe.copy(aP.F); }
    else {
      // los: ontspannen enkel (voet ~100° t.o.v. scheen); op de grond: plat, in de richting van de knie
      const sn = V().subVectors(leg.end, leg.mid).normalize(), fs = kf.clone().addScaledVector(sn, -kf.dot(sn)).normalize();
      const air = fs.clone().multiplyScalar(0.94).addScaledVector(sn, 0.34).normalize();
      const hd = V(kf.x, 0, kf.z); if (hd.lengthSq() < 0.02) hd.set(aP.F.x, 0, aP.F.z); if (hd.lengthSq() < 1e-4) hd.set(0, 0, 1); hd.normalize();
      const w = Math.min(1, Math.max(0, (leg.end.y - G - 0.11) / 0.1)), ws = w * w * (3 - 2 * w);
      toe = hd.multiplyScalar(1 - ws).addScaledVector(air, ws);
      { const kn = Math.min(1, Math.max(0, (G + 0.12 - leg.mid.y) / 0.04)) * Math.min(1, Math.max(0, (G + 0.105 - leg.end.y) / 0.03)); const bk = V(leg.end.x - leg.mid.x, 0, leg.end.z - leg.mid.z);
        if (kn > 0 && bk.lengthSq() > 1e-4) toe.lerp(bk.normalize().add(V(0, -0.25, 0)).normalize(), kn); } // knielen: wreef op de grond
    }
    J[k + 'toe'] = toe.normalize();
  }
  J.gy = p.gy || 0; J.lhf = p.lhf; J.rhf = p.rhf;
  return J;
}

// ---------- figuur opbouwen
function mat(c, o = {}) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.02, ...o }); }
const UP = V(0, 1, 0);
class Cap { constructor(g, r, m) { this.r = r; this.m = new THREE.Mesh(new THREE.CapsuleGeometry(r, 1, 6, 16), m); this.m.castShadow = true; this.m.receiveShadow = true; this.len = 1; g.add(this.m); }
  set(a, b, r) { const d = V().subVectors(b, a), L = Math.max(0.001, d.length()); this.m.position.copy(a).addScaledVector(d, 0.5); this.m.quaternion.setFromUnitVectors(UP, d.multiplyScalar(1 / L));
    if (Math.abs(L - this.len) > 0.002 || (r && r !== this.r)) { this.m.geometry.dispose(); this.r = r || this.r; this.m.geometry = new THREE.CapsuleGeometry(this.r, L, 6, 16); this.len = L; } } }
function blob(g, m, r = 1) { const x = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m); x.castShadow = true; x.receiveShadow = true; g.add(x); return x; }
function orient(mesh, pos, X, Y, Z, sx, sy, sz) { const m = new THREE.Matrix4().makeBasis(X.clone().normalize(), Y.clone().normalize(), Z.clone().normalize()); mesh.quaternion.setFromRotationMatrix(m); mesh.position.copy(pos); mesh.scale.set(sx, sy, sz); }

function parseMus(s) { const [p, q] = (s || '').split('|'); return { p: new Set((p || '').split(',').filter(Boolean)), s: new Set((q || '').split(',').filter(Boolean)) }; }


// ---------- kleding: broekje en sporttop worden op het lichaamsoppervlak getekend, dus ze vormen mee met elke spier
const CLOTH_GLSL = `
uniform vec3 uP, uPU, uPF, uPL, uHl, uKl, uHr, uKr, uT, uCU, uCF, uCL; uniform float uHem, uBra, uTint; uniform vec3 uFab, uFab2;
varying vec3 vWP;
float legM(vec3 w, vec3 H, vec3 K, out float tt) { vec3 ab = K - H; float t = clamp(dot(w - H, ab) / dot(ab, ab), 0., 1.); tt = t; float d = length(w - (H + ab * t)); return (1. - smoothstep(uHem - 0.006, uHem + 0.006, t)) * (1. - smoothstep(0.135, 0.15, d)); }
vec2 clothM(vec3 w) {
  vec3 d = w - uP; float h = dot(d, uPU), lt = dot(d, uPL), fw = dot(d, uPF);
  float m = smoothstep(-0.17, -0.15, h) * (1. - smoothstep(0.095, 0.105, h)) * (1. - smoothstep(0.2, 0.21, abs(lt))) * smoothstep(-0.22, -0.2, fw) * (1. - smoothstep(0.17, 0.18, fw));
  float t1, t2; float ml = legM(w, uHl, uKl, t1), mr = legM(w, uHr, uKr, t2); m = max(m, max(ml, mr));
  float band = max(smoothstep(0.075, 0.08, h) * step(0.5, m), max(ml * smoothstep(uHem - 0.03, uHem - 0.025, t1), mr * smoothstep(uHem - 0.03, uHem - 0.025, t2)));
  if (uBra > 0.5) { vec3 c = w - uT; float hb = dot(c, uCU), lb = dot(c, uCL);
    float b = smoothstep(-0.245, -0.235, hb) * (1. - smoothstep(-0.085, -0.075, hb)) * (1. - smoothstep(0.17, 0.18, abs(lb)));
    float st = smoothstep(-0.09, -0.08, hb) * (1. - smoothstep(0.03, 0.04, hb)) * (1. - smoothstep(0.014, 0.02, abs(abs(lb) - 0.095)));
    m = max(m, max(b, st)); band = max(band, b * (1. - smoothstep(-0.228, -0.222, hb))); }
  return vec2(m, band);
}`;
// ---------- studio-shader: randlicht, zachte schaduw bij de vloer, stofstructuur en een gloed op de getrainde spier
export const GU = { uTime: { value: 0 } };
export function tick(t) { GU.uTime.value = t; }
function studio(m, U, o = {}) {
  const cloth = !!o.cloth;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, GU, U || {}, { uTint: { value: o.tint || 0 }, uRimK: { value: o.rim ?? 0.22 }, uGlow: { value: o.glow || 0 }, uGlowC: { value: new THREE.Color(o.glowC || '#ff7a45') } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    let f = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime, uRimK, uGlow; uniform vec3 uGlowC;\n' + (cloth ? CLOTH_GLSL : 'varying vec3 vWP;'));
    f = f.replace('#include <color_fragment>', '#include <color_fragment>\n' + (cloth ? 'vec2 cm = clothM(vWP); vec3 fab = mix(uFab, diffuseColor.rgb, uTint); fab = mix(fab, uFab2, cm.y * 0.6); diffuseColor.rgb = mix(diffuseColor.rgb, fab, cm.x);' : 'vec2 cm = vec2(0.0);'));
    if (cloth) f = f.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.9, cm.x);');

    sh.fragmentShader = f;
  };
  m.customProgramCacheKey = () => 'studio' + (cloth ? 'c' : '');
  return m;
}
function clothify(m, U, tint, glow = 0) { return studio(m, U, { cloth: true, tint, glow }); }

export class Figure {
  constructor(scene, sex = 'm', mus = '') {
    this.g = new THREE.Group(); scene.add(this.g); this.sex = sex;
    const v3 = () => ({ value: new THREE.Vector3() });
    this.U = { uP: v3(), uPU: v3(), uPF: v3(), uPL: v3(), uHl: v3(), uKl: v3(), uHr: v3(), uKr: v3(), uT: v3(), uCU: v3(), uCF: v3(), uCL: v3(), uHem: { value: sex === 'f' ? 0.3 : 0.42 }, uBra: { value: sex === 'f' ? 1 : 0 }, uFab: { value: new THREE.Color(COL.dark) }, uFab2: { value: new THREE.Color('#4a4f58') } };
    this.M = { skin: clothify(mat(COL.skin, { roughness: 0.55 }), this.U, 0), skinA: studio(mat(COL.skin, { roughness: 0.55 })), skinD: studio(mat(COL.skinD)), dark: studio(mat(COL.dark, { roughness: 0.8 }), null, { rim: 0.12 }), hair: studio(mat('#2a2522', { roughness: 0.9 }), null, { rim: 0.15 }) };
    this.setMus(mus);
    const g = this.g, M = this.M, mm = k => this.mm(k);
    this.c = {};
    const C = (k, r, m) => (this.c[k] = new Cap(g, r, m));
    const ma = k => this.mmA(k);
    for (const s of ['l', 'r']) { C(s + 'ua', 0.05, M.skinA); C(s + 'fa', 0.04, ma('oa')); C(s + 'th', 0.075, M.skin); C(s + 'sn', 0.052, M.skin); }
    C('neck', 0.05, M.skinA);
    this.b = {};
    const Bb = (k, m) => (this.b[k] = blob(g, m));
    ['pel', 'abd', 'chest', 'head'].forEach(k => Bb(k, k === 'head' ? M.skinA : M.skin));
    for (const s of ['l', 'r']) {
      ['delt', 'pec', 'lat', 'trap', 'glute', 'quad', 'ham', 'add', 'calf', 'bic', 'tri', 'obl', 'hand', 'foot', 'toes', 'ub'].forEach(k => {
        const map = { delt: 'sc', pec: 'bo', lat: 'la', trap: 'tz', glute: 'bil', quad: 'qu', ham: 'ha', add: 'ad', calf: 'ku', bic: 'bi', tri: 'tr', obl: 'sb', hand: null, foot: null, toes: null, ub: 'br' }[k];
        Bb(s + k, k === 'hand' || k === 'foot' || k === 'toes' ? M.skinD : ['delt', 'bic', 'tri'].includes(k) ? ma(map) : mm(map));
      });
    }
    Bb('abs', mm('bu')); Bb('lowb', mm('or'));
    if (sex === 'f') { Bb('lbust', M.skin); Bb('rbust', M.skin); Bb('hair', M.hair); Bb('pony', M.hair); Bb('bun', M.hair); }
  }
  hi(k) { return this.mus.p.has(k) || this.mus.s.has(k); }
  setMus(s) { this.mus = parseMus(s); this.Mp = this.Mp || clothify(mat(COL.prim, { roughness: 0.45 }), this.U, 0.28, 0.16); this.Ms = this.Ms || clothify(mat(COL.sec, { roughness: 0.5 }), this.U, 0.18);
    this.MpA = this.MpA || studio(mat(COL.prim, { roughness: 0.45 }), null, { glow: 0.16 }); this.MsA = this.MsA || studio(mat(COL.sec, { roughness: 0.5 })); }
  mm(k) { return this.mus.p.has(k) ? this.Mp : this.mus.s.has(k) ? this.Ms : this.M.skin; }
  mmA(k) { return this.mus.p.has(k) ? this.MpA : this.mus.s.has(k) ? this.MsA : this.M.skinA; }
  pose(J) {
    const { P, T, head, aP, aC, aM, aH, B } = J, c = this.c, b = this.b, f = this.sex === 'f';
    { const U = this.U; U.uP.value.copy(P); U.uPU.value.copy(aP.U); U.uPF.value.copy(aP.F); U.uPL.value.copy(aP.L); U.uHl.value.copy(J.lHp); U.uKl.value.copy(J.lK); U.uHr.value.copy(J.rHp); U.uKr.value.copy(J.rK);
      U.uT.value.copy(T); U.uCU.value.copy(aC.U); U.uCF.value.copy(aC.F); U.uCL.value.copy(aC.L); }
    // romp
    orient(b.pel, P.clone().addScaledVector(aP.U, -0.01), aP.L, aP.U, aP.F, f ? 0.175 : 0.165, 0.12, 0.12);
    orient(b.abd, P.clone().addScaledVector(aM.U, 0.2), aM.L, aM.U, aM.F, f ? 0.13 : 0.145, 0.15, 0.1);
    const chestC = T.clone().addScaledVector(aC.U, -0.14);
    orient(b.chest, chestC, aC.L, aC.U, aC.F, f ? 0.165 : 0.19, 0.17, 0.115);
    orient(b.abs, P.clone().addScaledVector(aM.U, 0.2).addScaledVector(aM.F, 0.06), aM.L, aM.U, aM.F, f ? 0.075 : 0.085, 0.13, f ? 0.042 : 0.05);
    orient(b.lowb, P.clone().addScaledVector(aM.U, 0.14).addScaledVector(aM.F, -0.065), aM.L, aM.U, aM.F, 0.09, 0.08, 0.045);
    c.neck.set(T.clone().addScaledVector(aC.U, -0.02), head.clone().addScaledVector(aH.U, -0.07), 0.045);
    orient(b.head, head, aH.L, aH.U, aH.F, B.head * 0.9, B.head * 1.08, B.head);
    if (f) {
      // sporttop met buste, haar dat het achterhoofd helemaal bedekt (gezicht blijft vrij), paardenstaart
      for (const k of ['l', 'r']) { const sd = k === 'l' ? 1 : -1; orient(b[k + 'bust'], T.clone().addScaledVector(aC.U, -0.165).addScaledVector(aC.F, 0.07).addScaledVector(aC.L, sd * 0.058), aC.L, aC.U, aC.F, 0.062, 0.056, 0.055); }
      orient(b.hair, head.clone().addScaledVector(aH.U, 0.014).addScaledVector(aH.F, -0.028), aH.L, aH.U, aH.F, B.head * 1.0, B.head * 1.12, B.head * 1.04);
      orient(b.bun, head.clone().addScaledVector(aH.F, -0.095).addScaledVector(aH.U, 0.03), aH.L, aH.U, aH.F, 0.04, 0.035, 0.035);
      orient(b.pony, head.clone().addScaledVector(aH.F, -0.115).addScaledVector(aH.U, -0.04), aH.L, aH.U, aH.F, 0.03, 0.08, 0.032);
    }
    for (const k of ['l', 'r']) {
      const s = k === 'l' ? 1 : -1, S = J[k + 'S'], E = J[k + 'E'], H = J[k + 'H'], Hp = J[k + 'Hp'], K = J[k + 'K'], A = J[k + 'A'];
      c[k + 'ua'].set(S, E, f ? 0.045 : 0.05); c[k + 'fa'].set(E, H, f ? 0.037 : 0.04);
      c[k + 'th'].set(Hp, K, f ? 0.074 : 0.075); c[k + 'sn'].set(K, A, f ? 0.05 : 0.052);
      // schouder, borst, rug
      orient(b[k + 'delt'], S.clone().addScaledVector(aC.U, 0.005).addScaledVector(aC.L, s * 0.01), aC.L, aC.U, aC.F, f ? 0.066 : 0.078, f ? 0.064 : 0.075, f ? 0.066 : 0.078);
      if (f) orient(b[k + 'pec'], T.clone().addScaledVector(aC.U, -0.075).addScaledVector(aC.F, 0.07).addScaledVector(aC.L, s * 0.07), aC.L, aC.U, aC.F, 0.068, 0.04, 0.035);
      else orient(b[k + 'pec'], T.clone().addScaledVector(aC.U, -0.1).addScaledVector(aC.F, 0.085).addScaledVector(aC.L, s * 0.088), aC.L, aC.U, aC.F, 0.1, 0.075, 0.048);
      orient(b[k + 'lat'], T.clone().addScaledVector(aC.U, -0.2).addScaledVector(aC.F, -0.04).addScaledVector(aC.L, s * (f ? 0.12 : 0.14)), aC.L, aC.U, aC.F, f ? 0.04 : 0.05, 0.12, f ? 0.06 : 0.07);
      orient(b[k + 'ub'], T.clone().addScaledVector(aC.U, -0.1).addScaledVector(aC.F, -0.085).addScaledVector(aC.L, s * 0.07), aC.L, aC.U, aC.F, 0.075, 0.075, 0.035);
      orient(b[k + 'trap'], T.clone().addScaledVector(aC.U, 0.0).addScaledVector(aC.F, -0.03).addScaledVector(aC.L, s * 0.075), aC.L, aC.U, aC.F, f ? 0.058 : 0.07, f ? 0.028 : 0.035, f ? 0.038 : 0.045);
      orient(b[k + 'obl'], P.clone().addScaledVector(aM.U, 0.2).addScaledVector(aM.L, s * 0.11).addScaledVector(aM.F, 0.02), aM.L, aM.U, aM.F, 0.045, 0.1, 0.07);
      orient(b[k + 'glute'], P.clone().addScaledVector(aP.U, -0.02).addScaledVector(aP.F, -0.075).addScaledVector(aP.L, s * 0.075), aP.L, aP.U, aP.F, f ? 0.092 : 0.085, f ? 0.095 : 0.09, f ? 0.072 : 0.065);
      // armen: biceps aan de buigkant
      const ua = V().subVectors(E, S).normalize(), fa = V().subVectors(H, E).normalize();
      const efr = J[k + 'ef'] || aC.F, bend = efr.clone().negate().addScaledVector(ua, efr.dot(ua)).normalize(); // binnenkant van de elleboog, stabiel
      const side1 = V().crossVectors(ua, bend).normalize();
      const um = S.clone().lerp(E, 0.5);
      orient(b[k + 'bic'], um.clone().addScaledVector(bend, f ? 0.026 : 0.03), side1, ua, bend, f ? 0.031 : 0.036, 0.1, f ? 0.026 : 0.03);
      orient(b[k + 'tri'], um.clone().addScaledVector(bend, f ? -0.028 : -0.032), side1, ua, bend, f ? 0.033 : 0.038, 0.11, f ? 0.026 : 0.03);
      if (H.y < 0.08 || J[k + 'hf']) { const fh = V(fa.x, 0, fa.z); if (fh.lengthSq() < 1e-4) fh.set(aC.F.x, 0, aC.F.z); if (fh.lengthSq() < 1e-4) fh.set(0, 0, 1); fh.normalize(); const sx = V().crossVectors(fh, UP).normalize();
        orient(b[k + 'hand'], V(H.x, J[k + 'hf'] ? H.y - 0.01 : 0.024, H.z).addScaledVector(fh, 0.04), sx, fh, UP, 0.036, 0.055, 0.02); } // plat op de vloer
      else orient(b[k + 'hand'], H.clone().addScaledVector(fa, 0.035), side1, fa, bend, 0.034, 0.05, 0.022);
      // benen: hamstring aan de buigkant (achter)
      const th = V().subVectors(K, Hp).normalize(), sn = V().subVectors(A, K).normalize();
      const kfr = J[k + 'kf'], kb = kfr.clone().negate().addScaledVector(th, kfr.dot(th)).normalize();
      const cb = kfr.clone().negate().addScaledVector(sn, kfr.dot(sn)).normalize(), side3 = V().crossVectors(sn, cb).normalize();
      const side2 = V().crossVectors(th, kb).normalize(), tm = Hp.clone().lerp(K, 0.55);
      orient(b[k + 'quad'], tm.clone().addScaledVector(kb, -0.045), side2, th, kb, 0.06, 0.16, 0.04);
      orient(b[k + 'ham'], tm.clone().addScaledVector(kb, 0.045), side2, th, kb, 0.058, 0.15, 0.038);
      const inner = side2.clone().multiplyScalar(Math.sign(side2.dot(aP.L)) * -s);
      orient(b[k + 'add'], Hp.clone().lerp(K, 0.35).addScaledVector(inner, 0.04), side2, th, kb, 0.035, 0.12, 0.05);
      const sm = K.clone().lerp(A, 0.35);
      orient(b[k + 'calf'], sm.clone().addScaledVector(cb, 0.022), side3, sn, cb, f ? 0.04 : 0.044, 0.11, f ? 0.034 : 0.038);
      const toe = J[k + 'toe'];
      const up = V().subVectors(K, A).normalize(); let fy = up.clone().addScaledVector(toe, -up.dot(toe)); if (fy.lengthSq() < 1e-4) fy.set(0, 1, 0); fy.normalize();
      const fx = V().crossVectors(fy, toe).normalize(); J[k + 'fy'] = fy;
      // achtervoet (hiel→bal) en tenen als apart scharnier: tenen blijven plat op de grond
      orient(b[k + 'foot'], A.clone().addScaledVector(toe, 0.045).addScaledVector(fy, -0.035), fx, fy, toe, 0.045, 0.035, 0.1);
      const ball = A.clone().addScaledVector(toe, 0.13).addScaledVector(fy, -0.04);
      let td = toe.clone(); const gy = J[k + 'gy'] ?? J.gy ?? 0, fl = Math.min(1, Math.max(0, (gy + 0.09 - ball.y) / 0.05));
      if (fl > 0) { const hz = V(toe.x, 0, toe.z); if (hz.lengthSq() > 1e-4) { hz.normalize(); td.lerp(hz, fl * fl * (3 - 2 * fl)).normalize(); } ball.y = Math.max(ball.y, gy + 0.022); }
      const tx = V().crossVectors(UP, td); if (tx.lengthSq() < 1e-4) tx.copy(fx); tx.normalize(); const ty = V().crossVectors(td, tx).normalize();
      orient(b[k + 'toes'], ball.addScaledVector(td, 0.03), tx, ty, td, 0.042, 0.022, 0.045);
    }
  }
}

// ---------- attributen (props)
function box(g, m, sx, sy, sz, x, y, z) { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; }
function cyl(g, m, r, h, x = 0, y = 0, z = 0, axis = 'y', seg = 24) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); if (axis === 'x') c.rotation.z = Math.PI / 2; if (axis === 'z') c.rotation.x = Math.PI / 2; c.position.set(x, y, z); c.castShadow = true; c.receiveShadow = true; g.add(c); return c; }
function line(g, m, r = 0.006) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), m); c.castShadow = true; g.add(c); return { m: c, set(a, b) { const d = V().subVectors(b, a), L = Math.max(0.001, d.length()); c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(UP, d.multiplyScalar(1 / L)); c.scale.set(1, L, 1); } }; }

export function makeProps(scene, list) {
  const M = { frame: studio(mat(COL.frame, { metalness: 0.6, roughness: 0.4 }), null, { rim: 0.3 }), pad: studio(mat(COL.pad, { roughness: 0.75 }), null, { rim: 0.14 }), steel: studio(mat(COL.steel, { metalness: 0.85, roughness: 0.25 }), null, { rim: 0.4 }), plate: studio(mat(COL.dark, { roughness: 0.6, metalness: 0.2 }), null, { rim: 0.18 }), mat: mat(COL.mat, { roughness: 0.95 }), cable: mat('#3a3d42', { roughness: 0.6 }), band: mat('#2a9d8f', { roughness: 0.6 }), kb: mat(COL.dark, { roughness: 0.5, metalness: 0.3 }) };
  const out = [];
  for (const pr of list || []) {
    const g = new THREE.Group(); scene.add(g); const t = pr.t; const o = { pr, g, upd: null };
    if (pr.p) g.position.set(...pr.p); if (pr.yaw) g.rotation.y = pr.yaw * D2R; if (pr.rx) g.rotation.x = pr.rx * D2R;
    if (t === 'bench') { // vlakke of schuine bank; p = midden van het zitvlak op de grond
      const L = pr.len || 1.2, h = pr.h || 0.45, inc = (pr.inc || 0) * D2R;
      const seat = new THREE.Group(); g.add(seat);
      box(seat, M.pad, 0.3, 0.08, pr.inc ? 0.45 : L, 0, h - 0.04, pr.inc ? -0.3 : 0);
      if (pr.inc) { const back = new THREE.Group(); back.position.set(0, h, -0.08); back.rotation.x = -inc; seat.add(back); box(back, M.pad, 0.3, 0.08, 0.85, 0, -0.04, 0.42); box(g, M.frame, 0.05, h * 1.2, 0.05, 0, h * 0.6, 0.45); }
      box(g, M.frame, 0.06, h - 0.08, 0.06, 0, (h - 0.08) / 2, -L / 2 + 0.12); box(g, M.frame, 0.06, h - 0.08, 0.06, 0, (h - 0.08) / 2, L / 2 - 0.12);
      box(g, M.frame, 0.42, 0.04, 0.08, 0, 0.02, -L / 2 + 0.12); box(g, M.frame, 0.42, 0.04, 0.08, 0, 0.02, L / 2 - 0.12); box(g, M.frame, 0.05, 0.05, L - 0.2, 0, 0.12, 0);
    }
    if (t === 'box') box(g, M.pad, pr.w || 0.5, pr.h || 0.4, pr.d || 0.4, 0, (pr.h || 0.4) / 2, 0);
    if (t === 'mat') box(g, M.mat, pr.w || 0.65, 0.012, pr.d || 1.8, 0, 0.006, 0);
    if (t === 'wall') box(g, mat('#eceef1', { roughness: 0.9 }), pr.w || 1.6, pr.h || 2.0, 0.06, 0, (pr.h || 2) / 2, 0);
    if (t === 'pullbar') { const w = pr.w || 1.3, h = pr.h || 2.15; cyl(g, M.steel, 0.016, w, 0, h, 0, 'x'); box(g, M.frame, 0.06, h + 0.05, 0.06, -w / 2, (h + 0.05) / 2, 0); box(g, M.frame, 0.06, h + 0.05, 0.06, w / 2, (h + 0.05) / 2, 0); box(g, M.frame, 0.08, 0.04, 0.7, -w / 2, 0.02, 0); box(g, M.frame, 0.08, 0.04, 0.7, w / 2, 0.02, 0); }
    if (t === 'dipbars') { const h = pr.h || 1.15; for (const s of [-1, 1]) { cyl(g, M.steel, 0.02, 0.55, s * 0.26, h, 0, 'z'); box(g, M.frame, 0.05, h, 0.05, s * 0.26, h / 2, -0.25); box(g, M.frame, 0.05, h, 0.05, s * 0.26, h / 2, 0.25); } }
    if (t === 'tower') { // kabeltoren: p = voet, pulley op hoogte ph
      const h = 2.1; box(g, M.frame, 0.12, h, 0.12, 0, h / 2, 0); box(g, M.frame, 0.5, 0.05, 0.5, 0, 0.025, 0); box(g, M.plate, 0.22, 0.5, 0.08, 0, 0.3, -0.08);
      const pul = cyl(g, M.steel, 0.04, 0.03, 0, pr.ph ?? 1.9, 0.08, 'x');
      o.cable = line(scene, M.cable, 0.005); o.pulley = () => g.localToWorld(V(0, pr.ph ?? 1.9, 0.08));
    }
    if (t === 'seat') { box(g, M.pad, pr.w || 0.4, 0.08, pr.d || 0.4, 0, pr.h || 0.48, 0); box(g, M.frame, 0.06, (pr.h || 0.48), 0.06, 0, (pr.h || 0.48) / 2, 0); box(g, M.frame, 0.45, 0.04, 0.45, 0, 0.02, 0); if (pr.back) { const pv = new THREE.Group(); pv.position.set(0, (pr.h || 0.48) + 0.03, -(pr.d || 0.4) / 2 + 0.04); pv.rotation.x = (pr.back - 90) * D2R * -1; g.add(pv); box(pv, M.pad, pr.w || 0.4, 0.62, 0.08, 0, 0.31, -0.02); } }
    if (t === 'frameT') { // machinecontour achter de gebruiker
      const h = pr.h || 2.0, w = pr.w || 1.0; box(g, M.frame, 0.07, h, 0.07, -w / 2, h / 2, 0); box(g, M.frame, 0.07, h, 0.07, w / 2, h / 2, 0); box(g, M.frame, w + 0.07, 0.07, 0.07, 0, h, 0); box(g, M.plate, 0.25, 0.6, 0.1, 0, 0.35, 0);
    }
    if (t === 'treadmill') { box(g, M.pad, 0.75, 0.12, 1.7, 0, 0.1, 0); box(g, M.mat, 0.55, 0.02, 1.5, 0, 0.17, 0); for (const s of [-1, 1]) box(g, M.frame, 0.05, 1.05, 0.05, s * 0.36, 0.6, 0.72); box(g, M.frame, 0.8, 0.12, 0.25, 0, 1.15, 0.75); }
    if (t === 'bike') { box(g, M.frame, 0.08, 0.85, 0.08, 0, 0.42, -0.25); box(g, M.pad, 0.22, 0.06, 0.28, 0, 0.88, -0.28); box(g, M.frame, 0.08, 1.05, 0.08, 0, 0.52, 0.45); box(g, M.frame, 0.5, 0.05, 0.05, 0, 1.06, 0.48); box(g, M.plate, 0.1, 0.4, 0.4, 0, 0.35, 0.18); box(g, M.frame, 0.45, 0.05, 1.0, 0, 0.03, 0.1); }
    if (t === 'rower') { box(g, M.frame, 0.12, 0.08, 2.2, 0, 0.18, 0); box(g, M.pad, 0.3, 0.06, 0.3, 0, 0.28, pr.seatZ ?? 0); box(g, M.plate, 0.25, 0.45, 0.25, 0, 0.3, 1.0); box(g, M.frame, 0.4, 0.04, 0.12, 0, 0.2, 0.7); o.seat = g.children[1]; }
    if (t === 'elliptical') { box(g, M.frame, 0.5, 0.08, 1.5, 0, 0.05, 0.05); box(g, M.plate, 0.28, 0.5, 0.32, 0, 0.32, 0.65); box(g, M.frame, 0.06, 1.2, 0.06, 0, 0.65, 0.66); box(g, M.frame, 0.3, 0.12, 0.08, 0, 1.25, 0.66); box(g, M.frame, 0.05, 0.05, 0.6, 0.27, 0.2, 0.1); box(g, M.frame, 0.05, 0.05, 0.6, -0.27, 0.2, 0.1);
      o.ped = [0, 1].map(() => { const q = new THREE.Group(); scene.add(q); box(q, M.pad, 0.13, 0.03, 0.34, 0, 0, 0.04); return q; }); o.rail = [0, 1].map(() => line(scene, M.frame, 0.022)); o.post = [0, 1].map(() => line(scene, M.frame, 0.02)); o.grip = [0, 1].map(() => line(scene, M.pad, 0.03)); }
    if (t === 'calfblock') box(g, M.pad, 0.5, 0.1, 0.25, 0, 0.05, 0);
    if (t === 'pad') box(g, M.pad, pr.w || 0.35, pr.hh || 0.12, pr.d || 0.12, 0, 0, 0);
    if (t === 'backpad') { o.bp = new THREE.Group(); scene.add(o.bp); box(o.bp, M.pad, 0.42, 0.62, 0.07, 0, 0, 0); if (pr.shoulders) for (const sd of [-1, 1]) { box(o.bp, M.pad, 0.1, 0.07, 0.22, sd * 0.13, 0.33, 0.1); } }
    if (t === 'legpads') { o.lp2 = [0, 1].map(() => { const q = new THREE.Group(); scene.add(q); box(q, M.pad, 0.07, 0.2, 0.12, 0, 0, 0); box(q, M.frame, 0.03, 0.03, 0.03, 0, 0, 0); return q; }); o.fr2 = [0, 1].map(() => { const q = new THREE.Group(); scene.add(q); box(q, M.frame, 0.12, 0.03, 0.06, 0, 0, 0); return q; }); o.arm2 = [0, 1].map(() => line(scene, M.frame, 0.02)); }
    // vastgehouden attributen
    if (t === 'bar') { const len = pr.len || 2.0; const shaft = cyl(g, M.steel, 0.014, len, 0, 0, 0, 'x'); if (pr.plates !== false) for (const s of [-1, 1]) { cyl(g, M.steel, 0.025, 0.3, s * (len / 2 - 0.17), 0, 0, 'x'); [[pr.r || 0.225, 0.045, len / 2 - 0.29], [(pr.r || 0.225) * 0.75, 0.035, len / 2 - 0.24]].forEach(([r, w, x]) => cyl(g, M.plate, r, w, s * x, 0, 0, 'x', 40)); } }
    if (t === 'ezbar') { cyl(g, M.steel, 0.014, 1.2, 0, 0, 0, 'x'); for (const s of [-1, 1]) cyl(g, M.plate, 0.12, 0.04, s * 0.5, 0, 0, 'x', 32); }
    if (t === 'db') { cyl(g, M.steel, 0.016, 0.14, 0, 0, 0, 'x'); for (const s of [-1, 1]) cyl(g, M.plate, pr.r || 0.055, 0.07, s * 0.1, 0, 0, 'x', 20); }
    if (t === 'kb') { const kb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), M.kb); kb.position.y = -0.11; kb.castShadow = true; g.add(kb); const hd = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 24, Math.PI), M.kb); hd.position.y = -0.04; hd.rotation.z = 0; g.add(hd); }
    if (t === 'handle') { cyl(g, M.steel, 0.015, pr.len || 0.2, 0, 0, 0, 'x'); }
    if (t === 'rope') { o.rope = []; for (let i = 0; i < 16; i++) { const s = line(scene, M.band, 0.007); o.rope.push(s); } }
    if (t === 'band') { o.band = line(scene, M.band, 0.012); }
    if (t === 'lever') { o.lever = line(scene, M.steel, 0.016); o.lp = [0, 1].map(() => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.045, 32), M.plate); c.castShadow = true; scene.add(c); return c; }); }
    if (t === 'battlerope') { o.ropes = [0, 1].map(() => Array.from({ length: 12 }, () => line(scene, M.cable, 0.02))); box(g, M.frame, 0.2, 0.2, 0.2, 0, 0.1, 0); }
    out.push(o);
  }
  return out;
}

export function updateProps(props, J, tm) {
  for (const o of props) {
    const pr = o.pr, g = o.g;
    const hand = k => J[k + 'H'].clone().addScaledVector(V().subVectors(J[k + 'H'], J[k + 'E']).normalize(), 0.03);
    if (pr.hold === 'feet') { const toe = J.ltoe.clone().normalize(), up = V().subVectors(J.lK, J.lA).normalize(), fy = up.addScaledVector(toe, -up.dot(toe)).normalize();
      g.position.copy(J.lA.clone().lerp(J.rA, 0.5)).addScaledVector(fy, -0.1).addScaledVector(toe, 0.05); const Z = fy.clone().negate(), X = V().crossVectors(toe, Z).normalize(); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, toe, Z)); continue; }
    if (pr.hold === 'thighs') { const a = J.lHp.clone().lerp(J.lK, 0.82), b = J.rHp.clone().lerp(J.rK, 0.82); g.position.copy(a.lerp(b, 0.5)).add(V(0, 0.075 + (pr.hh || 0.06) / 2 + 0.005, 0)); continue; }
    if (pr.hold === 'shins') { const a = J.lK.clone().lerp(J.lA, 0.8), b = J.rK.clone().lerp(J.rA, 0.8); g.position.copy(a.lerp(b, 0.5)).addScaledVector(V().subVectors(J.lA, J.lK).normalize().cross(J.aP.L).normalize(), -0.06); continue; }
    if (pr.hold) {
      let pos, dir;
      if (pr.hold === 'both') { const a = hand('l'), b = hand('r'); pos = a.clone().lerp(b, 0.5); dir = pr.axis === 'u' ? J.aC.U.clone() : V().subVectors(a, b).normalize(); }
      else { pos = hand(pr.hold); const fa = V().subVectors(J[pr.hold + 'H'], J[pr.hold + 'E']).normalize(); dir = pr.axis === 'fa' ? fa : (pr.axis === 'f' ? J.aC.F.clone() : pr.axis === 'u' ? J.aC.U.clone() : pr.axis === 'y' ? V(0, 1, 0) : J.aC.L.clone()); if (pr.axis === 'h') { dir = V(1, 0, 0); } else if (pr.axis === 'ham') { dir = V().crossVectors(fa, J.aC.L).normalize(); } else if (pr.axis !== 'fa') dir.addScaledVector(fa, -dir.dot(fa)).normalize(); if (pr.t === 'kb') dir = J.aC.L.clone(); }
      if (pr.off) pos.addScaledVector(J.aC.U, pr.off);
      g.position.copy(pos);
      if (pr.t === 'kb') { const fa = V().subVectors(J[(pr.hold === 'both' ? 'l' : pr.hold) + 'H'], J[(pr.hold === 'both' ? 'l' : pr.hold) + 'E']).normalize(); g.quaternion.setFromUnitVectors(V(0, -1, 0), fa); }
      else g.quaternion.setFromUnitVectors(V(1, 0, 0), dir);
      if (pr.span && pr.hold === 'both') g.scale.set(hand('l').distanceTo(hand('r')) / (pr.len || 0.2), 1, 1);
    }
    if (o.bp) { const C = J.aC, c = J.T.clone().addScaledVector(C.U, -0.2).addScaledVector(C.F, -0.165); const m = new THREE.Matrix4().makeBasis(C.L, C.U, C.F); o.bp.quaternion.setFromRotationMatrix(m); o.bp.position.copy(c); }
    if (o.lp2) ['l', 'r'].forEach((k, i) => { const sd = k === 'l' ? 1 : -1, K = J[k + 'K'], A = J[k + 'A'], Hp = J[k + 'Hp'], th = V().subVectors(K, Hp).normalize(), side = J.aP.L.clone().multiplyScalar(sd * (pr.side === 'in' ? -1 : 1));
      const q = o.lp2[i]; q.position.copy(Hp.clone().lerp(K, 0.85)).addScaledVector(side, 0.11); q.quaternion.setFromUnitVectors(V(0, 1, 0), th);
      const f = o.fr2[i]; f.position.copy(A).add(V(0, -0.07, 0)); o.arm2[i].set(q.position.clone().add(V(0, -0.12, 0)), V(sd * 0.25, 0.42, -0.1)); });
    if (o.ped) { const piv = o.g.localToWorld(V(0, 1.0, 0.62)); ['l', 'r'].forEach((k, i) => { const A = J[k + 'A'], q = o.ped[i], tq = J[k + 'toe'];
      q.position.copy(A).add(V(0, -0.075, 0)); q.rotation.set(0, Math.atan2(tq.x, tq.z), 0);
      const sd = k === 'l' ? 1 : -1, back = A.clone().add(V(0, -0.06, -0.25)); o.rail[i].set(back, o.g.localToWorld(V(sd * 0.1, 0.4, 0.55)));
      const hb = J[k + 'H']; o.post[i].set(A.clone().add(V(0, -0.05, 0.12)), hb.clone().add(V(0, -0.12, 0))); o.grip[i].set(hb.clone().add(V(0, -0.12, 0)), hb.clone().add(V(0, 0.1, 0))); }); }
    if (o.cable) { const end = pr.toA ? J[pr.toA + 'A'] : pr.to ? hand(pr.to) : (pr.toBoth ? hand('l').lerp(hand('r'), 0.5) : hand('r')); o.cable.set(o.pulley(), end); }
    if (o.band) { if (pr.ankles) { o.band.set(J.lK.clone().lerp(J.lA, 0.85), J.rK.clone().lerp(J.rA, 0.85)); continue; } if (pr.knees) { o.band.set(J.lHp.clone().lerp(J.lK, 0.85), J.rHp.clone().lerp(J.rK, 0.85)); continue; }
      const a = pr.from ? V(...pr.from) : hand('l'), b = pr.toFoot ? J[pr.toFoot + 'A'] : (pr.from && pr.toFoot === null ? hand('l') : hand('r')); o.band.set(a, b); }
    if (o.rope) { const a = hand('l'), b = hand('r'); const ph = (tm % 0.5) / 0.5 * Math.PI * 2; const n = o.rope.length; let prev = a;
      for (let i = 1; i <= n; i++) { const u = i / n; const p = a.clone().lerp(b, u); const sag = Math.sin(u * Math.PI); p.addScaledVector(V(0, 1, 0), Math.cos(ph) * sag * 0.95 - 0.05).addScaledVector(J.aP.F, Math.sin(ph) * sag * 0.45); if (p.y < 0.01) p.y = 0.01; o.rope[i - 1].set(prev, p); prev = p; } }
    if (o.ropes) { const anchor = g.localToWorld(V(0, 0.15, 0)); ['l', 'r'].forEach((k, j) => { const h = hand(k); let prev = h; const n = 12; for (let i = 1; i <= n; i++) { const u = i / n; const p = h.clone().lerp(anchor, u); p.y = Math.max(0.03, lerp(h.y, anchor.y, u) + Math.sin(u * 9 - tm * 14 + j * 2) * 0.08 * (1 - u)); o.ropes[j][i - 1].set(prev, p); prev = p; } }); }
    if (o.lever) { const a = V(...pr.from), h = hand('l').lerp(hand('r'), 0.5), d = V().subVectors(h, a).normalize(); const end = h.clone().addScaledVector(d, 0.25); o.lever.set(a, end); o.lp.forEach((c, i) => { c.position.copy(h.clone().addScaledVector(d, 0.1 + i * 0.06)); c.quaternion.setFromUnitVectors(UP, d); }); }
    if (o.seat && pr.seatFollow) o.seat.position.z = g.worldToLocal(J.P.clone()).z;
  }
}

// ---------- tijdlijn
// voeten en handen die in elke stand op de grond staan, op één vaste plek zetten (geen glijden of draaien)
function prep(def, sex) {
  const key = '_p' + sex; if (def[key]) return def[key];
  // figuur 180° gedraaid: gespiegelde ('m') posities wisselen van kant, anders kruisen armen en benen
  const flip = k => { if (Math.abs((k.o || [0, 0, 0])[1] || 0) <= 90) return k; const c = { ...k }; for (const q of ['lh', 'rh', 'lf', 'rf']) if (c[q] && c[q][0] === 'm') c[q] = ['m', -c[q][1], c[q][2], c[q][3]]; return c; };
  const Bd = BODY[sex] || BODY.m, kf = def.kf.map(norm).map(flip), out = kf.map(k => ({ ...k })), Fr = kf.map(k => frames(k, Bd));
  for (const sd of ['l', 'r']) for (const ty of ['f', 'h']) {
    if (def.noPlant) break;
    const pos = kf.map((k, i) => target(Fr[i], Bd, k, sd, ty, k[sd + ty]));
    const lim = ty === 'f' ? 0.16 : 0.12;
    if (!pos.every(q => q.y < lim) || !pos.every(q => Math.hypot(q.x - pos[0].x, q.z - pos[0].z) < 0.1)) continue;
    const w = ['w', pos[0].x, Math.max(pos[0].y, ty === 'f' ? 0.07 : 0.035), pos[0].z];
    out.forEach(k => k[sd + ty] = w);
    if (ty === 'f' && !kf.some(k => k[sd + 'toe'] || k.toe)) { const J = solve(out[0], sex), tq = J[sd + 'toe']; out.forEach(k => k[sd + 'toe'] = [tq.x, tq.y, tq.z]); }
  }
  def[key] = out; return out;
}
export function sample(def, t, sex = 'm') {
  const loop = def.loop || 6;
  if (def.fn) { const reps = def.reps || Math.max(1, Math.round(loop / (def.cyc || 1))); const u = ((t % loop) / loop * reps) % 1; return def.fn(u, sex); }
  const kf = prep(def, sex), seq = def.seq || [[0, 0.25], [1, 1.2], [1, 0.15], [0, 1.0], [0, 0.4]];
  let total = 0; seq.forEach(s => total += s[1]);
  const reps = def.reps || Math.max(1, Math.round(loop / total));
  const T = (t % loop) / loop * reps * total;
  let acc = 0, tt = T % total;
  const n = seq.length, K = i => seq[((i % n) + n) % n][0];
  const stop = i => K(i) === K(i - 1) || K(i + 1) === K(i) || K(i - 1) === K(i + 1); // stilstand of omkeerpunt
  for (let i = 0; i < n; i++) { const [k, d] = seq[i]; if (tt <= acc + d || i === n - 1) { const prev = K(i - 1); const u = d > 0 ? Math.min(1, (tt - acc) / d) : 1;
      if (def.lin) return lerpPose(kf[prev], kf[k], u, sex);
      const a = stop(i - 1), b = stop(i), e = a && b ? ease(u) : a ? u * u * (2 - u) : b ? u + u * u - u * u * u : u;
      return lerpPose(kf[prev], kf[k], e, sex); } acc += d; }
  return kf[0];
}
