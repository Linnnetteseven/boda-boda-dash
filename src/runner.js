// Runner mode: an endless three-lane Nairobi road. The boda is a real physics vehicle that steers itself
// toward the lane you pick, bounces over speed bumps, knocks cones flying, and can hop potholes.
import * as THREE from 'three'
import { scene, camera, lam, lamMap, canvasTex, M, box, mergeStatic, aimSun, glow } from './render.js'
import * as Mo from './models.js'
import * as P from './physics.js'
import { rider, spawnVehicle, syncRider } from './rider.js'
import { game, earn, activate, updateStreak } from './game.js'
import { burst, ringPulse, dropTrail, speedLines, floatText } from './fx3d.js'
import { sfx } from './audio.js'
import { $, toast } from './ui.js'
import { C, rnd, pick, clamp, damp, specks, ease, reduceMotion } from './util.js'

const LANE = 2.4, LANES = [-LANE, 0, LANE], ROAD_HALF = LANE * 1.5 + .5
const KERB = .35, VERGE = 1.7, WALK = 2.7, FRONT = ROAD_HALF + KERB + VERGE + WALK
const CH = 40, NCH = 6, AHEAD = 112, BASE = 17, MAXS = BASE * 2.6
const STRIP = 300, SNAP = 24

let root = null, strip = null, chunks = [], ground = null, groundZ = 0
let objs = [], lane = 1, spawnDist = 0, attractT = 0, crashT = 0, crashReason = ''
const _v = new THREE.Vector3(), _q = new THREE.Quaternion()

