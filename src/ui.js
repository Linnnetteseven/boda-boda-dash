// DOM overlays: screens, HUD, toasts, floating fare text, confetti and the touch joystick.
import { C, rnd, pick, clamp, reduceMotion } from './util.js'
import { PUPS, ICON_URL } from './models.js'

export const $ = id => document.getElementById(id)

export function setScreen (id) {
  for (const s of ['menu', 'paused', 'over']) $(s).classList.toggle('hidden', s !== id)
  $('hud').classList.toggle('off', id !== null && id !== 'paused')
}
export function toast (text, sub) {
  const el = $('toast'); el.innerHTML = text + (sub ? `<small>${sub}</small>` : '')
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show')
}
export function bump () { const c = $('cash'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump') }
export function floatAt (x, y, text, color) {
  const el = document.createElement('div'); el.className = 'float'; el.textContent = text
  if (color) el.style.color = color
  el.style.left = `${x}px`; el.style.top = `${y}px`
  document.body.appendChild(el); setTimeout(() => el.remove(), 950)
}

export function buildPowerupUI () {
  for (const k of Object.keys(PUPS)) {
    const li = document.createElement('li')
    li.innerHTML = `<img alt="" src="${ICON_URL[k]}"><div><b>${PUPS[k].name}</b><span>${PUPS[k].what}</span></div>`
    $('pupList').appendChild(li)
    if (PUPS[k].dur) {
      const ch = document.createElement('div'); ch.className = 'chip'; ch.id = 'chip-' + k
      ch.innerHTML = `<img alt="${PUPS[k].name}" src="${ICON_URL[k]}"><i><b style="background:${PUPS[k].color}"></b></i>`
      $('chips').appendChild(ch)
    }
  }
}
export function updateChips (pu, show) {
  for (const k of ['nitro', 'shield', 'magnet', 'double']) {
    const el = $('chip-' + k); el.classList.toggle('on', show && pu[k] > 0)
    if (pu[k] > 0) el.querySelector('b').style.width = `${pu[k] / PUPS[k].dur * 100}%`
  }
  $('vig').classList.toggle('nitro', show && pu.nitro > 0)
  $('vig').classList.toggle('double', show && pu.double > 0 && pu.nitro <= 0)
  $('cash').classList.toggle('gold', pu.double > 0)
}

// ------------------------------------------------------------------ confetti on its own 2D canvas
const fx = $('fx'), fctx = fx.getContext('2d')
let confetti = []
export function resizeFx () {
  const w = innerWidth, h = innerHeight, r = Math.min(devicePixelRatio || 1, 2)
  fx.width = w * r; fx.height = h * r; fctx.setTransform(r, 0, 0, r, 0, 0)
}
export function burstConfetti () {
  const n = reduceMotion ? 40 : 200, W = innerWidth, H = innerHeight, cols = [C.magenta, C.yellow, C.cyan, C.green, C.lime, C.orange, C.purple]
  for (let i = 0; i < n; i++) {
    const L = i % 2 === 0
    confetti.push({ x: L ? -10 : W + 10, y: H * rnd(.55, .9), vx: (L ? 1 : -1) * rnd(250, 700), vy: rnd(-900, -400), w: rnd(6, 12), h: rnd(10, 18), rot: rnd(0, 6), vr: rnd(-10, 10), c: pick(cols), life: rnd(2.5, 4) })
  }
}
export function clearConfetti () { confetti = [] }
export function renderFx (dt) {
  fctx.clearRect(0, 0, innerWidth, innerHeight); if (!confetti.length) return
  for (const p of confetti) {
    p.vy += 900 * dt; p.vx *= Math.pow(.6, dt); p.vy *= Math.pow(.7, dt); p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt
    fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.rot); fctx.scale(1, Math.cos(p.rot * 1.7)); fctx.globalAlpha = clamp(p.life, 0, 1); fctx.fillStyle = p.c; fctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); fctx.restore()
  }
  confetti = confetti.filter(p => p.life > 0 && p.y < innerHeight + 40)
}

// ------------------------------------------------------------------ touch joystick (Free ride on phones)
export const stick = { x: 0, y: 0, active: false, hop: false, boost: false }
export function setupTouch () {
  const base = $('stick'), knob = $('knob')
  let id = null, cx = 0, cy = 0
  const R = 56
  const move = e => {
    const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy), k = d > R ? R / d : 1
    stick.x = clamp(dx * k / R, -1, 1); stick.y = clamp(-dy * k / R, -1, 1)
    knob.style.transform = `translate(${dx * k}px,${dy * k}px)`
  }
  base.addEventListener('pointerdown', e => {
    id = e.pointerId; const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2
    stick.active = true; base.setPointerCapture(id); move(e); e.preventDefault()
  })
  base.addEventListener('pointermove', e => { if (e.pointerId === id) move(e) })
  const end = e => { if (e.pointerId !== id) return; id = null; stick.active = false; stick.x = stick.y = 0; knob.style.transform = '' }
  base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end)
  for (const [btn, key] of [[$('hopBtn'), 'hop'], [$('boostBtn'), 'boost']]) {
    btn.addEventListener('pointerdown', e => { stick[key] = true; btn.classList.add('on'); btn.setPointerCapture(e.pointerId); e.preventDefault() })
    const up = () => { stick[key] = false; btn.classList.remove('on') }
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up)
  }
}
