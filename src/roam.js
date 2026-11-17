// Free ride: an open Nairobi neighbourhood seen from a high diorama camera, the way Bruno Simon's folio frames
// its world. Drive anywhere, knock props over, pick up waving passengers at stages and drop them at the green beam.
import * as THREE from 'three'
import { scene, camera, lam, lamMap, canvasTex, M, box, mergeStatic, aimSun, glow } from './render.js'
import * as Mo from './models.js'
import * as P from './physics.js'
import { rider, spawnVehicle, syncRider } from './rider.js'
import { game, earn, activate } from './game.js'
import { burst, ringPulse, dropTrail, floatText } from './fx3d.js'
import { sfx } from './audio.js'
import { $, toast, stick } from './ui.js'
import { C, rnd, pick, clamp, damp, specks, ksh, reduceMotion, isTouch } from './util.js'

const PITCH = 60, ROADW = 12, BLOCK = 48, SIDE = 3, EXT = 96, SHIFT = 180
const ROADS = [-90, -30, 30, 90], CENTERS = [-60, 0, 60]
const STREETS = ['Kenyatta Ave', 'Moi Ave', 'Kimathi St', 'Koinange St', 'Mama Ngina St', 'Tom Mboya St', 'Biashara St', 'Muindi Mbingu St']
const NAMES = ['Wanjiru', 'Otieno', 'Akinyi', 'Kamau', 'Njeri', 'Mutua', 'Achieng', 'Wafula', 'Chebet', 'Mwangi', 'Atieno', 'Kiprono']

let root = null, stages = [], potholes = [], staticCols = [], buildings = []
let objs = [], matatus = [], props = [], waiting = [], job = null, arrow = null, beacon = null
let shake = 0, coinT = 0, tokenT = 0, potholeCool = 0, seatPerson = null
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _ray = new THREE.Ray()

// ------------------------------------------------------------------ map texture: roads, lane lines and crossings
function mapTexture () {
  const S = 2048, k = S / (EXT * 2), X = x => (x + EXT) * k
  return canvasTex(S, S, g => {
    g.fillStyle = '#4A4659'; g.fillRect(0, 0, S, S); specks(g, S, S, ['#34313F', '#5E5A70', '#6B677D'], 30000)
    g.lineCap = 'butt'
    // lane lines run between junctions and stop short of the crossings
    const cuts = [-EXT, ...ROADS, EXT]
    const seg = (vertical, r, a, b) => { g.beginPath(); if (vertical) { g.moveTo(X(r), X(a)); g.lineTo(X(r), X(b)) } else { g.moveTo(X(a), X(r)); g.lineTo(X(b), X(r)) } g.stroke() }
    for (const r of ROADS) for (const vertical of [true, false]) for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i] + (i === 0 ? 0 : ROADW / 2 + 3.4), b = cuts[i + 1] - (i === cuts.length - 2 ? 0 : ROADW / 2 + 3.4)
      if (b <= a) continue
      g.strokeStyle = 'rgba(255,253,245,.9)'; g.lineWidth = .3 * k; g.setLineDash([3 * k, 3 * k]); seg(vertical, r, a, b); g.setLineDash([])
      g.strokeStyle = C.yellow; g.lineWidth = .22 * k
      for (const e of [-ROADW / 2 + .5, ROADW / 2 - .5]) seg(vertical, r + e, a - (i === 0 ? 0 : 3.4), b + (i === cuts.length - 2 ? 0 : 3.4))
    }
    // zebra crossings on every approach to the inner junctions
    g.fillStyle = '#F4F1EA'
    for (const a of ROADS) for (const b of ROADS) {
      for (const s of [-1, 1]) for (let i = 0; i < 8; i++) {
        const off = -ROADW / 2 + .9 + i * 1.45
        g.fillRect(X(a + off) - .3 * k, X(b + s * (ROADW / 2 + 1.6)) - 1.4 * k, .6 * k, 2.8 * k)
        g.fillRect(X(b + s * (ROADW / 2 + 1.6)) - 1.4 * k, X(a + off) - .3 * k, 2.8 * k, .6 * k)
      }
    }
  })
}