// ------------------------------------------------------------------ world build (once)
function build () {
  root = new THREE.Group()
  strip = new THREE.Group(); root.add(strip)
  const plane = (w, tex, x, y) => { const m = M(new THREE.PlaneGeometry(w, STRIP), lamMap(tex), x, y, -STRIP / 2 + 60, false); m.rotation.x = -Math.PI / 2; strip.add(m); return m }
  const road = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4A4659'; g.fillRect(0, 0, w, h); specks(g, w, h, ['#34313F', '#5E5A70', '#6B677D'], 900)
    const px = x => (x + ROAD_HALF) / (2 * ROAD_HALF) * w
    g.fillStyle = C.yellow; g.fillRect(px(-ROAD_HALF + .25), 0, 5, h); g.fillRect(px(ROAD_HALF - .25) - 5, 0, 5, h)
    g.fillStyle = 'rgba(255,253,245,.95)'; for (const x of [-LANE / 2, LANE / 2]) g.fillRect(px(x) - 4, 0, 8, h * .5)
  }, true)
  road.repeat.set(1, STRIP / 8); plane(ROAD_HALF * 2, road, 0, 0)
  const grass = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#6FBF4A'; g.fillRect(0, 0, w, h); specks(g, w, h, ['#4E9E38', '#8FD46A', '#5DB043'], 700) }, true)
  const far = grass.clone(); far.repeat.set(30, STRIP / 10); far.needsUpdate = true
  { const m = M(new THREE.PlaneGeometry(320, STRIP), lamMap(far), 0, -.03, -STRIP / 2 + 60, false); m.rotation.x = -Math.PI / 2; strip.add(m) }
  const cabro = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#E9DCCB'; g.fillRect(0, 0, w, h)
    const cols = ['#C77B5C', '#B86A4E', '#A7A098', '#C9C0B4', '#D08E6C']
    for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { g.fillStyle = pick(cols); g.fillRect(c * 32 + (r % 2) * 16 + 1, r * 16 + 1, 30, 14) }
    specks(g, w, h, ['#000', '#fff'], 200)
  }, true)
  for (const s of [-1, 1]) {
    const v = grass.clone(); v.repeat.set(1, STRIP / 3); v.needsUpdate = true; plane(VERGE, v, s * (ROAD_HALF + KERB + VERGE / 2), .2)
    const c = cabro.clone(); c.repeat.set(WALK / 2, STRIP / 2); c.needsUpdate = true; plane(WALK, c, s * (ROAD_HALF + KERB + VERGE + WALK / 2), .2)
    strip.add(M(box(VERGE + WALK, .2, STRIP), lam('#BDB2A2'), s * (ROAD_HALF + KERB + (VERGE + WALK) / 2), .1, -STRIP / 2 + 60, false))
    const kx = s * (ROAD_HALF + KERB / 2)
    const kt = canvasTex(32, 64, (g, w, h) => { g.fillStyle = C.yellow; g.fillRect(0, 0, w, h / 2); g.fillStyle = C.ink; g.fillRect(0, h / 2, w, h / 2) }, true)
    kt.repeat.set(1, STRIP / 2)
    const ks = canvasTex(64, 32, (g, w, h) => { g.fillStyle = C.yellow; g.fillRect(0, 0, w / 2, h); g.fillStyle = C.ink; g.fillRect(w / 2, 0, w / 2, h) }, true)
    ks.repeat.set(STRIP / 2, 1)
    const kerb = M(box(KERB, .3, STRIP), [lamMap(ks), lamMap(ks), lamMap(kt), lam(C.ink), lam(C.ink), lam(C.ink)], kx, .15, -STRIP / 2 + 60, false)
    strip.add(kerb)
  }
  for (let i = 0; i < NCH; i++) chunks.push(buildChunk(i))
  scene.add(root)
}
function face (obj, s) { if (s > 0) obj.rotation.y = Math.PI; return obj }   // models face +x; right-side ones turn round
function buildChunk (i) {
  const g = new THREE.Group()
  for (const s of [-1, 1]) {
    let z = 0
    while (z > -CH) {
      const r = Math.random(), b = r < .1 ? Mo.makePark() : r < .6 ? Mo.makeShopBlock() : r < .82 ? Mo.makeTower() : Mo.makeCafe()
      b.position.set(s * (FRONT + b.userData.D / 2), 0, z - b.userData.L / 2); face(b, s); g.add(b)
      z -= b.userData.L + rnd(.8, 2.6)
    }
    const vx = s * (ROAD_HALF + KERB + VERGE / 2)
    for (let tz = -rnd(2, 5); tz > -CH; tz -= rnd(8, 11)) { const t = pick([Mo.makeJacaranda, Mo.makeJacaranda, Mo.makePalm, Mo.makeFlame])(); t.position.set(s * (FRONT - .9), .2, tz); t.rotation.y = rnd(0, 6); g.add(t) }
    for (let tz = -rnd(4, 8); tz > -CH; tz -= rnd(9, 14)) { const b = Mo.makeBougainvillea(); b.position.set(vx + s * rnd(-.3, .3), .2, tz); g.add(b) }
    for (const tz of [-6, -26]) { const l = face(Mo.makeLamp(), s); l.position.set(s * (ROAD_HALF + KERB + .25), .2, tz); g.add(l) }
    const wx = s * (ROAD_HALF + KERB + VERGE + WALK * .55)
    if (Math.random() < .45) { const st = face(Mo.makeStage(), s); st.position.set(wx, .2, -rnd(12, 30)); g.add(st) }
    for (let k = 0; k < 2; k++) { const p = Mo.makePerson(); p.position.set(wx + s * rnd(-.6, .6), .2, -rnd(2, CH - 2)); p.rotation.y = pick([0, Math.PI]) + rnd(-.3, .3); g.add(p) }
    for (let k = 0; k < 2; k++) { const t = Mo.makeFarTower(); t.position.set(s * rnd(32, 56), t.position.y, -rnd(0, CH)); g.add(t) }
    const grassPatch = Mo.makeGrass(420, VERGE - .3, CH); grassPatch.position.set(vx, .2, -CH / 2); g.add(grassPatch)
  }
  if (i % 3 === 1) {
    for (let k = 0; k < 8; k++) g.add(M(new THREE.PlaneGeometry(.55, 3.4).rotateX(-Math.PI / 2), lam('#F4F1EA'), -ROAD_HALF + .9 + k * ((ROAD_HALF * 2 - 1.8) / 7), .012, -CH / 2, false))
    for (const s of [-1, 1]) { const tl = Mo.makeTrafficLight(); tl.rotation.y = Math.PI; tl.position.set(s * (ROAD_HALF + KERB + .5), .2, -CH / 2 + 2.4); g.add(tl) }
  }
  mergeStatic(g)
  g.position.z = 60 - i * CH
  root.add(g)
  return g
}

