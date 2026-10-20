# Running the app on an iPhone

The app uses the camera, so it needs a **development build** (Expo Go is not enough).

## One-time setup
1. Plug the iPhone in over USB, unlock it, accept "Trust This Computer".
2. Enable Developer Mode: Settings › Privacy & Security › Developer Mode (the phone restarts).
3. In Xcode › Settings › Accounts, add your Apple ID (a free account is enough).

Once the phone has been paired over USB, Xcode can also reach it over Wi-Fi (same network).

## Build and install
```bash
cd app
npm install
npx expo run:ios --device
```
Pick the iPhone and the signing team. With a free account, trust the developer profile on the phone:
Settings › General › VPN & Device Management › Trust. The app expires after 7 days.

## Day to day
- JS/TS changes only: `npx expo start` (iPhone and Mac on the same Wi-Fi), the app reloads.
- New native library or `app.json` change: run `npx expo run:ios --device` again.

## Two-phone match
The score is synced through a small relay running on the computer (same Wi-Fi as both phones):
```bash
cd server
npm install
npm start          # prints the ws:// addresses it listens on (port 8787)
```
1. Install the app on both iPhones and start Metro (`npx expo start` in `app/`). In development the
   app finds the relay on the computer that serves Metro; `EXPO_PUBLIC_RELAY_URL=ws://IP:8787` overrides it.
2. Phone A: **Create match**. It shows a QR code and a 4-letter match code.
3. Phone B: **Join match**, scan the QR code (the iPhone Camera app works too: it opens Témoin).
4. Any phone proposes a point with **+1**; it only counts once the other phone taps **Confirm**.
   **Disagree** shows *Open replay* on both phones; after the replay, the other player can still confirm,
   or either player cancels. **Undo** is co-validated the same way.

**Solo match** keeps everything on one phone, without the relay.

## Checks
```bash
cd app
npx tsc --noEmit
npx expo lint
npm test        # tennis scoring and join link unit tests, no phone needed

cd ../server
npm test        # relay room logic (node:test)
npm run typecheck
```
