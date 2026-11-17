// Synthesized audio: a benga-style music loop and every sound effect, built from oscillators and noise.
// No audio files are needed, so the game stays small and loads fast on a phone.
import { save } from './util.js'

export const AU = { ctx: null, on: { music: save.get('music', true), sfx: save.get('sfx', true) } }
// The game tells the music what is happening: { drive, level, nitro, mood }
let musicCtx = () => ({ drive: false, level: 0, nitro: false, mood: 'menu', paused: false })
export function setMusicContext (fn) { musicCtx = fn }

const mtof = m => 440 * Math.pow(2, (m - 69) / 12)
export function audioInit () {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return }
  let ctx
  try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch (e) { return }
  AU.ctx = ctx
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ctx.destination)
  AU.master = ctx.createGain(); AU.master.gain.value = .9; AU.master.connect(comp)
  AU.musicBus = ctx.createGain(); AU.musicBus.gain.value = AU.on.music ? .5 : 0
  AU.mf = ctx.createBiquadFilter(); AU.mf.type = 'lowpass'; AU.mf.frequency.value = 1500
  AU.musicBus.connect(AU.mf); AU.mf.connect(AU.master)
  AU.sfxBus = ctx.createGain(); AU.sfxBus.gain.value = AU.on.sfx ? .85 : 0; AU.sfxBus.connect(AU.master)
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), ch = buf.getChannelData(0)
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1
  AU.noise = buf
  // boda engine: sawtooth through a lowpass, chopped by a square LFO for the put-put sound
  const eo = ctx.createOscillator(); eo.type = 'sawtooth'; eo.frequency.value = 55
  const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 420; ef.Q.value = 2
  const am = ctx.createGain(); am.gain.value = .55
  const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 22
  const lg = ctx.createGain(); lg.gain.value = .45; lfo.connect(lg); lg.connect(am.gain)
  const eg = ctx.createGain(); eg.gain.value = 0
  eo.connect(ef); ef.connect(am); am.connect(eg); eg.connect(AU.sfxBus); eo.start(); lfo.start()
  AU.engine = { eo, ef, lfo, eg }
  AU.next = ctx.currentTime + .1; AU.step = 0
  setInterval(schedule, 25)
}
function env (g, t, peak, a, d) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d) }
function osc (type, f, t, dur, peak, dest, a = .005) {
  const c = AU.ctx, o = c.createOscillator(), g = c.createGain()
  o.type = type; o.frequency.setValueAtTime(f, t); env(g, t, peak, a, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + .05); return o
}
function noise (t, dur, peak, dest, ft, freq, q = 1) {
  const c = AU.ctx, s = c.createBufferSource(); s.buffer = AU.noise
  const f = c.createBiquadFilter(); f.type = ft; f.frequency.setValueAtTime(freq, t); f.Q.value = q
  const g = c.createGain(); env(g, t, peak, .002, dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * .5); s.stop(t + dur + .05); return f
}