// ------------------------------------------------------------------ physics for this mode
function buildPhysics (startZ) {
  P.resetWorld()
  groundZ = startZ
  ground = P.world.createRigidBody(P.R.RigidBodyDesc.fixed().setTranslation(0, 0, groundZ))
  P.world.createCollider(P.R.ColliderDesc.cuboid(40, .5, 300).setTranslation(0, -.5, 0).setFriction(1), ground)
  for (const s of [-1, 1]) P.world.createCollider(P.R.ColliderDesc.cuboid(.2, 1.2, 300).setTranslation(s * (ROAD_HALF + .15), 1, 0).setFriction(.1).setRestitution(.3), ground)
  spawnVehicle(LANES[1], startZ, Math.PI / 2)
}

// ------------------------------------------------------------------ spawning
function spawnRow (pz) {
  const z0 = pz - AHEAD
  const busy = new Set(objs.filter(o => o.type === 'matatu' && !o.cleared && o.obj.position.z < pz - 4).map(o => o.lane))
  const free = [0, 1, 2].filter(i => !busy.has(i)).sort(() => Math.random() - .5)
  let n = Math.random() < (game.level >= 2 ? .45 : .22) ? 2 : 1; n = Math.min(n, free.length - 1)
  const used = []
  // a speed bump across the whole road now and then
  if (game.t > 10 && Math.random() < .12) { addBump(z0 + 9); }
  for (let i = 0; i < n; i++) {
    const l = free[i]; used.push(l)
    const r = Math.random()
    if (r < .42) addMatatu(l, z0)
    else if (r < .86) addPothole(l, z0)
    else addCones(l, z0)
  }
  let left = free.filter(l => !used.includes(l))
  if (left.length && Math.random() < .55) { const l = pick(left); addPax(l, z0 - rnd(0, 6)); left = left.filter(x => x !== l) }
  if (left.length && Math.random() < .45) { const l = pick(left), zz = z0 - rnd(0, 4); for (let k = 0; k < 5; k++) addCoin(l, zz - k * 2.2); left = left.filter(x => x !== l) }
  if (left.length && game.t > 6 && !objs.some(o => o.type === 'pup') && Math.random() < .2) {
    const r2 = Math.random(), kind = r2 < .25 ? 'nitro' : r2 < .47 ? 'shield' : r2 < .69 ? 'magnet' : r2 < .84 ? 'double' : 'whistle'
    const obj = Mo.makeToken(kind); obj.position.set(LANES[pick(left)], 0, z0 - 3); root.add(obj)
    objs.push({ type: 'pup', kind, obj, hx: 1.2, hz: 1.1 })
  }
}
function addMatatu (l, z) {
  const obj = Mo.makeMatatu(), H = Mo.MATATU_HALF; obj.position.set(LANES[l], 0, z); root.add(obj)
  const { body, col } = P.kinematicBox(LANES[l], 0, z, H.x, H.y, H.z)
  objs.push({ type: 'matatu', lane: l, obj, body, col, speed: rnd(5, 8), hx: H.x + .32, hz: H.z + .95 })
}
function addPothole (l, z) {
  const obj = Mo.makePothole(); obj.position.set(LANES[l] + rnd(-.3, .3), 0, z); obj.rotation.y = rnd(0, Math.PI); root.add(obj)
  objs.push({ type: 'pothole', lane: l, obj, hx: .85, hz: .75 })
}
function addPax (l, z) {
  const obj = Mo.makePax(); obj.position.set(LANES[l], 0, z); root.add(obj)
  objs.push({ type: 'pax', lane: l, obj, hx: 1.2, hz: 1.0 })
}
function addCoin (l, z) {
  const obj = Mo.makeCoin(); obj.position.set(LANES[l], 1, z); root.add(obj)
  objs.push({ type: 'coin', lane: l, obj, hx: 1.0, hz: .8 })
}
function addCones (l, z) {
  // road works: a cluster of cones and a crate that go flying when you hit them
  for (let k = 0; k < 3; k++) {
    const kind = k === 1 && Math.random() < .5 ? 'crate' : 'cone', K = Mo.PROP_KINDS[kind], obj = K.build()
    root.add(obj)
    const body = P.addProp(obj, K, LANES[l] + (k - 1) * .7, 0, z - k * .9, rnd(0, 1), f => { if (f > 30) sfx('hit', f / 300) })
    objs.push({ type: 'prop', obj, body, hx: 0, hz: 0 })
  }
}
function addBump (z) {
  const tex = canvasTex(64, 16, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? C.ink : C.yellow; g.fillRect(i * 8, 0, 8, h) } })
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(4, 1)
  const obj = M(new THREE.CylinderGeometry(.5, .5, ROAD_HALF * 2, 20).rotateZ(Math.PI / 2), lamMap(tex), 0, -.32, z, false)
  root.add(obj)
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
  const body = P.world.createRigidBody(P.R.RigidBodyDesc.fixed().setTranslation(0, -.32, z).setRotation(q))
  P.world.createCollider(P.R.ColliderDesc.cylinder(ROAD_HALF, .5).setFriction(.8), body)
  objs.push({ type: 'bump', obj, body, hx: 0, hz: 0, z })
}
function removeObj (o) {
  root.remove(o.obj)
  if (o.body) P.removeBody(o.body)
}

