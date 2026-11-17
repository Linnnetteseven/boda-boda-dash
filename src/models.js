// Everything you can see: people, the boda and rider, matatus, potholes, trees, buildings, props, pickups.
// Models face -z (forward) unless noted. All materials come from render.js so they share the Bruno-style lighting.
import * as THREE from 'three'
import { lam, lamMap, glow, canvasTex, rep, M, box } from './render.js'
import { C, rnd, pick, label, specks } from './util.js'

// ------------------------------------------------------------------ shared geometry
export const GEO = {
  leg: new THREE.CapsuleGeometry(.075, .62, 4, 8), shoe: box(.13, .08, .24), torso: new THREE.CapsuleGeometry(.19, .34, 4, 10), head: new THREE.SphereGeometry(.15, 16, 12),
  hair: new THREE.SphereGeometry(.157, 16, 8, 0, Math.PI * 2, 0, Math.PI * .5), wrap: new THREE.SphereGeometry(.17, 14, 8, 0, Math.PI * 2, 0, Math.PI * .55),
  cap: new THREE.CylinderGeometry(.16, .16, .08, 14), brim: box(.2, .025, .16), tie: box(.06, .3, .02), collar: box(.16, .06, .04), pack: box(.32, .4, .16),
  bag: new THREE.CylinderGeometry(.14, .11, .24, 10), skirt: new THREE.CylinderGeometry(.17, .31, .88, 12), arm: new THREE.CapsuleGeometry(.06, .42, 4, 6),
  hand: new THREE.SphereGeometry(.065, 8, 6), eye: new THREE.SphereGeometry(.024, 6, 4),
  crown: new THREE.IcosahedronGeometry(1, 1), crownLo: new THREE.IcosahedronGeometry(1, 0), trunk: new THREE.CylinderGeometry(.14, .22, 2.6, 7),
  pole: new THREE.CylinderGeometry(.07, .09, 1, 8), part: box(.14, .14, .14), ring: new THREE.RingGeometry(.75, .95, 32).rotateX(-Math.PI / 2)
}

// ------------------------------------------------------------------ power-up icons (3D tokens and HUD)
export const PUPS = {
  nitro: { name: 'Nganya Mode', color: '#FF2E88', what: 'A neon speed burst. Smash straight through matatus.', dur: 5 },
  shield: { name: 'Chapati Shield', color: '#19C3E6', what: 'A ring of chapatis that blocks one crash.', dur: 15 },
  magnet: { name: 'Pesa Magnet', color: '#00B377', what: 'Pulls coins and passengers in from every lane.', dur: 8 },
  whistle: { name: 'Kanjo Whistle', color: '#FFD23F', what: 'Matatus pull over and potholes get patched.', dur: 0 },
  double: { name: 'Double Fare', color: '#FF7A1A', what: 'Every shilling counts twice.', dur: 10 }
}
function drawIcon (g, type, S) {
  const p = PUPS[type], r = S * .2
  g.fillStyle = C.ink; g.beginPath(); g.roundRect(0, 0, S, S, r); g.fill()
  g.fillStyle = p.color; g.beginPath(); g.roundRect(S * .05, S * .05, S * .9, S * .9, r * .8); g.fill()
  g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.roundRect(S * .1, S * .09, S * .8, S * .28, r * .6); g.fill()
  g.lineJoin = 'round'; g.lineWidth = S * .05; g.strokeStyle = C.ink
  const P = (pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * S, y * S) : g.moveTo(x * S, y * S)); g.closePath(); g.fillStyle = fill; g.fill(); g.stroke() }
  if (type === 'nitro') P([[.56, .14], [.28, .55], [.47, .55], [.38, .88], [.73, .43], [.52, .43], [.62, .14]], C.yellow)
  if (type === 'shield') {
    g.fillStyle = '#E8B062'; g.beginPath(); g.arc(S / 2, S / 2, S * .32, 0, 7); g.fill(); g.stroke()
    g.fillStyle = '#A8642A'; for (const [x, y, rr] of [[.4, .4, .05], [.6, .45, .04], [.48, .62, .05], [.63, .62, .03], [.36, .56, .03]]) { g.beginPath(); g.arc(x * S, y * S, rr * S, 0, 7); g.fill() }
  }
  if (type === 'magnet') {
    g.lineWidth = S * .16; g.strokeStyle = C.ink; g.beginPath(); g.arc(S / 2, S * .46, S * .2, Math.PI, 0, true); g.stroke()
    g.lineWidth = S * .1; g.strokeStyle = C.red; g.beginPath(); g.arc(S / 2, S * .46, S * .2, Math.PI, 0, true); g.stroke()
    g.fillStyle = C.chrome; g.strokeStyle = C.ink; g.lineWidth = S * .04; for (const x of [.25, .65]) { g.beginPath(); g.rect(x * S, S * .42, S * .1, S * .16); g.fill(); g.stroke() }
    label(g, 'KSH', S / 2, S * .8, S * .15, C.paper, C.ink)
  }
  if (type === 'whistle') {
    g.fillStyle = C.chrome; g.beginPath(); g.arc(S * .42, S * .58, S * .2, 0, 7); g.fill(); g.stroke()
    g.beginPath(); g.rect(S * .5, S * .38, S * .32, S * .14); g.fill(); g.stroke(); g.fillStyle = C.ink; g.beginPath(); g.arc(S * .42, S * .58, S * .07, 0, 7); g.fill()
  }
  if (type === 'double') label(g, 'x2', S / 2, S * .56, S * .5, C.paper, C.ink)
}
export const ICON = {}, ICON_URL = {}
export function buildIcons () {
  for (const k of Object.keys(PUPS)) { ICON[k] = canvasTex(128, 128, (g, w) => drawIcon(g, k, w)); ICON_URL[k] = ICON[k].image.toDataURL() }
}

