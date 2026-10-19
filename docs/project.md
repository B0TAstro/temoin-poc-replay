# Témoin · replay POC

## The project
A mobile app for amateur tennis matches played without an umpire. A phone standing at the side of
the court films continuously and keeps the last 30 seconds. When the players disagree, one of them
presses "VAR": the point is shown in slow motion, frame by frame, with zoom, visible to both
players. The app never rules: the players decide, looking at the same picture.
The score is kept by the app and validated by both players.

## Goal of this POC
Validate three technical building blocks, nothing more:
1. Circular video buffer: always keep the last 30 seconds, store nothing beyond that
2. Replay: slow motion (x0.25 and x0.5), frame by frame (one frame forward / back), pinch to zoom
3. Co-validated score: two phones share the same score in real time, each point validated by both players

## Stack
- React Native with Expo as a development build (not Expo Go, because of the camera)
- TypeScript
- Camera: react-native-vision-camera, recording at 60 fps when the device allows it
- Video playback: react-native-video
- Score sync: WebSocket; for the POC, a small Node relay server on my computer, on the same Wi-Fi as the phones
- Pairing the two phones with a QR code

## Constraints
- All video processing stays on the phone; no video is ever sent to a server (GDPR)
- Delete video segments older than 30 seconds as recording goes
- Watch battery and heat: a match lasts more than an hour
- Minimal UI: two screens (score, replay), big buttons, readable from a distance
- No detection and no AI in this POC

## Way of working
- Propose a plan before coding, and wait for my approval
- Move step by step, one building block at a time, testable on a real phone
- Explain technical choices in a few lines: I must be able to justify them in front of a jury
- Small, clear commits at every step that works
- Everything committed (code, comments, UI, docs, commit messages) is in English; talk to me in French
