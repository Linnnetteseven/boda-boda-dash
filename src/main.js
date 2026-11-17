// Boda Boda Dash: boot, input, the mode/state machine and the frame loop.
import * as THREE from 'three'
import { renderer, scene, camera, composer, resize as resizeRender, windTime, canvasTex, M, lam, HORIZON } from './render.js'
import { buildIcons, GEO } from './models.js'
import { initPhysics, stepPhysics } from './physics.js'
import { rider, buildRider } from './rider.js'
import { game, resetRun, updateHud, updateStreak, tickPowerups, finishRun, menuBestText, activate } from './game.js'
import { runner } from './runner.js'
import { roam } from './roam.js'
import { updateFx, clearFx } from './fx3d.js'
import { AU, audioInit, audioFrame, sfx, setSound, setMusicContext } from './audio.js'
import { $, setScreen, buildPowerupUI, setupTouch, resizeFx, renderFx, burstConfetti, clearConfetti, toast, controls, showTouchLayout, setTouchActions, flashZone, setupControlsPanel } from './ui.js'
import { clamp, damp, rnd, isTouch, reduceMotion } from './util.js'

const modes = { runner, roam }
let current = runner
let camBlend = 0, portrait = 0
const keys = { left: false, right: false, up: false, down: false, boost: false }

// ------------------------------------------------------------------ sky: gradient, painted skyline, clouds
let backdrop, clouds
function buildSky () {
  scene.background = canvasTex(4, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h)
    gr.addColorStop(0, '#1FB5EC'); gr.addColorStop(.45, '#8EE0FF'); gr.addColorStop(.62, HORIZON); gr.addColorStop(1, HORIZON)
    g.fillStyle = gr; g.fillRect(0, 0, w, h)
  })
  const sky = canvasTex(2048, 1024, (g, w, h) => {
    const base = h * .8, gr = g.createLinearGradient(0, 0, 0, base)
    gr.addColorStop(0, '#1FB5EC'); gr.addColorStop(.55, '#8EE0FF'); gr.addColorStop(1, HORIZON); g.fillStyle = gr; g.fillRect(0, 0, w, h)
    const sg = g.createRadialGradient(w * .66, base - 130, 8, w * .66, base - 130, 330)
    sg.addColorStop(0, 'rgba(255,250,220,1)'); sg.addColorStop(.18, 'rgba(255,240,190,.9)'); sg.addColorStop(1, 'rgba(255,226,194,0)')
    g.fillStyle = sg; g.fillRect(0, 0, w, h)
    g.fillStyle = 'rgba(132,176,160,.7)'; g.beginPath(); g.moveTo(0, base)
    for (let x = 0; x <= w; x += 32) g.lineTo(x, base - 40 - Math.sin(x / 190) * 22 - (x < w * .32 ? Math.sin(x / (w * .32) * Math.PI) * 90 : 0) - Math.sin(x / 47) * 6)
    g.lineTo(w, base + 20); g.lineTo(0, base + 20); g.fill()
    const tower = (x, bw, bh, col, kind) => {
      g.fillStyle = col
      if (kind === 'prism') { g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - bh * .8); g.lineTo(x + bw * .5, base - bh); g.lineTo(x + bw, base - bh * .8); g.lineTo(x + bw, base); g.fill() }
      else if (kind === 'saucer') { g.fillRect(x, base - bh, bw, bh); g.beginPath(); g.ellipse(x + bw / 2, base - bh, bw * 1.1, bw * .28, 0, 0, 7); g.fill(); g.fillRect(x + bw / 2 - 3, base - bh - 50, 6, 50) }
      else g.fillRect(x, base - bh, bw, bh)
      g.fillStyle = 'rgba(255,255,255,.28)'
      for (let y = base - bh * .78; y < base - 12; y += 14) for (let wx = x + 5; wx < x + bw - 6; wx += 12) if (Math.random() < .55) g.fillRect(wx, y, 6, 7)
    }
    let x = w * .18
    while (x < w * .92) { const mid = 1 - Math.abs(x - w * .55) / (w * .45), bw = rnd(36, 90), bh = rnd(70, 170) + mid * rnd(60, 220); tower(x, bw, bh, ['#9DB6E8', '#8FA5DD', '#B2C4EE', '#A595DB', '#86B4D8'][Math.floor(Math.random() * 5)], Math.random() < .12 ? 'prism' : 'box'); x += bw + rnd(4, 22) }
    tower(w * .47, 46, 330, '#7F8FCF', 'saucer'); tower(w * .58, 70, 380, '#6F86C8', 'prism'); tower(w * .62, 40, 300, '#7A98D2', 'box')
    const hz = g.createLinearGradient(0, base - 120, 0, base); hz.addColorStop(0, 'rgba(255,226,194,0)'); hz.addColorStop(1, HORIZON); g.fillStyle = hz; g.fillRect(0, base - 120, w, 120)
    g.fillStyle = HORIZON; g.fillRect(0, base, w, h - base)
  })
  backdrop = new THREE.Mesh(new THREE.PlaneGeometry(900, 450), new THREE.MeshBasicMaterial({ map: sky, fog: false, depthTest: false, depthWrite: false }))
  backdrop.renderOrder = -10; backdrop.frustumCulled = false; scene.add(backdrop)
  clouds = new THREE.Group(); scene.add(clouds)
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group()
    for (let j = 0; j < 5; j++) { const s = M(GEO.crownLo, lam('#FFFFFF', { fog: false, emissive: '#C9D8FF', emissiveIntensity: .35 }), j * 5 - 10 + rnd(-2, 2), rnd(-1, 2), rnd(-2, 2), false); s.scale.set(rnd(4, 7), rnd(2.4, 3.8), rnd(3, 5)); c.add(s) }
    c.position.set(rnd(-140, 140), rnd(48, 75), rnd(-150, -120)); c.userData.v = rnd(.5, 1.5); clouds.add(c)
  }
}
const _dir = new THREE.Vector3()
function placeSky (dt) {
  camera.getWorldDirection(_dir); _dir.y = 0; _dir.normalize()
  const dist = camera.far - 12
  backdrop.position.copy(camera.position).addScaledVector(_dir, dist); backdrop.position.y = 135
  backdrop.lookAt(camera.position.x, 135, camera.position.z)
  clouds.position.set(camera.position.x, 0, camera.position.z)
  clouds.rotation.y = Math.atan2(-_dir.x, -_dir.z)
  for (const c of clouds.children) { c.position.x += c.userData.v * dt; if (c.position.x > 160) c.position.x = -160 }
}