// ------------------------------------------------------------------ people
export const SKINS = ['#5C3317', '#7A4A2B', '#4A2A14', '#8B5A3C', '#6B3E22']
export const SHIRTS = ['#FF2E88', '#19C3E6', '#00B377', '#FF7A1A', '#7B3FF2', '#FFD23F', '#E8364A', '#FFFDF5']
const KANGA = ['#FF7A1A', '#00B377', '#7B3FF2', '#E8364A', '#19C3E6']
export function makePerson (o = {}) {
  const style = o.style || pick(['suit', 'student', 'mama', 'casual']), g = new THREE.Group(), skin = pick(SKINS)
  const top = o.shirt || (style === 'suit' ? pick(['#2B2F45', '#45506E', '#5A4636', '#3B4A6B']) : pick(SHIRTS))
  const pants = style === 'suit' ? '#262A3E' : pick(['#2B3A67', '#4A4A5A', '#6B4E3D', '#1F2A44', '#3D5A40'])
  if (style === 'mama') g.add(M(GEO.skirt, lam(pick(KANGA)), 0, .5, 0))
  else for (const x of [-.1, .1]) g.add(M(GEO.leg, lam(pants), x, .42, 0))
  for (const x of [-.1, .1]) g.add(M(GEO.shoe, lam(style === 'suit' ? '#3A2416' : C.ink), x, .04, -.04))
  const t = M(GEO.torso, lam(top), 0, 1.1, 0); t.scale.set(1, 1, .72); g.add(t)
  if (style === 'suit') { g.add(M(GEO.collar, lam(C.paper), 0, 1.38, -.12, false)); g.add(M(GEO.tie, lam(pick([C.red, C.magenta, C.yellow])), 0, 1.2, -.14, false)) }
  g.add(M(GEO.head, lam(skin), 0, 1.6, 0))
  for (const x of [-.05, .05]) g.add(M(GEO.eye, lam(C.ink), x, 1.62, -.135, false))
  if (style === 'mama') { const w = M(GEO.wrap, lam(pick(KANGA)), 0, 1.64, 0); w.scale.set(1, 1.35, 1); g.add(w); g.add(M(GEO.bag, lam('#C68B4E'), -.3, .85, 0)) }
  else g.add(M(GEO.hair, lam('#1B1030'), 0, 1.62, .01, false))
  if (style === 'student') g.add(M(GEO.pack, lam(pick(SHIRTS)), 0, 1.15, .2))
  if (style === 'casual' && Math.random() < .6) { const cc = pick(SHIRTS); g.add(M(GEO.cap, lam(cc), 0, 1.72, 0, false)); g.add(M(GEO.brim, lam(cc), 0, 1.69, -.15, false)) }
  const la = M(GEO.arm, lam(top), -.27, 1.06, 0); la.rotation.z = .12; g.add(la); g.add(M(GEO.hand, lam(skin), -.31, .78, 0))
  const arm = new THREE.Group(); arm.position.set(.25, 1.3, 0); g.add(arm)
  arm.add(M(GEO.arm, lam(top), 0, .26, 0)); arm.add(M(GEO.hand, lam(skin), 0, .55, 0))
  arm.rotation.z = o.wave ? -.4 : Math.PI - .12
  g.userData = { arm, shirt: top }
  return g
}

