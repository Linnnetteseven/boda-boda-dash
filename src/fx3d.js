// 3D effects: particle bursts, ring pulses, Nganya Mode light trails and speed lines, and screen-space fare text.
import * as THREE from 'three'
import { scene, camera, lam, glow, M, box } from './render.js'
import { GEO } from './models.js'
import { rnd, pick, C, reduceMotion } from './util.js'
import { floatAt } from './ui.js'

let parts = [], trails = [], lines = []
const trailGeo = new THREE.PlaneGeometry(.55, 1), lineGeo = box(.04, .04, 4)
const _v = new THREE.Vector3()

export function burst (pos, n, cols, power = 6, size = 1) {
  if (reduceMotion) n = Math.ceil(n / 3)
  for (let i = 0; i < n; i++) {
    const m = M(GEO.part, lam(pick(cols)), pos.x, pos.y, pos.z, false); m.scale.setScalar(size)
    m.userData = { v: new THREE.Vector3(rnd(-power, power) * .6, rnd(power * .4, power * 1.2), rnd(-power, power) * .6), life: rnd(.5, 1), max: 1, s: size }
    scene.add(m); parts.push(m)
  }
}
export function ringPulse (pos, color, grow = 8) {
  const m = M(GEO.ring, glow(color, .9).clone(), pos.x, pos.y + .1, pos.z, false)
  m.userData = { life: .7, max: .7, grow, ring: true }; scene.add(m); trails.push(m)
}
// Light ribbons dropped behind the rear wheel during Nganya Mode. `back` is a world-space point.
export function dropTrail (back, quat) {
  for (let i = 0; i < 2; i++) {
    const m = M(trailGeo, glow(i ? C.magenta : C.cyan, .8), back.x, back.y, back.z, false)
    m.quaternion.copy(quat); m.translateX(i ? .12 : -.12)
    m.userData = { life: .45, max: .45 }; scene.add(m); trails.push(m)
  }
}
export function speedLines (origin, dir, speed) {
  if (reduceMotion) return
  for (let i = 0; i < 2; i++) {
    const side = pick([-1, 1]), off = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(side * rnd(3, 9))
    const m = M(lineGeo, glow(C.paper, .55), 0, 0, 0, false)
    m.position.copy(origin).addScaledVector(dir, rnd(25, 45)).add(off); m.position.y = rnd(.5, 5)
    m.lookAt(m.position.clone().add(dir))
    m.userData = { v: dir.clone().multiplyScalar(-speed * 1.6), life: 1.2 }
    scene.add(m); lines.push(m)
  }
}
export function floatText (pos, text, color) {
  _v.copy(pos).project(camera)
  floatAt((_v.x * .5 + .5) * innerWidth, (-_v.y * .5 + .5) * innerHeight, text, color)
}
export function updateFx (dt) {
  for (const p of parts) {
    const u = p.userData; u.life -= dt; u.v.y -= 18 * dt; p.position.addScaledVector(u.v, dt); p.rotation.x += dt * 6
    p.scale.setScalar(Math.max(.01, u.life / u.max) * u.s)
    if (p.position.y < .07) { p.position.y = .07; u.v.y *= -.3; u.v.x *= .7; u.v.z *= .7 }
  }
  parts = parts.filter(p => { if (p.userData.life <= 0) { scene.remove(p); return false } return true })
  for (const m of trails) {
    const u = m.userData; u.life -= dt; const k = Math.max(0, u.life / u.max)
    if (u.ring) { const s = 1 + (1 - k) * u.grow; m.scale.set(s, 1, s); m.material.opacity = k * .9 } else m.scale.set(k, 1 + (1 - k) * 2, 1)
  }
  trails = trails.filter(m => { if (m.userData.life <= 0) { scene.remove(m); if (m.userData.ring) m.material.dispose(); return false } return true })
  for (const m of lines) { m.position.addScaledVector(m.userData.v, dt); m.userData.life -= dt }
  lines = lines.filter(m => { if (m.userData.life <= 0) { scene.remove(m); return false } return true })
}
export function clearFx () {
  for (const m of parts.concat(trails, lines)) scene.remove(m)
  parts = []; trails = []; lines = []
}