// ------------------------------------------------------------------ resizing
function resize () {
  resizeRender(); resizeFx()
  portrait = clamp((1.1 - innerWidth / innerHeight) / .6, 0, 1)
}

// ------------------------------------------------------------------ flow
async function switchMode (name) {
  if (current === modes[name]) return
  $('loading').classList.remove('done')
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  current.exit(); clearFx()
  current = modes[name]
  current.enter()
  $('loading').classList.add('done')
}
async function startGame (name) {
  if (game.state === 'loading') return
  audioInit()
  await switchMode(name)
  if (name === 'runner' && game.mode === 'runner' && game.state !== 'menu') runner.restart()
  if (name === 'roam' && (game.state === 'over' || game.state === 'paused')) roam.enter()
  clearFx(); clearConfetti()
  game.mode = name; game.state = 'play'; roam.timeUp = false
  resetRun()
  $('lvl').textContent = name === 'runner' ? 'Speed 1' : '3:00'
  $('menuCard').classList.remove('howing')
  setScreen(null)
  showTouchLayout(name, isTouch)
  sfx('start')
  if (name === 'roam') toast('Free ride', !isTouch ? 'W A S D to ride. Find a waving passenger.' : controls.roam === 'stick' ? 'Steer with the stick. Find a waving passenger.' : 'Steer with ◀ ▶, ride with ▲. Find a waving passenger.')
}
async function toMenu () {
  game.state = 'menu'; game.mode = null
  for (const k in game.pu) game.pu[k] = 0
  showTouchLayout(null, isTouch)
  if (current !== runner) await switchMode('runner')
  else runner.restart()
  clearFx()
  setScreen('menu'); $('menuBest').textContent = menuBestText()
  setTimeout(() => $('runnerBtn').focus({ preventScroll: true }), 60)
}
function pause () {
  if (game.state !== 'play') return
  game.state = 'paused'
  $('pauseText').textContent = game.money ? `Your Ksh ${game.money.toLocaleString('en-KE')} is safe.` : 'Take a breather.'
  setScreen('paused'); setTimeout(() => $('resumeBtn').focus({ preventScroll: true }), 50)
}
let ctrlReturn = 'menu'
function openControls () {
  ctrlReturn = ['menu', 'paused', 'over'].find(id => !$(id).classList.contains('hidden')) || 'menu'
  setScreen('controls'); setTimeout(() => $('ctrlBack').focus({ preventScroll: true }), 50)
}
function closeControls () { setScreen(ctrlReturn); if (ctrlReturn === 'menu') $('menuBest').textContent = menuBestText() }
function updateHowTexts () {
  if (!isTouch) return
  const r = { swipe: 'Swipe left or right to change lane, swipe up to hop.', tap: 'Tap the left or right side to change lane, swipe up to hop.', buttons: 'Use the ◀ ▶ buttons to change lane and the hop button to jump.' }[controls.runner]
  $('howRunner').textContent = r + ' Potholes and matatus end your ride. Passengers pay Ksh 50, coins Ksh 10.'
  const f = controls.roam === 'stick' ? 'Steer and ride with the stick, hold Boost to go faster, tap Hop to jump.' : 'Steer with ◀ ▶, ride with ▲ and brake with ▼. Hold Boost to go faster, tap Hop to jump.'
  $('howRoam').textContent = f + ' Pick up a waving passenger at a stage, then ride to the green beam to drop them off. Faster drops pay a tip.'
}
function resume () { if (game.state !== 'paused') return; game.state = 'play'; setScreen(null) }
function endRun (title, reason) {
  const record = finishRun(title, reason)
  setScreen('over'); showTouchLayout(null, isTouch)
  if (record) { burstConfetti(); sfx('record') }
  setTimeout(() => $('againBtn').focus({ preventScroll: true }), 350)
}

