// Small helpers shared by every module.
export const rnd = (a, b) => a + Math.random() * (b - a)
export const pick = a => a[Math.floor(Math.random() * a.length)]
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))
export const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
export const ksh = n => Math.round(n).toLocaleString('en-KE')

export const save = {
  get (k, d) { try { const v = localStorage.getItem('boda.' + k); return v === null ? d : JSON.parse(v) } catch (e) { return d } },
  set (k, v) { try { localStorage.setItem('boda.' + k, JSON.stringify(v)) } catch (e) {} }
}

export const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

export const C = {
  ink: '#1B1030', paper: '#FFFDF5', magenta: '#FF2E88', yellow: '#FFD23F', cyan: '#19C3E6', green: '#00B377', lime: '#C6F432',
  orange: '#FF7A1A', purple: '#7B3FF2', red: '#E8364A', chrome: '#D9D6E3', gold: '#FFC83D'
}

export const FONT = px => `${px}px Bungee, "Arial Black", Impact, sans-serif`

export function label (g, text, x, y, size, fill, stroke, maxW) {
  g.font = FONT(size); g.textAlign = 'center'; g.textBaseline = 'middle'
  if (stroke) { g.lineJoin = 'round'; g.lineWidth = size * .18; g.strokeStyle = stroke; g.strokeText(text, x, y, maxW) }
  g.fillStyle = fill; g.fillText(text, x, y, maxW)
}

export function specks (g, w, h, cols, n) {
  for (let i = 0; i < n; i++) { g.globalAlpha = rnd(.1, .4); g.fillStyle = pick(cols); g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 3), rnd(1, 3)) }
  g.globalAlpha = 1
}
