// Rapier physics: the world, a fixed 60 Hz step, the boda's raycast vehicle, and knockable props.
// The vehicle follows the pattern of Bruno Simon's folio-2025 PhysicsVehicle (MIT): a dynamic chassis,
// a DynamicRayCastVehicleController with four suspended wheels, engine force capped by top speed, idle brake
// and an upright assist. Our boda uses a narrow wheel track and leans visually instead of tipping over.
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { clamp } from './util.js'

export let R = null
export let world = null
export let events = null
const STEP = 1 / 60
let acc = 0
const bodies = []          // { body, obj } pairs whose meshes follow their rigid bodies
const forceHandlers = new Map() // collider handle -> fn(force)

export async function initPhysics () {
  await RAPIER.init()
  R = RAPIER
  resetWorld()
}
export function resetWorld () {
  if (world) world.free()
  world = new R.World({ x: 0, y: -9.81 * 1.6, z: 0 })
  events = new R.EventQueue(true)
  bodies.length = 0
  forceHandlers.clear()
  acc = 0
}

// Run as many fixed steps as the frame needs; `pre` runs before each step (vehicle controls).
export function stepPhysics (dt, pre) {
  acc = Math.min(acc + dt, STEP * 4)
  let steps = 0
  while (acc >= STEP) {
    pre && pre(STEP)
    world.step(events)
    events.drainContactForceEvents(e => {
      const f = e.totalForceMagnitude()
      const h1 = forceHandlers.get(e.collider1()), h2 = forceHandlers.get(e.collider2())
      h1 && h1(f, e.collider2()); h2 && h2(f, e.collider1())
    })
    acc -= STEP; steps++
  }
  for (const b of bodies) {
    if (b.body.isSleeping() && b.synced) continue
    const t = b.body.translation(), r = b.body.rotation()
    b.obj.position.set(t.x, t.y, t.z); b.obj.quaternion.set(r.x, r.y, r.z, r.w)
    b.synced = true
  }
  return steps
}
export function onForce (collider, fn, threshold = 2) {
  collider.setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS)
  collider.setContactForceEventThreshold(threshold)
  forceHandlers.set(collider.handle, fn)
}

// ------------------------------------------------------------------ static and kinematic helpers
export function fixedBox (x, y, z, hx, hy, hz, rotY = 0, friction = .6) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
  const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, y, z).setRotation(q))
  world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setFriction(friction), body)
  return body
}
export function kinematicBox (x, y, z, hx, hy, hz) {
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z))
  const col = world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(0, hy, 0).setFriction(.5).setRestitution(.2), body)
  return { body, col }
}
export function removeBody (body) {
  const i = bodies.findIndex(b => b.body === body)
  if (i >= 0) bodies.splice(i, 1)
  for (let c = 0; c < body.numColliders(); c++) forceHandlers.delete(body.collider(c).handle)
  world.removeRigidBody(body)
}
// Turn a kinematic body loose so it tumbles (a matatu hit during Nganya Mode).
export function launch (body, obj, impulse, torque) {
  body.setBodyType(R.RigidBodyType.Dynamic, true)
  body.setAdditionalMass(6, true)
  body.applyImpulse(impulse, true)
  body.applyTorqueImpulse(torque, true)
  bodies.push({ body, obj })
}

// ------------------------------------------------------------------ knockable props
export function addProp (obj, kind, x, y, z, rotY = 0, onHit) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
  const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y + kind.half[1], z).setRotation(q).setLinearDamping(.2).setAngularDamping(.3).setCanSleep(true))
  const col = world.createCollider(R.ColliderDesc.cuboid(...kind.half).setMass(kind.mass).setFriction(.7).setRestitution(.25), body)
  body.sleep()
  if (onHit) onForce(col, onHit, 1)
  obj.position.set(x, y + kind.half[1], z); obj.quaternion.copy(q)
  bodies.push({ body, obj, synced: false })
  return body
}

