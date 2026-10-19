# Témoin · replay POC

The project brief and the working rules live in `docs/`:

@docs/project.md
@docs/plan.md
@docs/expo-conventions.md

## Roadmap

Step 1: set up the Expo project as a development build with TypeScript and vision-camera.
A single screen showing the back camera full screen at 60 fps, with the real fps displayed
as an overlay. Explain how to run it on my iPhone.

Step 2: the buffer. Record continuously in short segments and only keep the last 30
seconds. Add a small "REC · 30 s" indicator and a segment counter to check
that old segments are actually deleted.

Step 3: the VAR button. When pressed, stop capturing the current segment and open a replay
screen with the last seconds: x0.25 and x0.5 playback, previous / next frame,
pinch to zoom, a "Resume match" button that restarts recording.
Measure the time between the press and the replay being displayed.

Step 4: the score. A very readable score screen (sets, games, tennis points), +1 for each player,
undo the last point. Tennis scoring logic isolated and covered by unit tests.

Step 5: the sync. A small Node WebSocket relay server in a /server folder.
Two phones join the same match through a QR code. A point is only validated once
both players have confirmed it; if they disagree, offer to open the replay.
