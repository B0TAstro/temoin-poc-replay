# Témoin · replay POC

The project brief and the working rules live in `docs/`:

@docs/project.md
@docs/plan.md
@docs/expo-conventions.md

## Roadmap

Step 5: the sync. A small Node WebSocket relay server in a /server folder.
Two phones join the same match through a QR code. A point is only validated once
both players have confirmed it; if they disagree, offer to open the replay.
