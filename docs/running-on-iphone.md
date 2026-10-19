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

## Checks
```bash
cd app
npx tsc --noEmit
npx expo lint
```
