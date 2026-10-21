# Plan — Témoin · replay POC

## Context
The repository started empty (only `CLAUDE.md`). The POC must validate three building blocks: a 30 s circular video buffer, replay (slow motion, frame by frame, zoom), and a score co-validated across two phones. Imposed stack: Expo dev build + TypeScript, react-native-vision-camera, react-native-video, a Node WebSocket relay on the local Wi-Fi, QR pairing. No video ever leaves the phone.

Decisions (approved):
- Testing on **iPhone**.
- **Two phones = two camera angles**, in the same session. Each one films, keeps its own buffer and shows the score at all times. A single phone must work too (we start with one).
- **VAR on any phone → replay at the same time on both**, each one replaying **its own angle** at the same instant, with synchronized controls (pause, speed, frame by frame, position). No video travels between phones.

---

## 1. Architecture

```
temoin-poc-replay/
├── CLAUDE.md                 # Entry point for Claude Code (imports docs/)
├── README.md
├── docs/                     # Project brief, plan, conventions, guides
├── app/                      # Expo app (dev build)
│   └── src/
│       ├── app/              # Screens (expo-router)
│       │   ├── index.tsx     # Home: "Create a match" (shows QR) / "Join" (scans QR)
│       │   ├── match.tsx     # SCORE screen: camera in the background + score + big buttons + VAR button
│       │   └── replay.tsx    # REPLAY screen: player, x0.25 / x0.5, ◀ frame / frame ▶, zoom
│       ├── buffer/           # Block 1
│       │   ├── SegmentRecorder.ts   # VisionCamera start/stop recording loop
│       │   ├── SegmentStore.ts      # segment list, deletion after 30 s, locks during replay
│       │   └── useRollingBuffer.ts  # hook wiring camera + store
│       ├── replay/           # Block 2
│       │   ├── ReplayPlayer.tsx     # react-native-video + chaining segments
│       │   ├── useFrameStep.ts      # seek ± 1/fps
│       │   └── ZoomableView.tsx     # pinch + pan (gesture-handler + reanimated)
│       ├── score/            # Block 3
│       │   ├── tennis.ts            # pure scoring logic (points, games, sets, advantage)
│       │   ├── tennis.test.ts       # Jest tests
│       │   └── useScoreSync.ts      # WebSocket client + "proposed / validated" state
│       ├── pairing/          # QR: generation (react-native-qrcode-svg) + scanning (VisionCamera code scanner)
│       └── diagnostics/      # debug overlay: real fps, segments, disk MB, battery, VAR latency
├── server/                   # Node relay (ws): rooms per matchId, canonical score state
└── shared/protocol.ts        # Message types shared by app and server
```

Choices we can justify:
- **expo-router**: the Expo template default; 3 screens are enough.
- **Pure scoring logic** (`tennis.ts`) separated from networking: testable without a phone.
- **Server holds the canonical state** (not a plain echo): a phone that reconnects gets the score back.

---

## 2. 30 s buffer strategy

### Principle: short rotating segments, on disk
**No frame is kept in memory** (1 s of raw 1080p60 ≈ 370 MB). We let the hardware H.264 encoder write short MP4 files:

1. `camera.startRecording()` → after **D = 5 s**, `stopRecording()` → the `onRecordingFinished` callback gives the file path → we immediately call `startRecording()` again.
2. `SegmentStore` keeps the list `{ path, start, end, duration }`. As soon as a segment ended more than 30 s ago (+ one segment of margin), it is deleted (`expo-file-system`). In steady state: **at most 7 files** (~35 s), i.e. ~30–60 MB depending on bitrate → disk usage stays flat.
3. Files live in the app's cache folder, purged at launch (nothing survives a session).

### Pressing VAR
1. We call `stopRecording()` on the current segment → it is finalized and contains the moment of the press.
2. We **lock** the last 2–3 segments (the store does not delete them during the replay).
3. We open the replay screen positioned ~5 s before the press, playing the segments back to back (automatic switch to the previous/next segment at the edges, global timeline "−10 s … 0 s").
4. Recording resumes in the background into new segments (the match goes on). When leaving the replay, we unlock and cleanup resumes.

### Implemented choice: overlapping segments
VisionCamera v5 in `enablePersistentRecorder` mode (iOS: `AVCaptureVideoDataOutput` + `AVAssetWriter`) feeds every frame to **all** active recorders. A segment starts every **5 s** and stops on its own at **5.5 s** (`maxDuration`): consecutive segments overlap by ~0.5 s, so **no frame is lost** between two files. Cost: two simultaneous encodes 10 % of the time. Code: `app/src/buffer/`.

