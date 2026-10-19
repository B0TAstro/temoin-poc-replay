# Lancer l'app sur un iPhone

L'app utilise la caméra : il faut un **development build** (Expo Go ne suffit pas).

## Une seule fois
1. Brancher l'iPhone en USB, le déverrouiller, accepter « Faire confiance à cet ordinateur ».
2. Activer le Mode développeur : Réglages › Confidentialité et sécurité › Mode développeur (redémarrage).
3. Dans Xcode › Réglages › Accounts, ajouter son Apple ID (un compte gratuit suffit).

## Build et installation
```bash
cd app
npm install
npx expo run:ios --device
```
Choisir l'iPhone et l'équipe de signature. Avec un compte gratuit, autoriser le profil sur le téléphone :
Réglages › Général › VPN et gestion de l'appareil › Faire confiance. L'app expire au bout de 7 jours.

## Au quotidien
- Code JS/TS seulement : `npx expo start` (iPhone et Mac sur le même Wi-Fi), l'app se recharge.
- Nouvelle librairie native ou modification de `app.json` : refaire `npx expo run:ios --device`.

## Vérifications
```bash
cd app
npx tsc --noEmit
npx expo lint
```