// ------------------------------------------------------------------ the boda vehicle
// Chassis local axes: +x forward, +y up, +z right side (Bruno's convention).
export function createVehicle (x, y, z, heading = 0) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading)
  const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(q).setCanSleep(false).setAngularDamping(.8).setLinearDamping(.05))
  // main frame: heavy with a low centre of mass (as in Bruno's chassis) so engine torque can't flip it
  const col = world.createCollider(R.ColliderDesc.cuboid(.95, .32, .3).setMassProperties(3, { x: 0, y: -.45, z: 0 }, { x: .25, y: 1.1, z: 1.0 }, { x: 0, y: 0, z: 0, w: 1 }).setFriction(.3).setRestitution(.1), body)
  // the rider: a taller, massless box so matatus and crates hit the rider, not just the frame
  world.createCollider(R.ColliderDesc.cuboid(.35, .45, .28).setTranslation(-.1, .7, 0).setMass(0).setFriction(.3), body)
  const ctrl = world.createVehicleController(body)
  const W = { radius: .385, rest: .42, x: .72, z: .26, y: -.2 }
  const pos = [[W.x, W.z], [W.x, -W.z], [-W.x, W.z], [-W.x, -W.z]]
  for (const [wx, wz] of pos) {
    ctrl.addWheel({ x: wx, y: W.y, z: wz }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, W.rest, W.radius)
  }
  for (let i = 0; i < 4; i++) {
    ctrl.setWheelSuspensionStiffness(i, 34)
    ctrl.setWheelSuspensionCompression(i, 4.4)
    ctrl.setWheelSuspensionRelaxation(i, 3.2)
    ctrl.setWheelMaxSuspensionTravel(i, .4)
    ctrl.setWheelMaxSuspensionForce(i, 220)
    ctrl.setWheelFrictionSlip(i, 1.6)
    ctrl.setWheelSideFrictionStiffness(i, 1.4)
  }
  const v = {
    body, col, ctrl, W,
    speed: 0, fwdSpeed: 0, lateral: 0, grounded: true, airTime: 0, justLanded: false,
    forward: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0), right: new THREE.Vector3(0, 0, 1),
    position: new THREE.Vector3(x, y, z), quaternion: q.clone(), velocity: new THREE.Vector3(),
    topSpeed: 16, engine: 20, brake: .5, steerMax: .42,
    input: { throttle: 0, steer: 0, boost: false, hop: false }
  }
  return v
}
const _up = new THREE.Vector3(0, 1, 0), _t = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion()
// Called before each fixed physics step.
export function driveVehicle (v, dt) {
  const { body, ctrl, input } = v
  const top = v.topSpeed * (input.boost ? 1.65 : 1)
  const over = v.fwdSpeed - top
  let engine = input.throttle * v.engine * (input.boost ? 1.8 : 1) * (over > 0 ? 0 : Math.min(1, -over / 2 + .15))
  let brake = 0
  if (Math.abs(input.throttle) < .05) brake = .08 // idle brake, like rolling to a stop
  if ((input.throttle < -.1 && v.fwdSpeed > 1) || (input.throttle > .1 && v.fwdSpeed < -1)) { brake = v.brake; engine = 0 }
  // input.steer +1 means right; Rapier's positive wheel steering turns left
  const steer = -input.steer * v.steerMax * (1 - clamp(Math.abs(v.fwdSpeed) / 60, 0, .55))
  for (let i = 0; i < 4; i++) {
    ctrl.setWheelEngineForce(i, i >= 2 ? engine : engine * .35)
    ctrl.setWheelBrake(i, i >= 2 ? brake : brake * .4)
    if (i < 2) ctrl.setWheelSteering(i, steer)
  }
  ctrl.updateVehicle(dt)

  // Upright assist: correct roll and pitch with a spring torque so the narrow boda never tips over,
  // while yaw (turning) stays completely free. The visible lean is added on top in the visual model.
  const r = body.rotation(); _q.set(r.x, r.y, r.z, r.w)
  _t.set(0, 1, 0).applyQuaternion(_q)
  const axis = _w.copy(_t).cross(_up)
  const av = body.angvel()
  const yaw = av.y
  const k = v.grounded ? 70 : 14, d = v.grounded ? 10 : 3
  body.applyTorqueImpulse({ x: (axis.x * k - (av.x) * d) * dt * .5, y: 0, z: (axis.z * k - (av.z) * d) * dt * .5 }, true)
  void yaw
}
// Called after the step: read back position, speed and contacts.
export function readVehicle (v, dt) {
  const t = v.body.translation(), r = v.body.rotation(), lv = v.body.linvel()
  v.position.set(t.x, t.y, t.z); v.quaternion.set(r.x, r.y, r.z, r.w)
  v.velocity.set(lv.x, lv.y, lv.z)
  v.forward.set(1, 0, 0).applyQuaternion(v.quaternion)
  v.right.set(0, 0, 1).applyQuaternion(v.quaternion)
  v.up.set(0, 1, 0).applyQuaternion(v.quaternion)
  v.fwdSpeed = v.velocity.dot(v.forward)
  v.lateral = v.velocity.dot(v.right)
  v.speed = Math.hypot(lv.x, lv.z)
  let contact = 0
  for (let i = 0; i < 4; i++) if (v.ctrl.wheelIsInContact(i)) contact++
  const was = v.grounded
  v.grounded = contact >= 2
  v.justLanded = !was && v.grounded && v.airTime > .25
  v.airTime = v.grounded ? 0 : v.airTime + dt
}
export function hopVehicle (v, power = 5) {
  if (!v.grounded) return false
  v.body.applyImpulse({ x: 0, y: v.body.mass() * power, z: 0 }, true)
  v.body.applyTorqueImpulse({ x: 0, y: 0, z: 0 }, true)
  return true
}
export function placeVehicle (v, x, y, z, heading = 0) {
  const q = new THREE.Quaternion().setFromAxisAngle(_up, heading)
  v.body.setTranslation({ x, y, z }, true)
  v.body.setRotation(q, true)
  v.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  v.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
}
export function suspensionLength (v, i) { return v.ctrl.wheelSuspensionLength(i) ?? v.W.rest }