**Update after the first iPhone test:** about 100 MB on disk for ~38 s of 720p60 (iOS picks the bitrate, ~20 Mbit/s, and VisionCamera's persistent recorder cannot change it). To cut storage, segments are now strictly 5 s (`OVERLAP_SECONDS = 0`) and at most 5 files are kept, including the one being recorded: ~25 s of video, ~60 MB. The overlay shows `GAP` if frames are lost between two files; setting `OVERLAP_SECONDS` back to 0.5 removes them.

### Known weak spot: the gap between two segments (initial approach)
Between `stop` and `start`, VisionCamera takes a few tens to a few hundred ms: those frames are lost. We **measure it from step 4** (end timestamp of one segment vs start of the next). Options if it is too much:
- longer segments (10 s → fewer gaps, same VAR finalization);
- plan B: a small native module (AVAssetWriter on iOS / MediaCodec + MediaMuxer on Android) that keeps **encoded H.264 samples** in a ring buffer and only writes the MP4 when VAR is pressed — zero gap, but native code. Only if measurements demand it.

---

## 3. Risks

| Risk | Why | What we do |
|---|---|---|
| **Real fps < 60** | Not every sensor offers 60 fps at every resolution; Android may produce variable fps; heat can lower throughput | Pick the format with `useCameraFormat({ fps: 60, videoResolution: 1280×720 })`, show the selected format, check on a recorded file (frame count / duration). 720p60 beats 1080p30 for a tennis ball. |
| **Gaps between segments** | See above | Measure, then longer segments or native module. |
| **VAR → picture latency** | MP4 finalization (~0.2–0.5 s) + navigation + player load | Measure press → first `onReadyForDisplay`. Target < 1.5 s. Prepare the replay screen ahead if needed. |
| **Imprecise frame stepping** | Seeking targets a time, not a frame; stepping back requires decoding from the previous keyframe | Seek ± 1/fps while paused, zero tolerance; shorten the keyframe interval (≈ 1 s) if stepping back is slow. |
| **Battery / heat over 1 h+** | Sensor + encoder + screen on continuously | 720p rather than 4K, moderate bitrate, lower brightness, `expo-keep-awake` (otherwise the camera stops when the screen locks), battery log every minute (`expo-battery`), thermal state if available. Dedicated 1 h endurance test. |
| **App in background** | iOS/Android stop the camera when the app is not in the foreground | Accepted for the POC: the screen stays on the app. The buffer restarts cleanly when coming back. |
| **Local network** | Club Wi-Fi is often missing or isolates clients | For the POC: same Wi-Fi as the computer. Auto-reconnect + canonical state on the server. |
| **Library versions** | VisionCamera / react-native-video move fast with the New Architecture | Check compatibility with the Expo version at step 0, pin versions. |

---

## 4. Testable steps (one commit each)

**Block 0 — foundation**
0. Expo TypeScript project + dev build installed on the real phone, "hello" screen. *Test: the app launches on the phone.*

**Block 2 first, on a single clip (simpler than the buffer)**
1. Camera preview + 60 fps format + overlay showing selected resolution / fps. *Test: we read 60 fps on screen.*
2. "Record 5 s" button → playback of the file with react-native-video. *Test: the clip plays back; we check its real fps.*
3. Replay controls on that clip: x0.25 / x0.5 / x1, pause, ◀ frame / frame ▶, pinch-zoom + pan. *Test: stepping one frame forward/back works, zoom is smooth.*

**Block 1 — circular buffer**
4. Segment loop + `SegmentStore` + deletion after 30 s + debug overlay (file count, MB, measured gap between segments). *Test: 10 min of recording, stable disk usage, ≤ 7 files.*
5. VAR button: finalization, locking, chained replay of the last segments, recording resumes. *Test: clap your hands, press VAR, find the clap; latency displayed.*
6. 1 h endurance test: battery / heat / fps log. *Test: figures for the jury.* → decision: segments are fine, or native module.

**Block 3 — co-validated score**
7. Pure `tennis.ts` + Jest tests (15-30-40, deuce/advantage, games, tie-break, sets). *Test: `npm test` green, no phone needed.*
8. Node relay server (`ws`): rooms, canonical state, protocol in `shared/protocol.ts`. One phone connects and shows the score. *Test: a scored point shows up in the server logs.*
9. QR pairing (the camera phone shows `ws://IP:port` + `matchId`, the other one scans) + co-validation: one player proposes "point for X", the point only counts once the other one validates (otherwise reject / cancel). *Test: two phones, same score in real time.*

**Replay sync across two angles**
10. Shared clock: each phone estimates its offset to the server (NTP-style ping, several round trips). VAR is broadcast with an instant `t_var` in server time; each phone converts it to its own clock and opens its replay at the same instant. *Test: clap in front of both phones, VAR, both screens show the clap within a few frames.*
11. Synchronized controls: pause / speed / ◀ frame ▶ / position sent as commands, applied on both players; leaving the replay is synchronized. *Test: one player steps one frame, the other screen follows.*

**Integration**
12. Final SCORE screen (big buttons, readable from a distance) with the camera in the background + VAR → REPLAY → back. *Test: a short real match of a few games.*

---

## Verification
- Steps 1–6 and 9–10: on a real phone, each step with an observable criterion (above) and the diagnostics overlay.
- Step 7: automated Jest tests.
- Step 8: server + client logs.
- No next step until the previous one is approved; commit at every step that works.

## Added risk
- **Clock offset between phones**: without correction, the two replays do not show the same instant. Offset measured through the server; target accuracy ≈ 1–2 frames.