// ------------------------------------------------------------------ input
addEventListener('keydown', e => {
  const k = e.key
  if (e.target.tagName === 'BUTTON' && (k === 'Enter' || k === ' ')) return
  const play = game.state === 'play'
  if (['ArrowLeft', 'a', 'A'].includes(k)) { e.preventDefault(); keys.left = true; if (!e.repeat && game.mode === 'runner') runner.steer(-1) }
  else if (['ArrowRight', 'd', 'D'].includes(k)) { e.preventDefault(); keys.right = true; if (!e.repeat && game.mode === 'runner') runner.steer(1) }
  else if (['ArrowUp', 'w', 'W'].includes(k)) { e.preventDefault(); keys.up = true; if (!e.repeat && game.mode === 'runner') runner.hop() }
  else if (['ArrowDown', 's', 'S'].includes(k)) { e.preventDefault(); keys.down = true }
  else if (k === 'Shift') keys.boost = true
  else if (k === ' ') { e.preventDefault(); if (play && !e.repeat) current.hop(); else if (game.state === 'menu') startGame('runner'); else if (game.state === 'over') startGame(game.mode) }
  else if (k === 'Enter') { if (game.state === 'menu') startGame('runner'); else if (game.state === 'over') startGame(game.mode) }
  else if (k === 'Escape' && !$('controls').classList.contains('hidden')) { e.preventDefault(); closeControls() }
  else if (['p', 'P', 'Escape'].includes(k)) { e.preventDefault(); game.state === 'paused' ? resume() : pause() }
  else if ((k === 'r' || k === 'R') && play && game.mode === 'roam') roam.reset()
})
addEventListener('keyup', e => {
  const k = e.key
  if (['ArrowLeft', 'a', 'A'].includes(k)) keys.left = false
  else if (['ArrowRight', 'd', 'D'].includes(k)) keys.right = false
  else if (['ArrowUp', 'w', 'W'].includes(k)) keys.up = false
  else if (['ArrowDown', 's', 'S'].includes(k)) keys.down = false
  else if (k === 'Shift') keys.boost = false
})
// Runner on a phone. Swipe: left/right changes lane, up hops. Tap sides: tap a half to change lane, swipe up hops.
// Arrow buttons: handled by the on-screen pad, so the canvas ignores touches.
const swipe = new Map()
const runnerTouch = () => game.state === 'play' && game.mode === 'runner' && controls.runner !== 'buttons'
$('game').addEventListener('pointerdown', e => { if (runnerTouch()) { swipe.set(e.pointerId, { x: e.clientX, y: e.clientY, done: false }); e.preventDefault() } })
$('game').addEventListener('pointermove', e => {
  const s = swipe.get(e.pointerId); if (!s || s.done) return
  const dx = e.clientX - s.x, dy = e.clientY - s.y
  if (-dy > 36 && -dy > Math.abs(dx)) { s.done = true; runner.hop() }
  else if (controls.runner === 'swipe' && Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) { s.done = true; runner.steer(Math.sign(dx)) }
})
$('game').addEventListener('pointerup', e => {
  const s = swipe.get(e.pointerId); swipe.delete(e.pointerId)
  if (s && !s.done && controls.runner === 'tap') { const side = e.clientX < innerWidth / 2 ? -1 : 1; flashZone(side); runner.steer(side) }
})
$('game').addEventListener('pointercancel', e => swipe.delete(e.pointerId))
$('game').addEventListener('contextmenu', e => e.preventDefault())
addEventListener('pointerdown', () => audioInit(), { once: true }); addEventListener('keydown', () => audioInit(), { once: true })
const on = (id, fn) => $(id).addEventListener('click', () => { audioInit(); sfx('click'); fn() })
on('runnerBtn', () => startGame('runner')); on('roamBtn', () => startGame('roam'))
on('againBtn', () => startGame(game.mode || 'runner')); on('resumeBtn', resume); on('pauseBtn', pause)
on('restartBtn', () => { game.state = 'over'; startGame(game.mode) })
on('endBtn', () => { if (game.state === 'paused') endRun(game.mode === 'runner' ? 'Parked' : 'Shift over', 'You parked the boda.') })
on('pMenuBtn', toMenu); on('oMenuBtn', toMenu)
on('howBtn', () => { $('menuCard').classList.add('howing'); $('howBack').focus({ preventScroll: true }) })
on('howBack', () => { $('menuCard').classList.remove('howing'); $('howBtn').focus({ preventScroll: true }) })
document.querySelectorAll('.ctrlBtn').forEach(b => b.addEventListener('click', () => { audioInit(); sfx('click'); openControls() }))
on('ctrlBack', closeControls)
document.querySelectorAll('.snd').forEach(b => b.addEventListener('click', () => { audioInit(); setSound(b.dataset.k, !AU.on[b.dataset.k]); sfx('click') }))
addEventListener('resize', resize)
document.addEventListener('visibilitychange', () => { if (document.hidden) pause() })
addEventListener('blur', pause)

