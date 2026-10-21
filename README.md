# Témoin · replay POC

A mobile app for amateur tennis matches played without an umpire: phones standing at the side of the
court film continuously and keep the last 30 seconds. When players disagree, "VAR" replays the point
in slow motion, frame by frame, on every phone of the match. The score is co-validated by both
players.

## Structure

| Folder | Content |
|---|---|
| `app/` | Expo app (React Native, TypeScript, development build) |
| `app/src/app/` | Screens (expo-router) |
| `app/src/buffer/` | Circular buffer: 5 rotating video segments of 5 s (last ~25 seconds) |
| `app/src/replay/` | VAR replay: segment timeline, slow motion, frame stepping, pinch to zoom |
| `app/src/score/` | Pure tennis scoring logic (unit tested) and scoreboard |
| `app/src/sync/` | Relay client: co-validated points, pending action banner |
| `app/src/pairing/` | QR code join link (generation and parsing) |
| `app/src/diagnostics/` | On-screen measurements (real fps, …) |
| `docs/` | Project brief, step-by-step plan, conventions, guides |
| `server/` | Node WebSocket relay holding the canonical match state (unit tested) |
| `shared/` | Protocol types shared by the app and the server |

## Documentation
- [Project and constraints](docs/project.md)
- [Technical plan and steps](docs/plan.md)
- [Running on an iPhone](docs/running-on-iphone.md) (and a two-phone match)
- [Expo conventions](docs/expo-conventions.md)

## Progress
- [x] Step 0: Expo foundation + development build
- [x] Step 1: full-screen back camera at 60 fps, real fps displayed *(to be verified on iPhone)*
- [x] Step 2: 30 s circular buffer made of overlapping segments *(to be verified on iPhone)*
- [x] Step 3: VAR button, replay (x0.25 / x0.5, frame by frame, pinch to zoom), press → picture latency *(to be verified on iPhone)*
- [x] Step 4: readable score screen (sets, games, points), +1 per player, undo; scoring logic covered by unit tests
- [x] Step 5: two-phone sync through a Node WebSocket relay, QR pairing, co-validated points, replay offered on disagreement *(to be verified on iPhones)* *(to be verified on iPhone)*