// ------------------------------------------------------------------ interactions
function patch (o) { o.cleared = true; const u = o.obj.userData; u.hole.material = Mo.patchMat; u.water.visible = false; u.br.visible = false }
function smash (o) {
  o.cleared = true
  if (o.type === 'matatu') {
    const side = Math.sign(o.obj.position.x - rider.v.position.x) || pick([-1, 1])
    P.launch(o.body, o.obj, { x: side * 60, y: 90, z: -60 }, { x: rnd(-40, 40), y: rnd(-20, 20), z: side * -60 })
    o.launched = true
    sfx('smash'); shakeCam(.3); burst(_v.copy(o.obj.position).setY(1.5), 20, [C.paper, C.yellow, C.magenta, C.chrome], 8)
  } else { patch(o); P.hopVehicle(rider.v, 4); sfx('hop') }
}
game.onWhistle = null
function whistle () {
  const pz = rider.v.position.z
  for (const o of objs) {
    if (o.obj.position.z > pz + 1 || o.cleared) continue
    if (o.type === 'matatu') { o.cleared = true; const sx = o.lane === 1 ? pick([-1, 1]) : Math.sign(LANES[o.lane]); o.swerve = { t: 0, x0: o.obj.position.x, x1: sx * (ROAD_HALF + 2.2) } }
    if (o.type === 'pothole') patch(o)
  }
}
function collect (o) {
  const p = o.obj.position
  o.dead = true
  if (o.type === 'pax') {
    earn(50, _v.copy(p).setY(2.6)); game.pax++; game.streak++
    rider.model.seatShirt.color.set(o.obj.userData.shirt); rider.model.seatPax.visible = true; seatT = 3
    burst(_v.copy(p).setY(2.3), 14, [C.yellow, C.lime, C.paper], 5); sfx('fare'); sfx('streak', game.streak)
    if (game.streak >= 3) { game.streak = 0; setTimeout(() => game.state === 'play' && activate(pick(['nitro', 'shield', 'magnet', 'double', 'whistle']), 'Streak bonus'), 250) }
    updateStreak()
  } else if (o.type === 'coin') {
    earn(10, null, false); game.coins++
    coinChain = coinChainT > 0 ? Math.min(coinChain + 1, 12) : 0; coinChainT = .6; sfx('coin', coinChain)
    burst(_v.copy(p), 4, [C.yellow, C.paper], 3, .6)
  } else if (o.type === 'pup') activate(o.kind)
}
let seatT = 0, coinChain = 0, coinChainT = 0, shake = 0, laneVx = 0
function shakeCam (s) { shake = Math.max(shake, reduceMotion ? s * .2 : s) }
function crash (o) {
  game.state = 'crash'; crashT = 0; shakeCam(.55)
  crashReason = o.type === 'pothole' ? pick(['You hit a pothole.', 'That pothole was deeper than it looked.']) : pick(['You crashed into a matatu.', 'A matatu stopped right in front of you.'])
  rider.tipDir = rider.v.position.x >= o.obj.position.x ? 1 : -1
  const v = rider.v
  v.body.applyImpulse({ x: rider.tipDir * 6, y: 10, z: o.type === 'matatu' ? 14 : 2 }, true)
  burst(_v.copy(rider.model.root.position).setY(1), 26, [C.yellow, C.magenta, C.paper, '#888'], 7)
  rider.model.seatPax.visible = false
  sfx('crash'); try { navigator.vibrate && navigator.vibrate(140) } catch (e) {}
}

