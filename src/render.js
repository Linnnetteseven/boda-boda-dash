// Renderer, scene, lights, post-processing and the shared material system.
// The look follows Bruno Simon's folio: soft Lambert shading, shadows tinted by a cool sky light,
// light bounced up from the ground, fog that melts into the sky, and bloom on anything emissive.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { isTouch } from './util.js'

export const quality = isTouch ? 'low' : 'high'
export const HORIZON = '#FFE2C2'

export const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1.5 : 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

export const scene = new THREE.Scene()
scene.fog = new THREE.Fog(HORIZON, 40, 150)
export const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 180)

// Cool sky fill + warm ground bounce. Areas the sun can't reach take on the sky's lavender-blue,
// which gives the coloured shadows of the reference instead of grey ones.
export const hemi = new THREE.HemisphereLight('#B9C6FF', '#F2B48A', 1.55)
scene.add(hemi)
export const sun = new THREE.DirectionalLight('#FFF0D6', 2.4)
sun.castShadow = true
const SM = quality === 'low' ? 1024 : 2048
sun.shadow.mapSize.set(SM, SM)
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 })
sun.shadow.bias = -0.0005
sun.shadow.normalBias = 0.03
sun.shadow.radius = 3
scene.add(sun, sun.target)
const SUN_DIR = new THREE.Vector3(-0.55, 1, 0.35).normalize()
export function aimSun (target) {
  sun.target.position.copy(target)
  sun.position.copy(target).addScaledVector(SUN_DIR, 40)
}

// Post-processing: bloom picks up headlights, neon underglow, matatu light bars and power-ups.
export const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
export const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82)
composer.addPass(bloom)
composer.addPass(new OutputPass())

export function resize () {
  const w = innerWidth, h = innerHeight
  renderer.setSize(w, h, false)
  composer.setSize(w, h)
  composer.setPixelRatio(renderer.getPixelRatio())
  bloom.resolution.set(w / (quality === 'low' ? 3 : 2), h / (quality === 'low' ? 3 : 2))
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

// Time uniform shared by every wind-swayed material.
export const windTime = { value: 0 }

const cache = new Map()
function patchWind (mat, strength) {
  mat.onBeforeCompile = shader => {
    shader.uniforms.uTime = windTime
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wpos = modelMatrix * vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wpos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
      #endif
      float sway = max(0.0, transformed.y - ${strength > 1 ? '0.0' : '1.6'}) * ${(0.045 * strength).toFixed(3)};
      transformed.x += sin(uTime * 1.7 + wpos.x * 0.35 + wpos.z * 0.21) * sway;
      transformed.z += cos(uTime * 1.3 + wpos.x * 0.17 + wpos.z * 0.33) * sway * 0.7;`)
  }
  mat.customProgramCacheKey = () => 'wind' + strength
}

// lam(color, { emissive, wind, side, ... }) returns a cached Lambert material.
export function lam (color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '')
  if (cache.has(key)) return cache.get(key)
  const { wind, ...rest } = opts || {}
  const m = new THREE.MeshLambertMaterial({ color, ...rest })
  if (wind) patchWind(m, wind)
  cache.set(key, m)
  return m
}
const mapCache = new Map()
export function lamMap (tex, opts) {
  if (!opts && mapCache.has(tex)) return mapCache.get(tex)
  const m = new THREE.MeshLambertMaterial({ map: tex, ...opts })
  if (!opts) mapCache.set(tex, m)
  return m
}
export function glow (color, opacity = 0.6) {
  const key = 'glow' + color + opacity
  if (!cache.has(key)) cache.set(key, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  return cache.get(key)
}

export function canvasTex (w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
export const rep = (t, x, y) => { const c = t.clone(); c.repeat.set(x, y); c.needsUpdate = true; return c }
export function M (geo, mat, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m
}
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d)

// Bake static meshes into one mesh per material: a whole street block becomes a few dozen draw calls.
export function mergeStatic (root) {
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const buckets = new Map(), kill = []
  const mtx = new THREE.Matrix4()
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.children.length || o.userData.keep) return
    mtx.multiplyMatrices(inv, o.matrixWorld)
    let geo = o.geometry.clone().applyMatrix4(mtx)
    if (geo.index) geo = geo.toNonIndexed()
    const key = o.material.uuid + (o.castShadow ? 's' : '')
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, geos: [] })
    buckets.get(key).geos.push(geo); kill.push(o)
  })
  for (const o of kill) o.parent.remove(o)
  for (const b of buckets.values()) {
    let n = 0; for (const g of b.geos) n += g.attributes.position.count
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2)
    let off = 0
    for (const g of b.geos) {
      pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3)
      if (g.attributes.uv) uv.set(g.attributes.uv.array, off * 2)
      off += g.attributes.position.count; g.dispose()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.computeBoundingSphere()
    const m = new THREE.Mesh(geo, b.mat); m.castShadow = b.cast; m.receiveShadow = true
    root.add(m)
  }
}