// A bright benga-style loop in A minor: Am - F - C - G
const BPM = 118, ROOTS = [45, 41, 48, 43], TONES = [[69, 72, 76, 81], [65, 69, 72, 77], [67, 72, 76, 79], [67, 71, 74, 79]]
const LEAD = [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 1, 3, 2, 1, 0, 1], LEAD_ON = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1]
const BASS = [0, null, null, 0, null, null, 7, null, 12, null, 0, null, 10, null, 7, null]
function schedule () {
  const c = AU.ctx; if (!c) return
  const m = musicCtx()
  if (!AU.on.music || m.paused || document.hidden) { AU.next = c.currentTime + .05; return }
  while (AU.next < c.currentTime + .12) { playStep(AU.step, AU.next, m); AU.next += 60 / BPM / 4; AU.step = (AU.step + 1) % 64 }
}
function kick (t, v) { const o = osc('sine', 150, t, .28, .85 * v, AU.musicBus); o.frequency.exponentialRampToValueAtTime(42, t + .12) }
function playStep (s, t, m) {
  const mb = AU.musicBus, bar = (s >> 4) & 3, st = s & 15, drive = m.drive, lv = drive ? m.level : 0, nit = m.nitro
  if (drive) { if (st % 4 === 0) kick(t, 1) } else if (st === 0 || st === 10) kick(t, .55)
  if (drive && (st === 4 || st === 12)) { noise(t, .12, lv >= 2 ? .22 : .13, mb, 'bandpass', 1600, .8); noise(t + .012, .1, lv >= 2 ? .15 : .09, mb, 'bandpass', 1200, .8) }
  if (st % 2 === 1) noise(t, .04, drive ? .05 : .025, mb, 'highpass', 7000)
  if ((drive && lv >= 3) || nit) { if (st % 2 === 0) noise(t, .025, .035, mb, 'highpass', 9500) }
  if (nit && st % 4 === 2) noise(t, .08, .1, mb, 'bandpass', 2200, 1)
  if (BASS[st] !== null && (drive || st % 4 === 0)) { const f = mtof(ROOTS[bar] + BASS[st]); osc('triangle', f, t, .22, drive ? .2 : .12, mb); osc('square', f, t, .1, drive ? .05 : .03, mb) }
  if (LEAD_ON[st]) {
    const f = mtof(TONES[bar][LEAD[st]] + (nit ? 12 : 0)), v = (st % 4 === 0 ? .1 : .065) * (drive ? 1 : .8)
    osc('sine', f, t, .38, v, mb, .002); osc('sine', f * 2.01, t, .12, v * .35, mb, .002); osc('triangle', f * 3, t, .05, v * .12, mb, .001)
  }
  if (drive && lv >= 2 && st % 8 === 6) osc('sine', mtof(TONES[bar][3] + 12), t, .3, .04, mb, .002)
}