// ------------------------------------------------------------------ public API
export const runner = {
  enter () {
    if (!root) build()
    root.visible = true
    for (const o of objs) removeObj(o); objs = []
    const startZ = 0
    for (let i = 0; i < NCH; i++) chunks[i].position.z = 60 - i * CH
    buildPhysics(startZ)
    lane = 1; spawnDist = 22; seatT = 0; crashT = 0; shake = 0
    rider.model.seatPax.visible = false
    game.onWhistle = whistle
    scene.fog.near = 40; scene.fog.far = 140
  },
  exit () { if (root) root.visible = false; for (const o of objs) removeObj(o); objs = [] },
  restart () { this.enter() },
  steer (dir) { if (game.state !== 'play') return; const n = clamp(lane + dir, 0, 2); if (n !== lane) { lane = n; sfx('swish') } },
  hop () { if (game.state === 'play' && P.hopVehicle(rider.v)) sfx('hop') },
  crashReason: () => crashReason,
  crashTime: () => crashT,

  // pre-physics control, called every fixed step
  control (dt) {
    const v = rider.v, st = game.state
    if (st === 'menu') { attractT -= dt; if (attractT <= 0) { lane = clamp(lane + pick([-1, 1]), 0, 2); attractT = rnd(1.4, 2.6) } }
    const target = st === 'menu' ? BASE * .55 : st === 'play' ? Math.min(MAXS, BASE * (1 + .2 * (game.level - 1))) : 0
    v.topSpeed = Math.max(1, target)
    v.input.boost = game.pu.nitro > 0
    if (st === 'crash' || st === 'over') { v.input.throttle = -.6; v.input.steer = 0 }
    else {
      v.input.throttle = 1
      // lane assist: steer into the chosen lane and blend the sideways velocity toward it, so a lane
      // switch takes about a quarter of a second but the boda still yaws, leans and rides its suspension
      const err = LANES[lane] - v.position.x
      const yawErr = Math.atan2(v.forward.x, -v.forward.z)
      laneVx = clamp(err * 10, -14, 14)
      v.input.steer = clamp(laneVx * .08 - yawErr * 1.5, -1, 1)
    }
    v.steerMax = .5
    P.driveVehicle(v, dt)
    if (st === 'play' || st === 'menu') { const lv = v.body.linvel(); v.body.setLinvel({ x: lv.x + (laneVx - lv.x) * .3, y: lv.y, z: lv.z }, true) }
    for (const o of objs) {
      if (o.type !== 'matatu' || o.launched) continue
      const p = o.obj.position
      if (o.swerve) { o.swerve.t = Math.min(1, o.swerve.t + dt * 1.4); p.x = o.swerve.x0 + (o.swerve.x1 - o.swerve.x0) * ease(o.swerve.t); o.obj.rotation.y = Math.sin(o.swerve.t * Math.PI) * .4 * Math.sign(o.swerve.x1) }
      p.z -= o.speed * dt
      o.body.setNextKinematicTranslation({ x: p.x, y: 0, z: p.z })
      o.body.setNextKinematicRotation(o.obj.quaternion)
    }
  },

  update (dt) {
    const v = rider.v, st = game.state
    syncRider(dt, game.time)
    const pz = v.position.z
    // keep the ground and road strip under the rider
    if (Math.abs(pz - groundZ) > 60) { groundZ = Math.round(pz / SNAP) * SNAP; ground.setTranslation({ x: 0, y: 0, z: groundZ }, true) }
    strip.position.z = Math.round(pz / SNAP) * SNAP
    for (const c of chunks) { if (c.position.z > pz + 70) c.position.z -= NCH * CH; else if (c.position.z < pz - NCH * CH + 70) c.position.z += NCH * CH }
    aimSun(_v.set(v.position.x, 0, pz - 12))

    if (st === 'play') {
      game.t += dt
      const nl = 1 + Math.floor(game.t / 30)
      if (nl > game.level) { game.level = nl; $('lvl').textContent = `Speed ${game.level}`; toast('Faster!', `Speed ${game.level}`); sfx('level') }
      spawnDist -= Math.max(0, v.fwdSpeed) * dt
      if (spawnDist <= 0) { spawnRow(pz); spawnDist = rnd(16, 24) }
    }
    if (v.justLanded) { sfx('land'); shakeCam(.08) }

    // object behaviour
    const magnet = game.pu.magnet > 0 && st === 'play'
    for (const o of objs) {
      const p = o.obj.position, u = o.obj.userData
      if (magnet && (o.type === 'coin' || o.type === 'pax') && p.z > pz - 40 && p.z < pz) {
        p.x = damp(p.x, v.position.x, 7, dt); p.z = damp(p.z, pz - .4, 3.5, dt); if (o.type === 'coin') p.y = damp(p.y, 1.2, 5, dt)
      }
      if (o.type === 'pax') {
        u.arm.rotation.z = -.35 + Math.sin(game.time * 9 + u.ph) * .45; u.coin.rotation.y += dt * 3; u.coin.position.y = 2.6 + Math.sin(game.time * 4 + u.ph) * .12
        const s = 1 + Math.sin(game.time * 6 + u.ph) * .12; u.ring.scale.set(s, 1, s)
        if (!o.missed && p.z > pz + 2 && st === 'play') { o.missed = true; if (game.streak) { game.streak = 0; updateStreak() } }
      } else if (o.type === 'coin') o.obj.rotation.y += dt * 4
      else if (o.type === 'pup') { u.cube.rotation.y += dt * 2; u.cube.rotation.x = Math.sin(game.time * 2 + u.ph) * .3; u.cube.position.y = 1.3 + Math.sin(game.time * 3 + u.ph) * .18 }
      else if (o.type === 'matatu' && !reduceMotion && u.glow) u.glow.material.opacity = .45 + Math.sin(game.time * 7 + o.lane) * .2
      if (o.type === 'matatu' && !o.honked && !o.cleared && st === 'play' && o.lane === lane && p.z < pz - 10 && p.z > pz - 26) { o.honked = true; sfx('honk') }
    }

    // collisions with pickups and hazards
    if (st === 'play') {
      const x = v.position.x
      for (const o of objs) {
        if (o.dead || o.launched || !o.hx) continue
        const p = o.obj.position, wide = magnet && (o.type === 'coin' || o.type === 'pax') ? 1.4 : 1
        if (Math.abs(p.x - x) > o.hx * wide || Math.abs(p.z - pz) > o.hz) continue
        if (o.type === 'pax' || o.type === 'coin' || o.type === 'pup') { collect(o); continue }
        if (o.cleared) continue
        if (o.type === 'pothole' && !v.grounded) continue
        if (game.pu.nitro > 0 || game.grace > 0) smash(o)
        else if (game.pu.shield > 0) { game.pu.shield = 0; game.grace = 1.2; sfx('shieldBreak'); burst(_v.copy(rider.model.root.position).setY(1.2), 20, ['#E8B062', '#A8642A', C.cyan], 7); smash(o); toast('Shield used!') }
        else { crash(o); break }
      }
    }
    if (st === 'crash' || st === 'over') { crashT += dt; rider.tipped = Math.min(1, rider.tipped + dt * 2.2) } else rider.tipped = Math.max(0, rider.tipped - dt * 3)

    // tidy up objects behind the camera
    objs = objs.filter(o => {
      const gone = o.dead || o.obj.position.z > pz + 16 || o.obj.position.y < -20
      if (gone) removeObj(o)
      return !gone
    })

    seatT = Math.max(0, seatT - dt); if (seatT === 0 && st === 'play') rider.model.seatPax.visible = false
    coinChainT -= dt
    // Nganya Mode light trails and speed lines
    if (game.pu.nitro > 0 && st === 'play') {
      dropTrail(_v.copy(rider.model.root.position).addScaledVector(v.forward, -1).setY(.6), rider.model.root.quaternion)
      speedLines(v.position, _v.set(0, 0, -1).clone(), v.speed)
    }
    rider.model.root.visible = !(game.grace > 0 && st === 'play' && Math.floor(game.time * 14) % 2 === 0)
    shake = damp(shake, 0, 6, dt)
  },

  // chase camera, blended with a slow orbit around the rider on the menu screen
  camera (dt, blend, P01) {
    const v = rider.v, x = rider.model.root.position.x, pz = v.position.z
    const sp = clamp((v.speed - BASE) / (MAXS - BASE), 0, 1), nk = game.pu.nitro > 0 ? 1 : 0
    camState.nk = damp(camState.nk, nk, 3, dt)
    const cy = 3.4 + P01 * 1.8, cz = 7.4 + P01 * 3.6, look = -10 - P01 * 4
    camState.x = damp(camState.x, x * .72, 6, dt)
    const chase = _a.set(camState.x, cy + camState.nk * .2, pz + cz - sp * .8 + camState.nk * .9)
    const chaseLook = _b.set(x * .8, 1.2, pz + look)
    const a = Math.sin(game.time * .2) * 1.6 + .25, R = 5.4 + P01 * 2.2
    const orbit = _c.set(x + Math.sin(a) * Math.min(R, 3.5), 1.5 + P01 * .6, pz + Math.cos(a) * R)
    const orbitLook = _d.set(x, 1.25, pz)
    const k = ease(clamp(blend, 0, 1))
    camera.position.lerpVectors(orbit, chase, k)
    const lk = _e.lerpVectors(orbitLook, chaseLook, k)
    if (shake) { camera.position.x += rnd(-shake, shake); camera.position.y += rnd(-shake, shake) * .6 }
    camera.lookAt(lk)
    return (60 + P01 * 14 - 8) * (1 - k) + (60 + P01 * 14 + sp * 9 + camState.nk * 13) * k
  }
}
const camState = { x: 0, nk: 0 }
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3()