// ------------------------------------------------------------------ the boda and its rider
// Returns { root, lean, wheels, tassels, seatPax, seatShirt, fx: { shield, magnet, underglow } }.
// root faces -z. The physics vehicle drives root; lean is tilted by lateral acceleration.
export function makeBoda () {
  const root = new THREE.Group(), lean = new THREE.Group(); root.add(lean)
  const B = lean, wheels = [], tassels = []
  const body = lam(C.magenta), chrome = lam(C.chrome, { emissive: '#3A3550' }), ink = lam('#221A30'), dark = lam('#3A3448')
  const tire = new THREE.TorusGeometry(.3, .085, 10, 26).rotateY(Math.PI / 2), rim = new THREE.CylinderGeometry(.2, .2, .07, 18).rotateZ(Math.PI / 2)
  for (const z of [.68, -.7]) {
    const w = new THREE.Group(); w.position.set(0, .385, z); B.add(w); wheels.push(w)
    w.add(M(tire, ink)); w.add(M(rim, chrome, 0, 0, 0, false))
    for (let i = 0; i < 3; i++) { const sp = M(box(.04, .4, .035), lam('#8E88A0'), 0, 0, 0, false); sp.rotation.x = i * Math.PI / 3; w.add(sp) }
    w.add(M(new THREE.CylinderGeometry(.06, .06, .16, 10).rotateZ(Math.PI / 2), body, 0, 0, 0, false))
    const guard = M(new THREE.TorusGeometry(.38, .045, 6, 18, Math.PI * .9).rotateY(Math.PI / 2), body, 0, .385, z); guard.rotation.x = z > 0 ? -.2 : .5; B.add(guard)
  }
  B.add(M(box(.28, .3, .44), dark, 0, .52, .02))
  for (let i = 0; i < 4; i++) B.add(M(box(.32, .03, .36), chrome, 0, .44 + i * .06, .02, false))
  B.add(M(box(.07, .07, 1.1), body, 0, .74, .05))
  const tank = M(new THREE.SphereGeometry(.26, 18, 12), body, 0, .96, -.22); tank.scale.set(.95, .68, 1.45); B.add(tank)
  const badge = M(new THREE.SphereGeometry(.26, 18, 12, 0, Math.PI * 2, 1.2, .5), chrome, 0, .96, -.22, false); badge.scale.set(.97, .7, 1.47); B.add(badge)
  for (const x of [-.17, .17]) B.add(M(box(.04, .2, .38), lam(C.yellow), x, .78, .33, false))
  B.add(M(box(.32, .22, .4), body, 0, .78, .33))
  const seat = M(new THREE.CapsuleGeometry(.15, .6, 4, 10).rotateX(Math.PI / 2), lam('#2A1E40'), 0, 1.02, .38); seat.scale.set(1.2, .55, 1); B.add(seat)
  const tc = [C.magenta, C.yellow, C.cyan, C.lime, C.orange]
  for (const x of [-.19, .19]) for (let i = 0; i < 6; i++) B.add(M(new THREE.ConeGeometry(.025, .12, 5).rotateX(Math.PI), lam(tc[i % 5]), x, .92, .08 + i * .11, false))
  B.add(M(box(.4, .04, .42), chrome, 0, 1.03, .86))
  B.add(M(box(.2, .09, .07), lam('#FF3B3B', { emissive: '#FF2020', emissiveIntensity: 2 }), 0, .95, 1.1, false))
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(.36, .2), lamMap(canvasTex(180, 100, (g, w, h) => {
    g.fillStyle = '#FFD23F'; g.fillRect(0, 0, w, h); g.strokeStyle = C.ink; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6)
    g.fillStyle = C.ink; g.font = 'bold 30px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('KMFX', w / 2, 33); g.fillText('254J', w / 2, 70)
  })))
  plate.position.set(0, .78, 1.12); B.add(plate)
  const flap = new THREE.Mesh(new THREE.PlaneGeometry(.3, .32), lamMap(canvasTex(96, 100, (g, w, h) => {
    g.fillStyle = C.ink; g.fillRect(0, 0, w, h); label(g, '254', w / 2, h * .45, 30, C.yellow); g.fillStyle = C.magenta; for (let x = 4; x < w; x += 12) g.fillRect(x, h - 14, 6, 14)
  })))
  flap.position.set(0, .28, 1.02); B.add(flap)
  for (const x of [-.11, .11]) { const f = M(new THREE.CylinderGeometry(.03, .03, .86, 8), chrome, x, .8, -.82); f.rotation.x = -.32; B.add(f) }
  const cowl = M(box(.34, .26, .18), body, 0, 1.1, -.94); cowl.rotation.x = -.3; B.add(cowl)
  B.add(M(new THREE.CylinderGeometry(.13, .13, .08, 18).rotateX(Math.PI / 2), chrome, 0, 1.08, -1.04, false))
  B.add(M(new THREE.CircleGeometry(.1, 18).rotateY(Math.PI), lam('#FFF6C8', { emissive: '#FFE27A', emissiveIntensity: 3 }), 0, 1.08, -1.085, false))
  B.add(M(new THREE.CylinderGeometry(.025, .025, .86, 8).rotateZ(Math.PI / 2), chrome, 0, 1.27, -.74))
  for (const s of [-1, 1]) {
    B.add(M(new THREE.CylinderGeometry(.04, .04, .15, 8).rotateZ(Math.PI / 2), ink, s * .43, 1.27, -.74, false))
    const t = new THREE.Group(); t.position.set(s * .51, 1.27, -.74); B.add(t); tassels.push(t)
    for (let i = 0; i < 5; i++) t.add(M(new THREE.ConeGeometry(.02, .22, 4).rotateX(Math.PI), lam(tc[i]), (i - 2) * .012, -.11, (i - 2) * .012, false))
    B.add(M(new THREE.CylinderGeometry(.012, .012, .32, 6), chrome, s * .33, 1.42, -.74, false))
    B.add(M(new THREE.CylinderGeometry(.08, .08, .03, 14).rotateX(Math.PI / 2), chrome, s * .35, 1.6, -.74, false))
  }
  B.add(M(new THREE.CylinderGeometry(.055, .07, .85, 10).rotateX(Math.PI / 2), chrome, .21, .5, .5))
  B.add(M(new THREE.CylinderGeometry(.045, .045, .03, 10).rotateX(Math.PI / 2), ink, .21, .5, .93, false))
  // rider in a reflector vest
  const jeans = lam('#2B3A67'), boot = lam('#2A1A12'), vest = lam(C.lime), jacket = lam('#2E3F8F'), glove = lam(C.ink), skin = lam('#5C3317')
  for (const s of [-1, 1]) {
    const th = M(new THREE.CapsuleGeometry(.09, .36, 4, 8).rotateX(Math.PI / 2), jeans, s * .18, 1.1, .02); th.rotation.y = s * -.1; B.add(th)
    const sh = M(new THREE.CapsuleGeometry(.08, .34, 4, 8), jeans, s * .22, .76, -.24); sh.rotation.x = .25; B.add(sh)
    B.add(M(box(.15, .13, .26), boot, s * .23, .52, -.32))
  }
  const torso = new THREE.Group(); torso.position.set(0, 1.46, .14); torso.rotation.x = -.34; B.add(torso)
  const tb = M(new THREE.CapsuleGeometry(.24, .4, 4, 12), vest); tb.scale.set(1.05, 1, .72); torso.add(tb)
  for (const y of [-.06, .16]) { const band = M(new THREE.CylinderGeometry(.255, .255, .055, 20, 1, true), lam('#E8ECF5', { emissive: '#9AA4C0', emissiveIntensity: .5 }), 0, y, 0, false); band.scale.set(1.05, 1, .72); torso.add(band) }
  const num = new THREE.Mesh(new THREE.PlaneGeometry(.3, .24), lamMap(canvasTex(128, 100, (g, w, h) => { g.fillStyle = C.paper; g.beginPath(); g.roundRect(0, 0, w, h, 14); g.fill(); label(g, '07', w / 2, h / 2 + 4, 64, C.magenta, C.ink) })))
  num.position.set(0, .04, .185); torso.add(num)
  torso.add(M(new THREE.CapsuleGeometry(.07, .08, 4, 8), jacket, 0, .38, -.02, false))
  for (const s of [-1, 1]) {
    const ua = M(new THREE.CapsuleGeometry(.075, .26, 4, 8), jacket, s * .3, 1.5, -.12); ua.rotation.x = 1.05; ua.rotation.z = s * .18; B.add(ua)
    const fa = M(new THREE.CapsuleGeometry(.065, .26, 4, 8), jacket, s * .37, 1.36, -.46); fa.rotation.x = 1.35; B.add(fa)
    B.add(M(new THREE.SphereGeometry(.075, 10, 8), glove, s * .42, 1.29, -.7, false))
  }
  B.add(M(new THREE.CylinderGeometry(.08, .09, .12, 10), skin, 0, 1.86, .02, false))
  const helmet = M(new THREE.SphereGeometry(.25, 22, 16), lam(C.yellow), 0, 2.04, -.02); helmet.scale.set(1, .95, 1.08); B.add(helmet)
  const stripe = M(new THREE.TorusGeometry(.252, .028, 6, 28, Math.PI).rotateY(Math.PI / 2), lam(C.magenta), 0, 2.04, -.02, false); stripe.scale.set(1, .95, 1.08); B.add(stripe)
  const visor = M(new THREE.SphereGeometry(.258, 22, 10, Math.PI * 1.5 - .95, 1.9, 1.0, .72), lam('#1A2440', { emissive: '#20305A', emissiveIntensity: .4 }), 0, 2.04, -.02, false); visor.scale.set(1, .95, 1.08); B.add(visor)
  // passenger seat
  const seatPax = new THREE.Group(); B.add(seatPax)
  const seatShirt = new THREE.MeshLambertMaterial({ color: C.purple })
  const pt = M(GEO.torso, seatShirt, 0, 1.5, .72); pt.scale.set(1, 1, .72); pt.rotation.x = -.15; seatPax.add(pt)
  seatPax.add(M(GEO.head, lam('#7A4A2B'), 0, 1.98, .74)); seatPax.add(M(GEO.hair, lam(C.ink), 0, 2.0, .75, false))
  for (const s of [-1, 1]) { seatPax.add(M(new THREE.CapsuleGeometry(.08, .34, 4, 8).rotateX(Math.PI / 2), jeans, s * .17, 1.12, .62)); seatPax.add(M(GEO.arm, seatShirt, s * .22, 1.46, .55)) }
  seatPax.visible = false
  // effects that ride along
  const shield = new THREE.Group(); shield.position.y = 1.15; root.add(shield)
  shield.add(M(new THREE.SphereGeometry(1.35, 24, 16), glow(C.cyan, .14), 0, 0, 0, false))
  shield.add(M(new THREE.IcosahedronGeometry(1.37, 1), new THREE.MeshBasicMaterial({ color: C.cyan, wireframe: true, transparent: true, opacity: .4, toneMapped: false }), 0, 0, 0, false))
  const chap = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#E8B062'; g.fillRect(0, 0, w, h); for (let i = 0; i < 14; i++) { g.fillStyle = pick(['#A8642A', '#C98440', '#F2CB86']); g.beginPath(); g.arc(rnd(0, w), rnd(0, h), rnd(2, 6), 0, 7); g.fill() } })
  for (let i = 0; i < 3; i++) { const c = M(new THREE.CylinderGeometry(.26, .26, .04, 18), lamMap(chap), 0, 0, 0, false); c.userData.a = i * Math.PI * 2 / 3; shield.add(c) }
  shield.visible = false
  const magnet = new THREE.Group(); root.add(magnet)
  for (let i = 0; i < 2; i++) magnet.add(M(new THREE.TorusGeometry(1.1 + i * .35, .05, 8, 48).rotateX(Math.PI / 2), glow(C.green, .8), 0, .15 + i * .08, 0, false))
  magnet.visible = false
  const underglow = M(new THREE.PlaneGeometry(1.6, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: C.magenta, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 0, .05, 0, false)
  root.add(underglow)
  root.traverse(o => { if (o.isMesh) o.userData.keep = true })
  return { root, lean, wheels, tassels, seatPax, seatShirt, fx: { shield, magnet, underglow } }
}