// ------------------------------------------------------------------ build the neighbourhood (once)
function blockSlab (cx, cz, park) {
  const top = park ? canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#6FBF4A'; g.fillRect(0, 0, w, h); specks(g, w, h, ['#4E9E38', '#8FD46A'], 600) }, true)
    : canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#E9DCCB'; g.fillRect(0, 0, w, h)
      const cols = ['#C77B5C', '#B86A4E', '#A7A098', '#C9C0B4', '#D08E6C']
      for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { g.fillStyle = pick(cols); g.fillRect(c * 32 + (r % 2) * 16 + 1, r * 16 + 1, 30, 14) }
    }, true)
  top.repeat.set(BLOCK / (park ? 6 : 2.5), BLOCK / (park ? 6 : 2.5))
  const kerb = canvasTex(64, 16, (g, w, h) => { g.fillStyle = C.yellow; g.fillRect(0, 0, w / 2, h); g.fillStyle = C.ink; g.fillRect(w / 2, 0, w / 2, h) }, true)
  kerb.repeat.set(BLOCK / 2, 1)
  const side = lamMap(kerb)
  return M(box(BLOCK, .22, BLOCK), [side, side, lamMap(top), lam(C.ink), side, side], cx, .11, cz, false)
}
const DIRS = [{ x: 1, z: 0, rot: 0 }, { x: -1, z: 0, rot: Math.PI }, { x: 0, z: 1, rot: -Math.PI / 2 }, { x: 0, z: -1, rot: Math.PI / 2 }]
function placeOnEdge (obj, cx, cz, d, out, along) {
  // out: distance from block centre toward the street; along: position along the edge
  const ax = -d.z, az = d.x
  obj.position.set(cx + d.x * out + ax * along, obj.position.y, cz + d.z * out + az * along)
  obj.rotation.y = d.rot
  return obj
}
function buildBlock (g, cx, cz) {
  const half = BLOCK / 2 - SIDE   // 21: where building fronts sit
  for (const [di, d] of DIRS.entries()) {
    const full = di < 2, start = full ? -half : -half + 15, end = full ? half : half - 15
    let a = start
    while (a < end - 6) {
      const r = Math.random(), b = r < .58 ? Mo.makeShopBlock() : r < .8 ? Mo.makeTower() : Mo.makeCafe()
      const { L, D, H } = b.userData
      if (a + L > end + 1) break
      placeOnEdge(b, cx, cz, d, half - D / 2, a + L / 2)
      b.position.y = .22; g.add(b)
      b.traverse(o => { if (o.isMesh) o.userData.keep = true })
      buildings.push({ obj: b, box: new THREE.Box3(), squash: 1 })
      staticCols.push({ x: b.position.x, z: b.position.z, hx: D / 2, hz: L / 2, h: H, rot: d.rot })
      a += L + rnd(.6, 2)
    }
    // street trees, lamps and a few people along the sidewalk
    for (let s = -half + 4; s < half - 3; s += rnd(9, 13)) {
      const t = pick([Mo.makeJacaranda, Mo.makeJacaranda, Mo.makeFlame, Mo.makePalm])()
      placeOnEdge(t, cx, cz, d, half + SIDE - 1, s); t.position.y = .22; t.rotation.y = rnd(0, 6); g.add(t)
      staticCols.push({ x: t.position.x, z: t.position.z, r: .3 })
    }
    for (const s of [-half + 8, half - 8]) {
      const l = Mo.makeLamp(); placeOnEdge(l, cx, cz, d, half + SIDE - .5, s + 4); l.position.y = .22; g.add(l)
      staticCols.push({ x: l.position.x, z: l.position.z, r: .15 })
    }
    for (let k = 0; k < 2; k++) { const p = Mo.makePerson(); placeOnEdge(p, cx, cz, d, half + rnd(.6, 1.6), rnd(-half + 3, half - 3)); p.position.y = .22; p.rotation.y = rnd(0, 6); g.add(p) }
  }
}
function buildPark (g) {
  // Uhuru-style park: a clock tower on a plinth, a fountain, jacarandas and flower beds
  const plinth = M(new THREE.CylinderGeometry(4.2, 4.6, .6, 32), lam('#D9CDBD'), 0, .5, 0); g.add(plinth)
  const water = M(new THREE.CylinderGeometry(3.6, 3.6, .1, 32), lam('#6FB6E8', { emissive: '#1E4E7A', emissiveIntensity: .4 }), 0, .82, 0, false); g.add(water)
  const tower = new THREE.Group(); g.add(tower)
  tower.add(M(box(1.6, 9, 1.6), lam('#EFE6D8'), 0, 5.3, 0))
  tower.add(M(box(2.1, 2.1, 2.1), lam('#C9B79C'), 0, 10.6, 0))
  const face = canvasTex(128, 128, (c) => {
    c.fillStyle = C.paper; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.strokeStyle = C.ink; c.lineWidth = 6; c.stroke()
    c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 26); c.moveTo(64, 64); c.lineTo(92, 74); c.stroke()
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.fillStyle = C.ink; c.fillRect(64 + Math.cos(a) * 50 - 3, 64 + Math.sin(a) * 50 - 3, 6, 6) }
  })
  for (const [x, z, ry] of [[1.06, 0, Math.PI / 2], [-1.06, 0, -Math.PI / 2], [0, 1.06, 0], [0, -1.06, Math.PI]]) {
    const f = new THREE.Mesh(new THREE.CircleGeometry(.85, 24), lamMap(face, { emissive: '#FFF6C8', emissiveIntensity: .3 })); f.position.set(x, 10.6, z); f.rotation.y = ry; tower.add(f)
  }
  tower.add(M(new THREE.ConeGeometry(1.6, 2.4, 4).rotateY(Math.PI / 4), lam(C.green), 0, 12.85, 0))
  tower.add(M(new THREE.SphereGeometry(.25, 10, 8), lam(C.yellow, { emissive: '#FFB000', emissiveIntensity: 1.5 }), 0, 14.3, 0, false))
  staticCols.push({ x: 0, z: 0, r: 4.4 })
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, r = rnd(12, 18), t = (i % 3 ? Mo.makeJacaranda : Mo.makeFlame)()
    t.position.set(Math.cos(a) * r, .22, Math.sin(a) * r); g.add(t); staticCols.push({ x: t.position.x, z: t.position.z, r: .3 })
  }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2, b = Mo.makeBougainvillea(); b.position.set(Math.cos(a) * 7, .22, Math.sin(a) * 7); g.add(b) }
  const gp = Mo.makeGrass(900, 44, 44); gp.position.y = .22; g.add(gp)
  for (let k = 0; k < 6; k++) { const p = Mo.makePerson(); p.position.set(rnd(-18, 18), .22, rnd(-18, 18)); p.rotation.y = rnd(0, 6); g.add(p) }
}
function build () {
  root = new THREE.Group()
  const statics = new THREE.Group(); root.add(statics)
  const ground = M(new THREE.PlaneGeometry(EXT * 2, EXT * 2).rotateX(-Math.PI / 2), lamMap(mapTexture()), 0, 0, 0, false)
  ground.userData.keep = true; root.add(ground)
  const grass = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#6FBF4A'; g.fillRect(0, 0, w, h); specks(g, w, h, ['#4E9E38', '#8FD46A'], 600) }, true)
  grass.repeat.set(40, 40)
  const outer = M(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), lamMap(grass), 0, -.05, 0, false); outer.userData.keep = true; root.add(outer)
  staticCols.length = 0
  for (const cx of CENTERS) for (const cz of CENTERS) {
    const bg = new THREE.Group(); bg.position.set(cx, 0, cz)
    const park = cx === 0 && cz === 0
    bg.add(blockSlab(0, 0, park))
    if (park) buildPark(bg)
    else buildBlock(bg, 0, 0)
    // block-local collider coordinates to world
    for (const c of staticCols) if (!c.done) { c.x += cx; c.z += cz; c.done = true }
    mergeStatic(bg); statics.add(bg)
  }
  root.updateMatrixWorld(true)
  for (const b of buildings) b.box.setFromObject(b.obj)
  // a hedge and far towers around the edge of the map
  const hedge = lam('#2E9E5B', { wind: 1 })
  for (const s of [-1, 1]) {
    statics.add(M(box(EXT * 2 + 4, 1.4, 1.6), hedge, 0, .7, s * (EXT + 1)))
    statics.add(M(box(1.6, 1.4, EXT * 2 + 4), hedge, s * (EXT + 1), .7, 0))
  }
  for (let i = 0; i < 28; i++) {
    const t = Mo.makeFarTower(), a = i / 28 * Math.PI * 2, r = rnd(125, 160)
    t.position.set(Math.cos(a) * r, t.position.y, Math.sin(a) * r); statics.add(t)
  }
  // stages: one on the inward-facing side of each block
  stages = []
  let n = 0
  for (const cx of CENTERS) for (const cz of CENTERS) {
    if (cx === 0 && cz === 0) continue
    const dx = -Math.sign(cx), dz = -Math.sign(cz)
    const d = dx && (!dz || Math.random() < .5) ? DIRS.find(q => q.x === dx) : DIRS.find(q => q.z === dz)
    const st = Mo.makeStage(false)
    const out = BLOCK / 2 - 1.6, along = rnd(-6, 6)
    const ax = -d.z, az = d.x
    st.position.set(cx + d.x * out + ax * along, .22, cz + d.z * out + az * along); st.rotation.y = d.rot
    statics.add(st)
    stages.push({ name: STREETS[n++ % STREETS.length], pos: new THREE.Vector3(cx + d.x * (BLOCK / 2 + .8) + ax * along, 0, cz + d.z * (BLOCK / 2 + .8) + az * along), dir: d })
  }
  // matatu-style destination beam and the guide arrow over the rider
  beacon = Mo.makeBeacon(C.lime); beacon.visible = false; root.add(beacon)
  arrow = new THREE.Group()
  const cone = M(new THREE.ConeGeometry(.45, 1.1, 4).rotateX(-Math.PI / 2), lam(C.lime, { emissive: '#4A8A00', emissiveIntensity: .9 }), 0, 0, 0, false)
  arrow.add(cone); arrow.userData.cone = cone; arrow.visible = false; scene.add(arrow)
  scene.add(root)
}

