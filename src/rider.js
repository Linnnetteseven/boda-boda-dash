// The player's boda: one visual model shared by both modes, driven by a Rapier vehicle.
import * as THREE from 'three'
import { scene } from './render.js'
import { makeBoda } from './models.js'
import { createVehicle, readVehicle, suspensionLength } from './physics.js'
import { clamp, damp } from './util.js'

export const rider = { model: null, v: null, lean: 0, pitch: 0, wheelSpin: 0, tipped: 0, tipDir: 1 }
const MODEL_Y = -.945                                   // model root sits this far below the chassis origin
const TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2) // model -z -> chassis +x
const _off = new THREE.Vector3(), _q = new THREE.Quaternion()

export function buildRider () {
  rider.model = makeBoda()
  scene.add(rider.model.root)
}
// heading: world yaw for the chassis +x axis. For a rider heading down -z use +PI/2.
export function spawnVehicle (x, z, heading) {
  rider.v = createVehicle(x, 1.1, z, heading)
  rider.lean = 0; rider.tipped = 0
  return rider.v
}
export function syncRider (dt, time) {
  const v = rider.v, m = rider.model
  if (!v) return
  readVehicle(v, dt)
  // place the model on the chassis
  _q.copy(v.quaternion).multiply(TURN)
  _off.set(0, MODEL_Y, 0).applyQuaternion(v.quaternion)
  m.root.position.copy(v.position).add(_off)
  m.root.quaternion.copy(_q)
  // lean into turns the way a real rider does: tan(lean) = v * yawRate / g
  const yawRate = v.body.angvel().y
  const target = v.grounded ? clamp(Math.atan(v.fwdSpeed * yawRate / 9.81) * 1.1, -.6, .6) : rider.lean * .98
  rider.lean = damp(rider.lean, target, 10, dt)
  const tip = rider.tipped * rider.tipDir * 1.35
  m.lean.rotation.z = rider.lean + tip
  // wheels: spin with forward speed, ride up and down with the suspension
  rider.wheelSpin -= v.fwdSpeed * dt / .385
  const front = (suspensionLength(v, 0) + suspensionLength(v, 1)) / 2
  const rear = (suspensionLength(v, 2) + suspensionLength(v, 3)) / 2
  m.wheels[1].rotation.x = m.wheels[0].rotation.x = rider.wheelSpin
  m.wheels[1].position.y = clamp(-.2 - front - MODEL_Y, .2, .6)
  m.wheels[0].position.y = clamp(-.2 - rear - MODEL_Y, .2, .6)
  for (const t of m.tassels) t.rotation.x = Math.sin(time * 18) * .15 + clamp(v.speed * .015, 0, .9)
}