// ------------------------------------------------------------------ matatus
const PAINT = [['#FF2E88', '#FFD23F', '#19C3E6'], ['#7B3FF2', '#C6F432', '#FF2E88'], ['#00B377', '#FFD23F', '#FF7A1A'],
  ['#19C3E6', '#FF2E88', '#FFFDF5'], ['#1B1030', '#FF2E88', '#19C3E6'], ['#FFD23F', '#7B3FF2', '#19C3E6'], ['#E8364A', '#FFD23F', '#1B1030']]
const NAMES = ['NGANYA', 'MZINGA', 'DASH 254', 'RONGAI EXP', 'SWAG FM', 'BABA YAO', 'MOTOMOTO', 'KIBANDA', 'UMOJA BOYZ', 'MONEYFEST']
const matatuCache = {}
function matatuMats (pal, name) {
  const k = pal.join() + name; if (matatuCache[k]) return matatuCache[k]
  const [a, b, c] = pal
  const side = canvasTex(512, 200, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h)
    g.save(); g.beginPath(); g.rect(0, h * .5, w, h * .5); g.clip(); g.fillStyle = b
    for (let x = -200; x < w + 200; x += 90) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 40, h); g.lineTo(x + 140, h * .5); g.lineTo(x + 100, h * .5); g.fill() }
    g.fillStyle = c; for (let i = 0; i < 6; i++) { const sx = rnd(20, w - 20), sy = rnd(h * .55, h * .85); g.beginPath(); for (let p = 0; p < 10; p++) { const r = p % 2 ? 5 : 12, an = p * Math.PI / 5; g.lineTo(sx + Math.cos(an) * r, sy + Math.sin(an) * r) } g.fill() }
    g.restore()
    g.fillStyle = c; g.fillRect(0, h * .88, w, h * .12); g.fillStyle = C.chrome; g.fillRect(0, h * .47, w, 6)
    g.fillStyle = '#1D2B45'; g.fillRect(8, h * .1, w - 16, h * .34); g.fillStyle = a; for (let x = 8; x < w; x += 84) g.fillRect(x, h * .1, 8, h * .34)
    g.fillStyle = 'rgba(255,255,255,.3)'; for (let x = 30; x < w; x += 84) g.fillRect(x, h * .14, 10, h * .26)
    label(g, name, w / 2, h * .7, 52, C.paper, C.ink, w * .86)
  })
  const back = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = c; g.fillRect(0, h * .88, w, h * .12)
    g.fillStyle = '#1D2B45'; g.fillRect(w * .1, h * .12, w * .8, h * .34)
    label(g, name, w / 2, h * .56, 30, b, C.ink, w * .84)
    g.fillStyle = '#FF3B3B'; g.fillRect(w * .04, h * .64, w * .16, h * .14); g.fillRect(w * .8, h * .64, w * .16, h * .14)
    g.fillStyle = C.yellow; g.fillRect(w * .3, h * .68, w * .4, h * .13); g.fillStyle = C.ink; g.font = 'bold 22px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('KDM 254X', w / 2, h * .75)
  })
  const front = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = '#1D2B45'; g.fillRect(w * .06, h * .08, w * .88, h * .42)
    g.fillStyle = C.yellow; g.fillRect(w * .06, h * .66, w * .2, h * .1); g.fillRect(w * .74, h * .66, w * .2, h * .1); g.fillStyle = C.chrome; g.fillRect(w * .32, h * .62, w * .36, h * .18)
  })
  const roof = canvasTex(128, 320, (g, w, h) => { g.fillStyle = b; g.fillRect(0, 0, w, h); g.fillStyle = c; for (let y = 0; y < h; y += 60) g.fillRect(0, y, w, 22) })
  return matatuCache[k] = { body: [lamMap(side), lamMap(side), lamMap(roof), lam(C.ink), lamMap(back), lamMap(front)], glow: c }
}
const MG = {
  body: box(2, 2, 5), wheel: new THREE.TorusGeometry(.36, .14, 8, 18).rotateY(Math.PI / 2), rim: new THREE.CylinderGeometry(.27, .27, .32, 16).rotateZ(Math.PI / 2),
  bumper: box(2.08, .24, .16), rack: box(1.7, .08, 3.2), spoiler: box(1.9, .08, .5), glow: new THREE.PlaneGeometry(2.8, 5.8).rotateX(-Math.PI / 2), lightbar: box(1.4, .1, .12)
}
// Size used by physics: half extents of the matatu body.
export const MATATU_HALF = { x: 1.0, y: 1.25, z: 2.55 }
export function makeMatatu () {
  const pal = pick(PAINT), m = matatuMats(pal, pick(NAMES)), g = new THREE.Group()
  g.add(M(MG.body, m.body, 0, 1.45, 0))
  for (const x of [-.92, .92]) for (const z of [-1.7, 1.7]) { g.add(M(MG.wheel, lam('#221A30'), x, .5, z)); g.add(M(MG.rim, lam(C.chrome), x, .5, z, false)) }
  for (const z of [-2.55, 2.55]) g.add(M(MG.bumper, lam(C.chrome), 0, .62, z, false))
  g.add(M(MG.rack, lam(C.ink), 0, 2.5, -.3))
  g.add(M(box(.8, .4, .9), lam(pick(SHIRTS)), -.38, 2.74, .3)); g.add(M(box(.6, .35, .7), lam(pick(SHIRTS)), .42, 2.72, -.8))
  const sp = M(MG.spoiler, lam(pal[1]), 0, 2.62, 2.35); sp.rotation.x = -.2; g.add(sp)
  g.add(M(MG.lightbar, lam(pal[2], { emissive: pal[2], emissiveIntensity: 1.6 }), 0, 2.52, -2.3, false))
  for (const z of [-2.58]) for (const x of [-.7, .7]) g.add(M(box(.36, .2, .04), lam('#FFF6C8', { emissive: '#FFE27A', emissiveIntensity: 2.5 }), x, .95, z, false))
  for (const x of [-1.08, 1.08]) g.add(M(box(.08, .2, .16), lam(C.ink), x, 2.1, -2.2, false))
  const gl = M(MG.glow, glow(m.glow, .55), 0, .05, 0, false); g.add(gl); g.userData.glow = gl
  return g
}