// ------------------------------------------------------------------ physics
function buildPhysics () {
  P.resetWorld()
  P.fixedBox(0, -.5, 0, 160, .5, 160, 0, 1)
  for (const cx of CENTERS) for (const cz of CENTERS) P.fixedBox(cx, .11, cz, BLOCK / 2, .11, BLOCK / 2, 0, 1)
  for (const c of staticCols) {
    if (c.r) { const b = P.world.createRigidBody(P.R.RigidBodyDesc.fixed().setTranslation(c.x, 1.5, c.z)); P.world.createCollider(P.R.ColliderDesc.cylinder(1.5, c.r), b) }
    else P.fixedBox(c.x, c.h / 2 + .22, c.z, c.hx, c.h / 2, c.hz, c.rot)
  }
  for (const s of [-1, 1]) { P.fixedBox(0, 1, s * (EXT + 1), EXT + 3, 1, .8); P.fixedBox(s * (EXT + 1), 1, 0, .8, 1, EXT + 3) }
}

// ------------------------------------------------------------------ dynamic content
function addProps () {
  props = []
  for (const cx of CENTERS) for (const cz of CENTERS) {
    if (cx === 0 && cz === 0) continue
    for (const d of DIRS) {
      if (Math.random() < .35) continue
      const kind = pick(['crate', 'sukuma', 'drum', 'crate', 'cone']), K = Mo.PROP_KINDS[kind]
      const along = rnd(-15, 15), out = BLOCK / 2 - SIDE + rnd(.8, 1.8), ax = -d.z, az = d.x
      for (let k = 0; k < (kind === 'crate' ? 3 : 2); k++) {
        const obj = K.build(); root.add(obj)
        const x = cx + d.x * out + ax * (along + k * 1.0), z = cz + d.z * out + az * (along + k * 1.0)
        const body = P.addProp(obj, K, x, kind === 'crate' && k === 2 ? 1.02 : .22, z, rnd(0, 6), f => { if (f > 25) sfx('hit', f / 260) })
        props.push({ obj, body })
      }
    }
  }
  // cones around a couple of road works
  for (let i = 0; i < 4; i++) {
    const r = pick(ROADS), along = pick([-60, 0, 60]) + rnd(-8, 8), vertical = Math.random() < .5
    for (let k = 0; k < 5; k++) {
      const K = Mo.PROP_KINDS.cone, obj = K.build(); root.add(obj)
      const x = vertical ? r + rnd(-4, 4) : along + k * 1.2, z = vertical ? along + k * 1.2 : r + rnd(-4, 4)
      props.push({ obj, body: P.addProp(obj, K, x, 0, z, 0, f => { if (f > 15) sfx('hit', f / 200) }) })
    }
  }
}
function roadPoint () {
  const r = pick(ROADS), t = rnd(-EXT + 8, EXT - 8)
  return Math.random() < .5 ? new THREE.Vector3(r + rnd(-3.5, 3.5), 0, t) : new THREE.Vector3(t, 0, r + rnd(-3.5, 3.5))
}
function addCoinLine () {
  const r = pick(ROADS), t0 = rnd(-EXT + 12, EXT - 22), vertical = Math.random() < .5, side = pick([-3, 3])
  for (let k = 0; k < 6; k++) {
    const c = Mo.makeCoin(); c.position.set(vertical ? r + side : t0 + k * 2.4, 1, vertical ? t0 + k * 2.4 : r + side); root.add(c)
    objs.push({ type: 'coin', obj: c })
  }
}
function addToken () {
  const kind = pick(['nitro', 'magnet', 'double', 'whistle', 'nitro']), t = Mo.makeToken(kind)
  t.position.copy(roadPoint()); root.add(t); objs.push({ type: 'pup', kind, obj: t })
}
function addPotholes () {
  potholes = []
  for (let i = 0; i < 12; i++) { const p = Mo.makePothole(); p.position.copy(roadPoint()); p.rotation.y = rnd(0, 3); root.add(p); potholes.push(p) }
}
// Matatus loop the inner and outer ring roads, keeping left as Kenyan traffic does.
function addMatatus () {
  matatus = []
  for (const [ring, count] of [[30, 3], [90, 3]]) {
    for (let i = 0; i < count; i++) {
      const obj = Mo.makeMatatu(), H = Mo.MATATU_HALF; root.add(obj)
      const { body } = P.kinematicBox(0, 0, 0, H.x, H.y, H.z)
      matatus.push({ obj, body, ring, s: (i / count) * ring * 8 + rnd(0, 10), speed: rnd(7, 10), stop: 0, honkT: 0 })
    }
  }
}
function ringPos (ring, s, out) {
  // counter-clockwise lap of a square of half-size `ring`, offset 3m to the left of travel
  const L = ring * 2, per = L * 4; s = ((s % per) + per) % per
  const seg = Math.floor(s / L), f = s - seg * L
  const pts = [[ring, ring, 0, -1], [ring, -ring, -1, 0], [-ring, -ring, 0, 1], [-ring, ring, 1, 0]]
  const [x0, z0, dx, dz] = pts[seg]
  out.set(x0 + dx * f + dz * 3, 0, z0 + dz * f - dx * 3)
  return Math.atan2(-dx, -dz)
}
function spawnPassenger () {
  const free = stages.filter(s => !waiting.some(w => w.stage === s) && (!job || job.to !== s))
  if (!free.length) return
  const st = pick(free), pax = Mo.makePax()
  pax.position.copy(st.pos); pax.rotation.y = Math.atan2(st.dir.x, st.dir.z); root.add(pax)
  waiting.push({ stage: st, obj: pax, name: pick(NAMES) })
}
function setJobText () {
  if (job) {
    const d = Math.round(job.to.pos.distanceTo(rider.v.position))
    $('jobTitle').textContent = `Take ${job.name} to ${job.to.name} stage`
    $('jobSub').textContent = `${d} m to go. Fare Ksh ${job.fare}${job.timeLeft > 0 ? `, tip if you get there in ${Math.ceil(job.timeLeft)} s` : ''}.`
  } else {
    $('jobTitle').textContent = 'Find a passenger'
    $('jobSub').textContent = 'Ride to a waving person at a stage and slow down.'
  }
}

