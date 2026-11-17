# Boda Boda Dash

A 3D browser game set in Nairobi. Ride a boda boda, dodge potholes and matatus, pick up passengers and earn fares.

Live: https://boda-boda-dash.vercel.app

## Modes

- **Runner**: an endless three-lane road. Switch lanes, hop potholes, grab passengers (Ksh 50) and coins (Ksh 10). Every 30 seconds the road speeds up.
- **Free ride**: an open neighbourhood seen from a high diorama camera. Pick up waving passengers at stages and drop them at the green beam within a three-minute shift. Fast drops earn a tip.

Power-ups: Nganya Mode (neon speed burst that smashes matatus), Chapati Shield, Pesa Magnet, Kanjo Whistle and Double Fare.

## Controls

| | Laptop | Phone |
|---|---|---|
| Runner | ← → or A / D to switch lanes, ↑ or Space to hop | Tap a side to switch lanes, swipe up to hop |
| Free ride | W A S D or arrows, Shift to boost, Space to hop, R to reset | Stick to steer and accelerate, Boost and Hop buttons |
| Both | P or Esc to pause | Pause button |

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## How it's built

- [Three.js](https://threejs.org) for rendering, with a Lambert look tuned after Bruno Simon's folio: shadows tinted by a cool sky light, warm light bounced up from the ground, fog that melts into the sky, wind-swayed foliage and grass, and bloom on emissive parts.
- [Rapier](https://rapier.rs) for physics. The boda is a raycast vehicle with four suspended wheels, an upright assist and a visual lean into turns. Cones, crates and drums are rigid bodies you can knock over. In Nganya Mode, matatus become rigid bodies and tumble.
- All textures (signs, facades, matatu art) are drawn on canvases at load time, and all music and sound effects are synthesized with the Web Audio API, so there are no image or audio files.

| File | What it does |
|---|---|
| `src/main.js` | Boot, input, game states, frame loop, sky |
| `src/render.js` | Renderer, lights, bloom, materials, static mesh merging |
| `src/physics.js` | Rapier world, fixed step, the boda vehicle, props |
| `src/models.js` | Every 3D model: rider, boda, matatus, people, buildings, trees, pickups |
| `src/runner.js` | Runner mode |
| `src/roam.js` | Free ride mode |
| `src/game.js` | Money, power-ups, streaks, results |
| `src/audio.js` | Music loop and sound effects |
| `src/ui.js`, `src/fx3d.js` | HUD, menus, joystick, particles and trails |

## Versions

Each earlier version has its own branch: `v1` (top-down 2D), `v2` (first 3D runner), `v3` (single-file 3D with power-ups and menu). `v4` and `main` hold this version.

## Credits

Vehicle and camera approach inspired by [Bruno Simon's folio-2025](https://github.com/brunosimon/folio-2025) (MIT). See `THIRD_PARTY_NOTICES.md`.