// ------------------------------------------------------------------ frame loop
const clock = new THREE.Clock()
function frame () {
  const dt = Math.min(.05, clock.getDelta())
  game.time += dt; windTime.value += dt
  const st = game.state
  camBlend = damp(camBlend, st === 'menu' ? 0 : 1, st === 'menu' ? 1.5 : 2.4, dt)
  if (st !== 'paused' && st !== 'loading') {
    stepPhysics(dt, d => current.control(d, keys))
    current.update(dt)
    tickPowerups(dt)
    updateFx(dt)
    if (st === 'crash' && runner.crashTime() > 1.3) endRun('Umegonga!', runner.crashReason())
    if (st === 'play' && game.mode === 'roam' && roam.timeUp) { roam.timeUp = false; endRun('Shift over', `Three minutes on the road. You dropped off ${game.drops} passenger${game.drops === 1 ? '' : 's'}.`) }
  }
  if (st !== 'loading') {
    const fov = current.camera(dt, camBlend, portrait)
    camera.fov = damp(camera.fov, fov, 4, dt)
    const W = innerWidth, H = innerHeight, off = 1 - Math.min(1, camBlend * 1.02)
    if (off > .002) camera.setViewOffset(W, H, -W * .17 * (1 - portrait) * off, H * .13 * portrait * off, W, H); else camera.clearViewOffset()
    camera.far = current === roam ? 230 : 175
    camera.updateProjectionMatrix()
    placeSky(dt)
    audioFrame(dt, rider.v ? rider.v.speed : 0, st === 'play', st === 'menu', game.pu.nitro > 0)
    composer.render()
  }
  renderFx(dt)
}

// ------------------------------------------------------------------ boot
setMusicContext(() => ({ drive: game.state === 'play' || game.state === 'crash', level: game.mode === 'roam' ? 2 : game.level, nitro: game.pu.nitro > 0, paused: game.state === 'paused' }))
setSound('music', AU.on.music); setSound('sfx', AU.on.sfx)
async function boot () {
  try {
    await Promise.race([document.fonts ? Promise.all([document.fonts.load('40px Bungee'), document.fonts.load('700 20px "Baloo 2"')]) : 0, new Promise(r => setTimeout(r, 2500))])
  } catch (e) {}
  buildIcons(); buildPowerupUI(); setupTouch()
  setTouchActions({ left: () => runner.steer(-1), right: () => runner.steer(1), hop: () => current.hop() })
  setupControlsPanel(() => { updateHowTexts(); if (game.mode && game.state !== 'over') showTouchLayout(game.mode, isTouch) })
  if (!isTouch) $('ctrlNote').textContent = 'The touch options apply when you play on a phone or tablet.'
  updateHowTexts()
  resize()
  await initPhysics()
  buildSky(); buildRider()
  runner.enter()
  game.state = 'menu'
  $('menuBest').textContent = menuBestText()
  $('runnerBtn').disabled = false; $('roamBtn').disabled = false
  $('loading').classList.add('done')
  $('runnerBtn').focus({ preventScroll: true })
  renderer.setAnimationLoop(frame)
  if (location.hash === '#debug') window.__bbd = { game, rider, runner, roam, startGame, toMenu, activate }
}
boot().catch(e => { console.error(e); $('loading').querySelector('span').textContent = 'This browser could not start the game.' })