// ------------------------------------------------------------------ public API
export const roam = {
  enter () {
    if (!root) build()
    root.visible = true
    for (const o of objs) root.remove(o.obj); objs = []
    for (const w of waiting) root.remove(w.obj); waiting = []
    for (const p of props) root.remove(p.obj)
    for (const m of matatus) root.remove(m.obj)
    for (const p of potholes) root.remove(p)
    buildPhysics()
    addProps(); addMatatus(); addPotholes()
    for (let i = 0; i < 4; i++) addCoinLine()
    for (let i = 0; i < 3; i++) addToken()
    for (let i = 0; i < 3; i++) spawnPassenger()
    job = null; beacon.visible = false; arrow.visible = true
    spawnVehicle(30 - 3, 40, Math.PI / 2)
    rider.model.seatPax.visible = false
    game.onWhistle = () => { for (const m of matatus) if (m.obj.position.distanceTo(rider.v.position) < 45) m.stop = 8; toast('Kanjo Whistle!', 'Nearby matatus pull over.') }
    scene.fog.near = 70; scene.fog.far = 190
    setJobText()
    $('job').hidden = false; $('streak').hidden = true
  },
  exit () {
    if (root) root.visible = false
    if (arrow) arrow.visible = false
    $('job').hidden = true; $('streak').hidden = false
  },
  hop () { if (game.state === 'play' && P.hopVehicle(rider.v, 5.5)) sfx('hop') },
  reset () { const p = rider.v.position; P.placeVehicle(rider.v, p.x, 1.4, p.z, Math.atan2(-rider.v.forward.z, rider.v.forward.x)); toast('Back on your wheels') },

  control (dt, keys) {
    const v = rider.v
    if (game.state === 'play') {
      const up = (keys.up ? 1 : 0) - (keys.down ? 1 : 0) + (stick.active ? stick.y : 0)
      const st = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + (stick.active ? stick.x : 0)
      v.input.throttle = clamp(up, -1, 1); v.input.steer = clamp(st, -1, 1)
      v.input.boost = keys.boost || stick.boost || game.pu.nitro > 0
    } else { v.input.throttle = 0; v.input.steer = 0; v.input.boost = false }
    v.topSpeed = 17
    P.driveVehicle(v, dt)
    for (const m of matatus) {
      if (m.launched) continue
      if (m.stop > 0) m.stop -= dt
      else {
        // brake for the boda if it is right in front
        const ahead = _w.set(-Math.sin(m.obj.rotation.y), 0, -Math.cos(m.obj.rotation.y))
        const rel = _v.copy(rider.v.position).sub(m.obj.position), along = rel.dot(ahead)
        const blocked = along > 2 && along < 9 && Math.abs(rel.x * ahead.z - rel.z * ahead.x) < 2
        m.s += (blocked ? 0 : m.speed) * dt
        if (blocked && m.honkT <= 0) { sfx('honk'); m.honkT = 3 }
      }
      m.honkT -= dt
      const yaw = ringPos(m.ring, m.s, _w)
      m.obj.position.copy(_w)
      m.obj.rotation.y = yaw
      m.body.setNextKinematicTranslation({ x: _w.x, y: 0, z: _w.z })
      m.body.setNextKinematicRotation(m.obj.quaternion)
    }
  },

  update (dt) {
    const v = rider.v, st = game.state
    syncRider(dt, game.time)
    aimSun(v.position)
    if (v.position.y < -6) roam.reset()
    if (v.justLanded) { sfx('land'); shake = Math.max(shake, .08) }

    if (st === 'play') {
      game.t += dt
      const left = Math.max(0, SHIFT - game.t)
      $('lvl').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`
      if (left <= 0) roam.timeUp = true
    }
    // waiting passengers wave; pick one up by slowing down next to them
    for (const w of waiting) {
      const u = w.obj.userData
      u.arm.rotation.z = -.35 + Math.sin(game.time * 9 + u.ph) * .45; u.coin.rotation.y += dt * 3
      const s = 1 + Math.sin(game.time * 6 + u.ph) * .12; u.ring.scale.set(s, 1, s)
    }
    if (st === 'play' && !job) {
      const w = waiting.find(w => w.obj.position.distanceTo(v.position) < 3.6)
      if (w && v.speed < 9) {
        root.remove(w.obj); waiting = waiting.filter(x => x !== w)
        const choices = stages.filter(s => s !== w.stage && s.pos.distanceTo(w.stage.pos) > 50)
        const to = pick(choices.length ? choices : stages.filter(s => s !== w.stage))
        const dist = to.pos.distanceTo(w.stage.pos)
        job = { name: w.name, to, fare: 50 + Math.round(dist / 4 / 10) * 10, timeLeft: dist / 8 + 8, start: game.t }
        rider.model.seatShirt.color.set(w.obj.userData.shirt); rider.model.seatPax.visible = true
        beacon.position.copy(to.pos); beacon.visible = true
        sfx('fare'); toast(`${w.name} hopped on`, `Drop-off: ${to.name} stage`)
        setTimeout(spawnPassenger, 2500)
      }
    }
    if (job) {
      job.timeLeft -= dt
      beacon.userData.ring.scale.setScalar(1 + Math.sin(game.time * 5) * .08)
      if (st === 'play' && job.to.pos.distanceTo(v.position) < 4.5 && v.speed < 9) {
        const tip = job.timeLeft > 0 ? 30 : 0
        earn(job.fare + tip, _v.copy(rider.model.root.position).setY(2.6), tip ? `+Ksh ${job.fare + tip} with tip` : null)
        game.drops++
        sfx('drop'); burst(_v.copy(v.position).setY(1.5), 30, [C.lime, C.yellow, C.paper, C.magenta], 7); ringPulse(v.position, C.lime, 10)
        toast(tip ? 'Haraka tip!' : 'Dropped off', tip ? `${job.name} paid Ksh ${job.fare} plus a Ksh 30 tip.` : `${job.name} paid Ksh ${job.fare}.`)
        rider.model.seatPax.visible = false; beacon.visible = false; job = null
      }
    }
    if (Math.floor(game.time * 4) !== Math.floor((game.time - dt) * 4)) setJobText()
    // the guide arrow points at the drop-off or the nearest waiting passenger
    const target = job ? job.to.pos : waiting.reduce((b, w) => (!b || w.obj.position.distanceTo(v.position) < b.distanceTo(v.position)) ? w.obj.position : b, null)
    arrow.visible = !!target && (st === 'play' || st === 'paused')
    if (target) {
      arrow.position.copy(rider.model.root.position).setY(rider.model.root.position.y + 3.3 + Math.sin(game.time * 4) * .15)
      arrow.rotation.y = Math.atan2(target.x - v.position.x, target.z - v.position.z) + Math.PI
      arrow.userData.cone.material.color.set(job ? C.lime : C.yellow)
    }
    // coins, tokens
    const magnet = game.pu.magnet > 0
    for (const o of objs) {
      const p = o.obj.position
      if (o.type === 'coin') { o.obj.rotation.y += dt * 4; if (magnet && p.distanceTo(v.position) < 16) { p.x = damp(p.x, v.position.x, 6, dt); p.z = damp(p.z, v.position.z, 6, dt) } }
      else { const u = o.obj.userData; u.cube.rotation.y += dt * 2; u.cube.position.y = 1.3 + Math.sin(game.time * 3 + u.ph) * .18 }
      if (st === 'play' && Math.hypot(p.x - v.position.x, p.z - v.position.z) < 1.4) {
        o.dead = true
        if (o.type === 'coin') { earn(10, null, false); game.coins++; sfx('coin', 0); burst(_v.copy(p), 4, [C.yellow, C.paper], 3, .6) }
        else activate(o.kind)
      }
    }
    objs = objs.filter(o => { if (o.dead) { root.remove(o.obj); return false } return true })
    coinT -= dt; if (coinT <= 0 && objs.filter(o => o.type === 'coin').length < 24) { addCoinLine(); coinT = 6 }
    tokenT -= dt; if (tokenT <= 0 && objs.filter(o => o.type === 'pup').length < 3) { addToken(); tokenT = 12 }
    // potholes jolt you: a bump, a wobble and a groan, unless you are flying in Nganya Mode
    potholeCool -= dt
    if (st === 'play' && v.grounded && potholeCool <= 0 && game.pu.nitro <= 0) {
      for (const p of potholes) if (Math.hypot(p.position.x - v.position.x, p.position.z - v.position.z) < p.userData.r * .9) {
        v.body.applyImpulse({ x: rnd(-2, 2), y: 9, z: rnd(-2, 2) }, true); v.body.applyTorqueImpulse({ x: rnd(-.6, .6), y: rnd(-.8, .8), z: rnd(-.6, .6) }, true)
        sfx('hit', .9); shake = .3; potholeCool = 1.2; toast(pick(['Eish! Pothole', 'Pole pole!', 'Shimo!']))
        break
      }
    }
    // matatus: honk when close, go flying in Nganya Mode
    for (const m of matatus) {
      if (m.launched) continue
      const d = m.obj.position.distanceTo(v.position)
      if (d < 3.4 && st === 'play' && game.pu.nitro > 0) {
        m.launched = true
        P.launch(m.body, m.obj, { x: (m.obj.position.x - v.position.x) * 20, y: 90, z: (m.obj.position.z - v.position.z) * 20 }, { x: rnd(-40, 40), y: rnd(-20, 20), z: rnd(-40, 40) })
        sfx('smash'); shake = .3; burst(_v.copy(m.obj.position).setY(1.5), 20, [C.paper, C.yellow, C.magenta], 8)
      }
    }
    if (game.pu.nitro > 0 && st === 'play' && v.speed > 4) dropTrail(_v.copy(rider.model.root.position).addScaledVector(v.forward, -1).setY(.6), rider.model.root.quaternion)
    shake = damp(shake, 0, 6, dt)
    // buildings between the camera and the rider squash down out of the way
    _ray.origin.copy(camera.position); _w.copy(v.position).setY(1.2).sub(camera.position)
    const len = _w.length(); _ray.direction.copy(_w).divideScalar(len)
    for (const b of buildings) {
      const hit = _ray.intersectBox(b.box, _v) && _v.distanceTo(camera.position) < len
      b.squash = damp(b.squash, hit ? .07 : 1, hit ? 9 : 4, dt)
      b.obj.scale.y = b.squash; b.obj.visible = b.squash > .075 || !hit
    }
  },

  // Bruno-style diorama camera: high, narrow lens, gliding after the rider with a little look-ahead.
  camera (dt, blend, P01) {
    const v = rider.v
    cam.target.x = damp(cam.target.x, v.position.x + v.velocity.x * .35, 4, dt)
    cam.target.z = damp(cam.target.z, v.position.z + v.velocity.z * .35, 4, dt)
    cam.target.y = 0
    const radius = 32 + P01 * 12 + clamp(v.speed / 30, 0, 1) * 6
    const phi = Math.PI * (.27 - P01 * .04), theta = Math.PI * .25
    camera.position.setFromSphericalCoords(radius, phi, theta).add(cam.target)
    if (shake) { camera.position.x += rnd(-shake, shake); camera.position.y += rnd(-shake, shake) }
    camera.lookAt(cam.target)
    return 30 + P01 * 6
  },
  timeUp: false,
  debug: () => ({ waiting: waiting.map(w => w.obj.position), job: job && { to: job.to.pos, name: job.name } })
}
const cam = { target: new THREE.Vector3() }
