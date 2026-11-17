// Shared game state: money, power-ups, streaks, HUD updates. Both modes use these.
import * as THREE from 'three'
import { $, toast, bump, updateChips } from './ui.js'
import { PUPS } from './models.js'
import { sfx } from './audio.js'
import { burst, ringPulse, floatText } from './fx3d.js'
import { ksh, save, C } from './util.js'
import { rider } from './rider.js'

export const game = {
  mode: null,          // 'runner' | 'roam'
  state: 'loading',    // loading | menu | play | paused | crash | over
  money: 0, t: 0, level: 1, time: 0,
  streak: 0, pax: 0, coins: 0, drops: 0,
  best: { runner: save.get('best', 0), roam: save.get('bestRoam', 0) },
  pu: { nitro: 0, shield: 0, magnet: 0, double: 0 },
  grace: 0,
  onWhistle: null       // set by the active mode
}
try { game.best.runner = Math.max(game.best.runner, +localStorage.getItem('bodaDashBest') || 0) } catch (e) {}

export function resetRun () {
  Object.assign(game, { money: 0, t: 0, level: 1, streak: 0, pax: 0, coins: 0, drops: 0, grace: 0 })
  for (const k in game.pu) game.pu[k] = 0
  updateHud(); updateStreak()
}
export function updateHud () { $('money').textContent = ksh(game.money) }
export function updateStreak () { [...$('streak').querySelectorAll('u')].forEach((u, i) => u.classList.toggle('on', i < game.streak)) }

const _p = new THREE.Vector3()
export function earn (amount, pos, label) {
  const k = game.pu.double > 0 ? 2 : 1
  game.money += amount * k
  updateHud(); bump()
  if (pos && label !== false) floatText(_p.copy(pos).setY(pos.y + .4), label || `+Ksh ${amount * k}`)
  return amount * k
}
export function activate (type, why) {
  const p = PUPS[type], pos = rider.model.root.position
  sfx('pickup'); ringPulse(pos, p.color, 6); burst(_p.copy(pos).setY(1.4), 18, [p.color, C.paper, C.yellow], 6)
  if (type === 'whistle') { sfx('whistle'); ringPulse(pos, C.yellow, 30); game.onWhistle && game.onWhistle(); setTimeout(() => sfx('honk'), 350) }
  else { game.pu[type] = p.dur; sfx(type) }
  toast(p.name + '!', why || p.what)
}
export function tickPowerups (dt) {
  for (const k in game.pu) if (game.pu[k] > 0) { game.pu[k] = Math.max(0, game.pu[k] - dt); if (game.pu[k] === 0 && k === 'nitro') game.grace = 1.2 }
  game.grace = Math.max(0, game.grace - dt)
  const fx = rider.model.fx, show = game.state === 'play' || game.state === 'paused'
  fx.shield.visible = game.pu.shield > 0
  if (fx.shield.visible) {
    fx.shield.rotation.y += dt * 1.2
    for (const c of fx.shield.children) if (c.userData.a !== undefined) { const a = c.userData.a + game.time * 3; c.position.set(Math.cos(a) * 1.25, Math.sin(game.time * 2 + c.userData.a) * .3, Math.sin(a) * 1.25); c.rotation.set(game.time * 2, a, .4) }
  }
  fx.magnet.visible = game.pu.magnet > 0
  if (fx.magnet.visible) { fx.magnet.rotation.y += dt * 4; const s = 1 + Math.sin(game.time * 8) * .08; fx.magnet.scale.set(s, 1, s) }
  fx.underglow.material.opacity += ((game.pu.nitro > 0 ? .85 : 0) - fx.underglow.material.opacity) * Math.min(1, dt * 6)
  updateChips(game.pu, show)
}
export function finishRun (title, reason) {
  game.state = 'over'
  const key = game.mode, record = game.money > game.best[key]
  if (record) { game.best[key] = game.money; save.set(key === 'runner' ? 'best' : 'bestRoam', game.money) }
  $('overTitle').textContent = title
  $('reason').textContent = reason
  $('final').textContent = ksh(game.money)
  const stats = game.mode === 'runner'
    ? `${game.pax} passenger${game.pax === 1 ? '' : 's'}, ${game.coins} coin${game.coins === 1 ? '' : 's'}`
    : `${game.drops} drop-off${game.drops === 1 ? '' : 's'}, ${game.coins} coin${game.coins === 1 ? '' : 's'}`
  $('bestline').textContent = (record ? 'Your new best.' : `Best: Ksh ${ksh(game.best[key])}.`) + '\n' + stats + '.'
  $('record').classList.toggle('on', record)
  return record
}
export function menuBestText () {
  const b = game.best
  if (!b.runner && !b.roam) return 'No rides yet. Your best fares show here.'
  return `Runner best: Ksh ${ksh(b.runner)}\nFree ride best: Ksh ${ksh(b.roam)}`
}