const SFX = {
  swish (n, b) { const f = noise(n, .16, .2, b, 'bandpass', 700, 2); f.frequency.exponentialRampToValueAtTime(2600, n + .15) },
  coin (n, b, p = 0) { const f = 1568 * Math.pow(2, p / 12); osc('square', f, n, .05, .045, b); osc('square', f * 1.335, n + .05, .14, .045, b) },
  fare (n, b) { osc('square', 1046, n, .05, .06, b); osc('square', 1318, n + .05, .05, .06, b); osc('sine', 2093, n + .1, .5, .12, b); noise(n + .1, .05, .1, b, 'highpass', 5000) },
  drop (n, b) { [784, 988, 1175, 1568].forEach((f, i) => osc('triangle', f, n + i * .07, .2, .1, b)); osc('sine', 2093, n + .3, .6, .1, b) },
  pickup (n, b) { [523, 659, 784, 1047, 1319].forEach((f, i) => osc('triangle', f, n + i * .045, .12, .09, b)); noise(n, .3, .05, b, 'highpass', 8000) },
  nitro (n, b) { const f = noise(n, .8, .28, b, 'lowpass', 300, 4); f.frequency.exponentialRampToValueAtTime(6000, n + .6); const o = osc('sawtooth', 90, n, .7, .07, b); o.frequency.exponentialRampToValueAtTime(420, n + .6) },
  shield (n, b) { const o = osc('sine', 300, n, .5, .14, b, .02); o.frequency.exponentialRampToValueAtTime(900, n + .4); osc('triangle', 1200, n + .2, .4, .05, b) },
  shieldBreak (n, b) { noise(n, .35, .3, b, 'highpass', 2500); [1200, 900, 700, 500].forEach((f, i) => osc('square', f, n + i * .04, .08, .05, b)) },
  magnet (n, b) { const o = osc('sine', 200, n, .6, .14, b, .02), c = AU.ctx, l = c.createOscillator(), g = c.createGain(); l.frequency.value = 14; g.gain.value = 60; l.connect(g); g.connect(o.frequency); l.start(n); l.stop(n + .7) },
  whistle (n, b) { for (const [st, du] of [[0, .16], [.24, .5]]) { const o = osc('sine', 2900, n + st, du, .11, b, .01), c = AU.ctx, l = c.createOscillator(), g = c.createGain(); l.frequency.value = 32; g.gain.value = 140; l.connect(g); g.connect(o.frequency); l.start(n + st); l.stop(n + st + du + .05) } },
  double (n, b) { for (let i = 0; i < 7; i++) osc('square', 1500 + Math.random() * 1500, n + i * .05, .08, .035, b) },
  crash (n, b) { noise(n, .7, .5, b, 'lowpass', 900); const o = osc('sine', 110, n, .4, .6, b); o.frequency.exponentialRampToValueAtTime(30, n + .35); osc('square', 330, n, .3, .05, b); osc('square', 447, n + .02, .3, .04, b) },
  smash (n, b) { noise(n, .3, .35, b, 'lowpass', 1500); const o = osc('sine', 140, n, .25, .4, b); o.frequency.exponentialRampToValueAtTime(40, n + .2); osc('square', 520, n, .12, .05, b) },
  // physical knocks scale with impact force: a cone tap is a tick, a crate hit is a thud
  hit (n, b, force = .5) { const v = Math.min(1, force); noise(n, .08 + v * .12, .06 + v * .25, b, 'lowpass', 600 + v * 1800); const o = osc('sine', 90 + v * 60, n, .12, .1 + v * .25, b); o.frequency.exponentialRampToValueAtTime(40, n + .12) },
  hop (n, b) { const o = osc('sine', 260, n, .2, .12, b); o.frequency.exponentialRampToValueAtTime(760, n + .16) },
  land (n, b) { noise(n, .12, .18, b, 'lowpass', 500); osc('sine', 70, n, .14, .2, b) },
  level (n, b) { [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, n + i * .08, .18, .1, b)) },
  record (n, b) { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => osc('square', f, n + i * .11, .2, .055, b)) },
  honk (n, b) { for (const st of [0, .22]) { osc('square', 392, n + st, .18, .045, b); osc('square', 494, n + st, .18, .045, b) } },
  click (n, b) { osc('sine', 880, n, .05, .06, b) },
  streak (n, b, k) { osc('triangle', 660 * Math.pow(1.26, k), n, .12, .08, b) },
  start (n, b) { osc('square', 440, n, .1, .05, b); osc('square', 440, n + .16, .16, .05, b); const o = osc('sawtooth', 70, n + .1, .6, .06, b); o.frequency.exponentialRampToValueAtTime(160, n + .6) }
}
export function sfx (name, ...a) { if (!AU.ctx || !AU.on.sfx) return; try { SFX[name](AU.ctx.currentTime, AU.sfxBus, ...a) } catch (e) {} }

export function setSound (k, on) {
  AU.on[k] = on; save.set(k, on)
  const icon = (k === 'music' ? 'i-music' : 'i-sound') + (on ? '' : '-off'), text = (k === 'music' ? 'Music' : 'Sounds') + (on ? ' on' : ' off')
  document.querySelectorAll(`.snd[data-k="${k}"]`).forEach(b => {
    b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', text)
    b.querySelector('use').setAttribute('href', '#' + icon); b.querySelector('span').textContent = text
  })
  if (AU.ctx) (k === 'music' ? AU.musicBus : AU.sfxBus).gain.setTargetAtTime(on ? (k === 'music' ? .5 : .85) : 0, AU.ctx.currentTime, .05)
}

let tick = 0
// speed in m/s; engineOn while riding
export function audioFrame (dt, speed, engineOn, menu, nitro) {
  if (!AU.ctx) return
  tick -= dt; if (tick > 0) return; tick = .08
  const n = AU.ctx.currentTime, E = AU.engine, v = Math.abs(speed)
  E.eg.gain.setTargetAtTime(engineOn ? .05 : (menu ? .018 : 0), n, .12)
  E.eo.frequency.setTargetAtTime(42 + v * 2.1, n, .12); E.lfo.frequency.setTargetAtTime(13 + v * .85, n, .12); E.ef.frequency.setTargetAtTime(300 + v * 14, n, .12)
  AU.mf.frequency.setTargetAtTime(menu ? 1500 : nitro ? 9000 : 5200, n, .25)
}