// ------------------------------------------------------------------ potholes
function blob (r, n, k) {
  const s = new THREE.Shape()
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr = r * k[i % n]; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * .75) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * .75) }
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2)
}
export const patchMat = lam('#2C2838')
export function makePothole () {
  const g = new THREE.Group(), k = Array.from({ length: 12 }, () => rnd(.8, 1.12)), r = rnd(.85, 1.05)
  g.add(M(blob(r * 1.18, 12, k), lam('#6E6880'), 0, .012, 0, false))
  const hole = M(blob(r, 12, k), lam('#14101C'), 0, .02, 0, false); g.add(hole)
  const water = M(new THREE.CircleGeometry(r * .42, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8FB4E8', transparent: true, opacity: .65 }), -r * .15, .025, -r * .1, false); water.scale.set(1, 1, .6); g.add(water)
  for (let i = 0; i < 3; i++) { const a = rnd(0, 6.28), c = M(box(rnd(.15, .28), .08, rnd(.15, .28)), lam('#7D7294'), Math.cos(a) * r * 1.25, .05, Math.sin(a) * r * .95, false); c.rotation.y = a; g.add(c) }
  const br = new THREE.Group(); br.position.set(r * .35, 0, 0); br.rotation.z = -.25; g.add(br)
  br.add(M(new THREE.CylinderGeometry(.04, .06, 1.6, 5), lam('#6B3E26'), 0, .8, 0))
  for (const [x, y, s] of [[0, 1.6, .38], [.18, 1.35, .3], [-.16, 1.2, .28]]) { const l = M(GEO.crownLo, lam('#2FB463', { wind: 2 }), x, y, 0); l.scale.setScalar(s); br.add(l) }
  g.userData = { hole, water, br, r }
  return g
}

// ------------------------------------------------------------------ pickups
let coinMats, fareMats, coinGeo, fareGeo
function pickupMats () {
  if (coinMats) return
  const coinFace = canvasTex(128, 128, g => { g.fillStyle = '#FFD84A'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = '#D9A21E'; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.stroke(); label(g, '10', 64, 70, 46, '#8A5A00') })
  const fareFace = canvasTex(128, 128, g => { g.fillStyle = C.yellow; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = '#E0A800'; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke(); label(g, '50', 64, 70, 48, C.ink) })
  const gold = { emissive: '#7A5200', emissiveIntensity: .5 }
  coinMats = [lam('#E0A800', gold), lamMap(coinFace, gold), lamMap(coinFace, gold)]
  fareMats = [lam('#E0A800'), lamMap(fareFace), lamMap(fareFace)]
  coinGeo = new THREE.CylinderGeometry(.34, .34, .08, 22).rotateX(Math.PI / 2)
  fareGeo = new THREE.CylinderGeometry(.42, .42, .08, 24).rotateX(Math.PI / 2)
}
export function makeCoin () { pickupMats(); return M(coinGeo, coinMats, 0, 1, 0) }
export function makePax (o = {}) {
  pickupMats()
  const g = new THREE.Group(), p = makePerson({ wave: true, ...o }); p.rotation.y = Math.PI; g.add(p)
  const coin = M(fareGeo, fareMats, 0, 2.6, 0); g.add(coin)
  const ring = M(GEO.ring, glow(C.yellow, .85), 0, .03, 0, false); g.add(ring)
  g.userData = { arm: p.userData.arm, coin, ring, shirt: p.userData.shirt, ph: rnd(0, 6), person: p }
  return g
}
const tokenGeo = new THREE.BoxGeometry(1, 1, 1), beamGeo = new THREE.CylinderGeometry(.55, .55, 9, 18, 1, true)
export function makeToken (type) {
  const g = new THREE.Group(), mat = lamMap(ICON[type], { emissive: '#FFFFFF', emissiveMap: ICON[type], emissiveIntensity: .6 })
  const cube = M(tokenGeo, mat, 0, 1.3, 0); g.add(cube)
  g.add(M(beamGeo, glow(PUPS[type].color, .14), 0, 4.5, 0, false))
  g.add(M(GEO.ring, glow(PUPS[type].color, .85), 0, .03, 0, false))
  g.userData = { cube, ph: rnd(0, 6) }
  return g
}
// A tall beam that marks a drop-off point in Free ride.
export function makeBeacon (color = C.lime) {
  const g = new THREE.Group()
  g.add(M(new THREE.CylinderGeometry(1.6, 1.6, 30, 24, 1, true), glow(color, .18), 0, 15, 0, false))
  const r = M(new THREE.RingGeometry(2.2, 2.7, 40).rotateX(-Math.PI / 2), glow(color, .9), 0, .05, 0, false); g.add(r)
  g.userData.ring = r
  return g
}

// ------------------------------------------------------------------ knockable props (each gets a Rapier body)
const crateTex = () => canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#C98A4B'; g.fillRect(0, 0, w, h); g.fillStyle = '#A86E36'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 16 + 13, w, 3); g.strokeStyle = '#7A4E24'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4) })
let crateMat
export const PROP_KINDS = {
  cone: { half: [.22, .38, .22], mass: .4, build () { const g = new THREE.Group(); g.add(M(new THREE.ConeGeometry(.24, .7, 12), lam(C.orange), 0, 0, 0)); g.add(M(new THREE.CylinderGeometry(.13, .17, .12, 12), lam(C.paper, { emissive: '#666' }), 0, .02, 0, false)); g.add(M(box(.5, .06, .5), lam(C.orange), 0, -.35, 0)); return g } },
  crate: { half: [.4, .4, .4], mass: 1.2, build () { crateMat ||= lamMap(crateTex()); return M(box(.8, .8, .8), crateMat) } },
  drum: { half: [.32, .45, .32], mass: 1.6, build () { const g = new THREE.Group(); const col = pick([C.cyan, C.red, C.green, '#2B3A67']); g.add(M(new THREE.CylinderGeometry(.32, .32, .9, 16), lam(col))); for (const y of [-.25, .25]) g.add(M(new THREE.CylinderGeometry(.335, .335, .05, 16), lam(C.chrome), 0, y, 0, false)); return g } },
  sukuma: { half: [.45, .3, .35], mass: 1, build: null }
}
// A sukuma-and-fruit crate from a roadside mama mboga stall.
PROP_KINDS.sukuma.build = () => {
  const g = new THREE.Group(); g.add(M(box(.9, .4, .7), lam('#B07A3E'), 0, -.1, 0))
  for (let i = 0; i < 7; i++) { const f = M(GEO.crownLo, lam(pick(['#3DBE5C', '#E8364A', '#FF7A1A', '#FFD23F'])), rnd(-.3, .3), .17, rnd(-.2, .2), false); f.scale.setScalar(.15); g.add(f) }
  return g
}

// ------------------------------------------------------------------ roadside scenery
const SHOP_SIGNS = [['MAMA MBOGA', '#00B377'], ['CHAPATI CORNER', '#FF7A1A'], ['KINYOZI CLASSIC', '#19C3E6'], ['KAHAWA HOUSE', '#5A3A22'], ['DUKA LA DAWA', '#00A859'],
  ['MITUMBA BOUTIQUE', '#FF2E88'], ['PESA POINT', '#2E9E3F'], ['NYAMA CHOMA', '#E8364A'], ['FOREX BUREAU', '#1F4E9E'], ['SUPERMARKET', '#E8364A'], ['SALON SHIKO', '#B04BD6'],
  ['MANDAZI BAKERY', '#F2A93B'], ['BOOKSHOP', '#2B3A67'], ['SIMU REPAIRS', '#7B3FF2'], ['HARDWARE', '#C0392B']]
const TOWER_NAMES = ['IMARA TOWERS', 'UHURU PLAZA', 'PAMOJA HOUSE', 'KILIMANI HEIGHTS', 'JACARANDA MALL', 'SIMBA CENTRE', 'AMANI TOWER']
const CAFES = ['KAHAWA CAFE', 'CHAI CORNER', 'JIKONI GRILL', 'MANDAZI & CO']
const WALL = ['#F4E7D3', '#FFFDF5', '#F2C6A0', '#BFE3D0', '#F7D9E3', '#D9E4F5', '#F5E1A4', '#E8D2C0']
export const ACCENT = ['#FF2E88', '#19C3E6', '#00B377', '#FF7A1A', '#7B3FF2', '#E8364A', '#2B3A67']
const signCache = {}
export function signTex (text, bg, fg = C.paper) {
  const k = text + bg + fg; if (signCache[k]) return signCache[k]
  return signCache[k] = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, w, h * .45)
    g.strokeStyle = C.ink; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); label(g, text, w / 2, h / 2 + 5, 60, fg, C.ink, w * .86)
  })
}
const facadeCache = {}
function facade (kind, wall) {
  const k = kind + wall; if (facadeCache[k]) return facadeCache[k]
  return facadeCache[k] = canvasTex(256, 256, (g, w, h) => {
    const T = 64
    if (kind === 'res') {
      g.fillStyle = wall; g.fillRect(0, 0, w, h)
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const x = c * T, y = r * T, gg = g.createLinearGradient(x, y + 12, x + T, y + 48); gg.addColorStop(0, '#BDEBFF'); gg.addColorStop(1, '#5A88B5')
        g.fillStyle = '#FFFFFF'; g.fillRect(x + 11, y + 9, 42, 40); g.fillStyle = gg; g.fillRect(x + 14, y + 12, 36, 34)
        if (Math.random() < .35) { g.fillStyle = pick(['#F7B2C8', '#FFE08A', '#B9E6C9', '#F5F5F5']); g.fillRect(x + 14, y + 12, Math.random() < .5 ? 12 : 36, 34) }
        g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 31, y + 12, 2, 34)
        g.fillStyle = 'rgba(27,16,48,.18)'; g.fillRect(x + 9, y + 48, 46, 4)
        if (Math.random() < .45) { g.fillStyle = 'rgba(27,16,48,.75)'; g.fillRect(x + 4, y + 50, T - 8, 3); for (let b = x + 6; b < x + T - 4; b += 6) g.fillRect(b, y + 50, 2, 12); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x + 2, y + 61, T - 4, 3) }
      }
    } else {
      const tint = kind === 'green' ? ['#B8F0DE', '#2F8F7A', '#1B5E50'] : kind === 'gold' ? ['#FFE9B0', '#C99A3D', '#7A5A1C'] : ['#BFE6FF', '#3F7FB8', '#1F3F6E']
      const gg = g.createLinearGradient(0, 0, w, h); gg.addColorStop(0, tint[0]); gg.addColorStop(.55, tint[1]); gg.addColorStop(1, tint[2]); g.fillStyle = gg; g.fillRect(0, 0, w, h)
      for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(255,255,255,${rnd(.05, .2)})`; g.fillRect(Math.floor(rnd(0, 4)) * T, Math.floor(rnd(0, 4)) * T, T, T) }
      g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(0, h * .2); g.lineTo(w * .3, 0); g.lineTo(w * .45, 0); g.lineTo(0, h * .45); g.fill()
      g.fillStyle = tint[2]; for (let r = 0; r < 4; r++) g.fillRect(0, r * T + T - 10, w, 10)
      g.fillStyle = 'rgba(20,20,40,.55)'; for (let c = 0; c < 4; c++) g.fillRect(c * T, 0, 3, h)
    }
  }, true)
}
const shopfronts = []
function shopfront () {
  if (shopfronts.length < 6) shopfronts.push(canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = pick(WALL); g.fillRect(0, 0, w, h)
    const bw = w / 3
    for (let i = 0; i < 3; i++) {
      const x = i * bw, gg = g.createLinearGradient(0, 20, 0, h); gg.addColorStop(0, '#FFF2C8'); gg.addColorStop(1, '#E59A55')
      g.fillStyle = C.ink; g.fillRect(x + 10, 16, bw - 20, h - 16); g.fillStyle = gg; g.fillRect(x + 14, 20, bw - 28, h - 20)
      g.fillStyle = 'rgba(90,50,30,.55)'; for (let s = 0; s < 3; s++) g.fillRect(x + 18, 40 + s * 26, bw - 36, 4)
      for (let s = 0; s < 3; s++) for (let p = 0; p < 7; p++) { g.fillStyle = pick(SHIRTS.concat(['#8B5A3C', '#3D5A40'])); g.fillRect(x + 22 + p * (bw - 44) / 7, 28 + s * 26, 9, 12) }
      if (i === 1) { g.fillStyle = '#2A1E40'; g.fillRect(x + bw / 2 - 22, 40, 44, h - 40); g.fillStyle = C.yellow; g.fillRect(x + bw / 2 + 12, 80, 5, 5) }
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(x + 20, h); g.lineTo(x + 50, 20); g.lineTo(x + 64, 20); g.lineTo(x + 34, h); g.fill()
    }
  }))
  return pick(shopfronts)
}
const awnCache = {}
function awning (c) { return awnCache[c] ||= lamMap(canvasTex(64, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? C.paper : c; g.fillRect(i * 8, 0, 8, h) } })) }
const roofMat = () => lam('#9C93A8'), tankMat = () => lam('#24212C'), solarMat = () => lam('#2B4C8C', { emissive: '#0B1A3A' })

// Buildings are built facing +x (their shop fronts look toward +x). Rotate the group to face any street.
// Each returns a group with userData { L (length along the street), D (depth), H (height) }.
function faces (road, side, top) { return [road, side, top, top, side, side] }
export function makeShopBlock () {
  const g = new THREE.Group(), L = rnd(9, 13), D = rnd(6.5, 9), floors = Math.floor(rnd(2, 6)), wall = pick(WALL), acc = pick(ACCENT)
  const fx = D / 2, gf = 3.6, up = floors * 3.2
  g.add(M(box(D, gf, L), faces(lamMap(shopfront()), lam(acc), roofMat()), 0, gf / 2, 0))
  const ft = facade('res', wall)
  g.add(M(box(D, up, L), faces(lamMap(rep(ft, L / 2.8 / 4, floors / 4)), lamMap(rep(ft, D / 2.8 / 4, floors / 4)), roofMat()), 0, gf + up / 2, 0))
  g.add(M(box(D + .3, .35, L + .3), lam(acc), 0, gf + up + .17, 0))
  g.add(M(box(D + .2, .25, L + .2), lam(acc), 0, gf - .05, 0))
  const bays = L > 11 ? 3 : 2, bl = L / bays
  for (let i = 0; i < bays; i++) {
    const z = -L / 2 + bl * (i + .5), [txt, bg] = pick(SHOP_SIGNS)
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(bl * .86, bl * .86 / 4.2), lamMap(signTex(txt, bg)))
    sg.position.set(fx + .06, gf - .62, z); sg.rotation.y = Math.PI / 2; g.add(sg)
    const aw = M(box(1.3, .06, bl * .86), awning(pick(ACCENT)), fx + .6, gf - 1.2, z); aw.rotation.z = -.32; g.add(aw)
  }
  for (let i = 0; i < Math.floor(rnd(1, 3)); i++) g.add(M(new THREE.CylinderGeometry(.6, .6, 1.3, 14), tankMat(), rnd(-D / 3, D / 3), gf + up + 1, rnd(-L / 3, L / 3)))
  if (Math.random() < .5) { const p = M(box(2.2, .06, 1.4), solarMat(), -D / 5, gf + up + .6, rnd(-L / 4, L / 4)); p.rotation.z = -.35; g.add(p) }
  g.userData = { L, D, H: gf + up }
  return g
}
export function makeTower () {
  const g = new THREE.Group(), L = rnd(12, 16), D = rnd(11, 15), floors = Math.floor(rnd(9, 17)), kind = pick(['glass', 'glass', 'green', 'gold']), acc = pick(ACCENT)
  const pod = 4.4, H = floors * 3.4, fx = D / 2
  g.add(M(box(D, pod, L), faces(lamMap(shopfront()), lam('#E9E4DA'), roofMat()), 0, pod / 2, 0))
  g.add(M(box(D + .4, .4, L + .4), lam(acc), 0, pod + .2, 0))
  const ft = facade(kind)
  if (Math.random() < .3) {
    const r = Math.min(L, D) / 2 - .8
    g.add(M(new THREE.CylinderGeometry(r, r, H, 28), lamMap(rep(ft, 2 * Math.PI * r / 2.8 / 4, floors / 4)), 0, pod + H / 2, 0))
    g.add(M(new THREE.CylinderGeometry(r * 1.15, r * 1.15, .7, 28), lam(acc), 0, pod + H + .35, 0))
  } else {
    const tl = L - 1.6, td = D - 1.6
    g.add(M(box(td, H, tl), faces(lamMap(rep(ft, tl / 2.8 / 4, floors / 4)), lamMap(rep(ft, td / 2.8 / 4, floors / 4)), roofMat()), 0, pod + H / 2, 0))
    g.add(M(box(td * .7, 2.6, tl * .7), lam(acc), 0, pod + H + 1.3, 0))
  }
  const nm = new THREE.Mesh(new THREE.PlaneGeometry(L * .8, L * .8 / 4.2), lamMap(signTex(pick(TOWER_NAMES), acc)))
  nm.position.set(fx + .06, pod - .9, 0); nm.rotation.y = Math.PI / 2; g.add(nm)
  g.add(M(new THREE.CylinderGeometry(.08, .12, 6, 6), lam('#C9C2D6'), 0, pod + H + 5, 0))
  g.add(M(new THREE.SphereGeometry(.18, 8, 6), lam('#FF3B3B', { emissive: '#FF2020', emissiveIntensity: 2.5 }), 0, pod + H + 8.1, 0, false))
  g.userData = { L, D, H: pod + H }
  return g
}
export function makeCafe () {
  const g = new THREE.Group(), L = rnd(10, 13), D = rnd(7, 9), acc = pick(ACCENT), fx = D / 2
  g.add(M(box(D, 3.8, L), faces(lamMap(shopfront()), lam(pick(WALL)), roofMat()), 0, 1.9, 0))
  g.add(M(box(D + .4, .5, L + .4), lam(acc), 0, 4.05, 0))
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(L * .7, L * .7 / 4.2), lamMap(signTex(pick(CAFES), acc)))
  sg.position.set(fx + .27, 3.2, 0); sg.rotation.y = Math.PI / 2; g.add(sg)
  for (let i = 0; i < 3; i++) {
    const z = -L / 2 + 2 + i * (L - 4) / 2, x = fx + 1.5
    g.add(M(new THREE.CylinderGeometry(.04, .04, 2.4, 6), lam(C.chrome), x, 1.2, z))
    g.add(M(new THREE.ConeGeometry(1.15, .55, 8), lam(pick(ACCENT)), x, 2.5, z))
    g.add(M(new THREE.CylinderGeometry(.42, .42, .06, 12), lam(C.paper), x, .95, z))
    for (const dz of [-.65, .65]) g.add(M(box(.36, .5, .36), lam(C.ink), x, .45, z + dz))
  }
  g.userData = { L, D, H: 4.3, deck: 2.6 }
  return g
}
export function makePark () {
  const g = new THREE.Group(), L = rnd(12, 16), D = 8
  g.add(M(new THREE.PlaneGeometry(D, L).rotateX(-Math.PI / 2), lam('#5DB043'), 0, .22, 0, false))
  g.add(M(box(.6, .6, L), lam('#2E9E5B', { wind: 1 }), D / 2 - .3, .5, 0))
  for (let i = 0; i < 2; i++) { const t = makeJacaranda(); t.position.set(rnd(-1, 1), .2, -L / 4 + i * L / 2); g.add(t) }
  g.add(M(box(.5, .45, 1.8), lam('#8B5A3C'), 1.2, .45, 0))
  g.userData = { L, D, H: 0, open: true }
  return g
}
export function makeJacaranda () {
  const g = new THREE.Group()
  g.add(M(GEO.trunk, lam('#6B4A36'), 0, 1.3, 0))
  const cols = ['#9B6FE8', '#A884F2', '#8455DB', '#C3A6FA', '#B28EF0']
  for (let i = 0; i < 6; i++) { const c = M(GEO.crown, lam(cols[i % 5], { wind: 1 }), rnd(-1.1, 1.1), rnd(2.8, 3.8), rnd(-1.1, 1.1)); c.scale.set(rnd(1, 1.5), rnd(.7, 1), rnd(1, 1.5)); g.add(c) }
  g.add(M(new THREE.CircleGeometry(1.8, 14).rotateX(-Math.PI / 2), lam('#C9AEF5'), 0, .025, 0, false))
  return g
}
export function makePalm () {
  const g = new THREE.Group(), bend = rnd(-.12, .12)
  for (let i = 0; i < 6; i++) { const seg = M(new THREE.CylinderGeometry(.16 - i * .012, .19 - i * .012, .95, 8), lam(i % 2 ? '#8A6A4A' : '#7A5C3F'), Math.sin(bend * i) * i * .15, .45 + i * .9, 0); seg.rotation.z = -bend * i * .3; g.add(seg) }
  const top = new THREE.Vector3(Math.sin(bend * 5) * .75, 5.4, 0)
  for (let i = 0; i < 8; i++) {
    const fr = new THREE.Group(); fr.position.copy(top); fr.rotation.y = i * Math.PI / 4 + rnd(-.2, .2); g.add(fr)
    const leaf = M(box(.42, .05, 2.4), lam(i % 2 ? '#2FA84F' : '#3DBE5C', { wind: 1 }), 0, -.35, 1.1); leaf.rotation.x = .45; fr.add(leaf)
  }
  for (let i = 0; i < 3; i++) g.add(M(new THREE.SphereGeometry(.14, 8, 6), lam('#6B4A2A'), top.x + Math.cos(i * 2) * .2, 5.2, Math.sin(i * 2) * .2))
  return g
}
export function makeFlame () {
  const g = new THREE.Group()
  g.add(M(GEO.trunk, lam('#6B4A36'), 0, 1.3, 0))
  for (let i = 0; i < 5; i++) { const c = M(GEO.crown, lam(i < 2 ? '#3E9E4A' : pick(['#FF5A1F', '#FF7A1A', '#F2442C']), { wind: 1 }), rnd(-1, 1), rnd(2.7, 3.6), rnd(-1, 1)); c.scale.set(rnd(1, 1.4), rnd(.6, .9), rnd(1, 1.4)); g.add(c) }
  return g
}
export function makeBougainvillea () {
  const g = new THREE.Group()
  for (let i = 0; i < 5; i++) { const c = M(GEO.crownLo, lam(i < 2 ? '#2E9E5B' : pick(['#E0218A', '#FF4FA8', '#C2185B']), { wind: 3 }), rnd(-.6, .6), rnd(.35, .8), rnd(-.9, .9)); c.scale.setScalar(rnd(.4, .6)); g.add(c) }
  return g
}
// Street light whose arm reaches toward +x.
export function makeLamp () {
  const g = new THREE.Group(), grey = lam('#5E5A70')
  const p = M(GEO.pole, grey, 0, 3, 0); p.scale.set(1, 6, 1); g.add(p)
  g.add(M(box(1.5, .08, .1), grey, .75, 5.95, 0))
  g.add(M(box(.6, .12, .3), lam('#FFF6C8', { emissive: '#FFE27A', emissiveIntensity: 1.6 }), 1.45, 5.88, 0))
  g.add(M(box(.04, 1.1, .55), lam(pick(ACCENT)), -.12, 4.2, 0, false))
  g.add(M(box(.045, .25, .56), lam(C.paper), -.12, 4.7, 0, false))
  return g
}
// Matatu stage shelter, open toward +x.
export function makeStage (withPeople = true) {
  const g = new THREE.Group(), grey = lam('#5E5A70')
  for (const z of [-1.6, 1.6]) { const p = M(GEO.pole, grey, -.6, 1.3, z); p.scale.set(1, 2.6, 1); g.add(p) }
  const roof = M(box(1.8, .12, 4), lam(C.green), 0, 2.65, 0); roof.rotation.z = -.12; g.add(roof)
  g.add(M(box(.5, .12, 3), lam('#8B5A3C'), -.4, .65, 0))
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .5), lamMap(signTex('STAGE', C.green)))
  sg.position.set(.1, 2.25, 1.6); g.add(sg)
  if (withPeople) for (let i = 0; i < 2; i++) { const p = makePerson(); p.position.set(rnd(-.2, .4), 0, rnd(-1.2, 1.2)); p.rotation.y = -Math.PI / 2 + rnd(-.4, .4); g.add(p) }
  return g
}
export function makeTrafficLight () {
  const g = new THREE.Group()
  const p = M(GEO.pole, lam('#3A3448'), 0, 1.8, 0); p.scale.set(1, 3.6, 1); g.add(p)
  g.add(M(box(.36, 1, .32), lam(C.ink), 0, 3.9, -.1))
  g.add(M(new THREE.SphereGeometry(.1, 10, 8), lam('#5A1A1A'), 0, 4.2, -.27, false))
  g.add(M(new THREE.SphereGeometry(.1, 10, 8), lam('#5A4A1A'), 0, 3.9, -.27, false))
  g.add(M(new THREE.SphereGeometry(.1, 10, 8), lam('#3DFF7A', { emissive: '#3DFF7A', emissiveIntensity: 2.5 }), 0, 3.6, -.27, false))
  return g
}
export function makeFarTower () {
  const ft = facade(pick(['glass', 'green', 'gold'])), h = rnd(28, 60), w = rnd(10, 16)
  const m = M(box(w, h, w), lamMap(rep(ft, w / 2.8 / 4, h / 3.4 / 4)), 0, h / 2, 0, false)
  return m
}

// ------------------------------------------------------------------ grass tufts (one instanced mesh per patch, swaying in the wind)
const bladeGeo = (() => { const g = new THREE.ConeGeometry(.035, .32, 3); g.translate(0, .16, 0); return g })()
export function makeGrass (count, sizeX, sizeZ, color = '#4FAE3A') {
  const mesh = new THREE.InstancedMesh(bladeGeo, lam(color, { wind: 6 }), count)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler()
  for (let i = 0; i < count; i++) {
    p.set(rnd(-sizeX / 2, sizeX / 2), 0, rnd(-sizeZ / 2, sizeZ / 2))
    e.set(rnd(-.3, .3), rnd(0, 6.28), rnd(-.3, .3)); q.setFromEuler(e)
    const k = rnd(.6, 1.2); s.set(k, k * rnd(.7, 1.3), k)
    mesh.setMatrixAt(i, m.compose(p, q, s))
  }
  mesh.receiveShadow = true
  mesh.userData.keep = true
  return mesh
}

export { specks }
