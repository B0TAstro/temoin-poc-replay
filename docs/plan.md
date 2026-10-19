# Plan — Témoin · POC replay

## Contexte
Le dépôt est vide (seul `CLAUDE.md`). Le POC doit valider trois briques : buffer vidéo circulaire de 30 s, replay (ralenti, image par image, zoom), score co-validé entre deux téléphones. Stack imposée : Expo dev build + TypeScript, react-native-vision-camera, react-native-video, relais WebSocket Node sur le Wi-Fi local, appairage QR. Aucune vidéo ne quitte le téléphone.

Décisions (validées) :
- Tests sur **iPhone**.
- **Deux téléphones = deux angles**, dans la même session. Chacun filme, garde son propre buffer et affiche le score en permanence. Un seul téléphone doit aussi fonctionner (on commence avec un seul).
- **VAR sur n'importe quel téléphone → replay en même temps sur les deux**, chacun rejouant **son propre angle** au même instant, contrôles synchronisés (pause, vitesse, image par image, position). Aucune vidéo ne circule entre téléphones.

---

## 1. Architecture

```
temoin-poc-replay/
├── CLAUDE.md                 # Point d'entrée pour Claude Code (importe docs/)
├── README.md
├── docs/                     # Projet, plan, conventions, guides
├── app/                      # Application Expo (dev build)
│   └── src/
│       ├── app/              # Écrans (expo-router)
│       │   ├── index.tsx     # Accueil : « Créer un match » (affiche QR) / « Rejoindre » (scanne QR)
│       │   ├── match.tsx     # Écran SCORE : caméra en fond + score + gros boutons + bouton VAR
│       │   └── replay.tsx    # Écran REPLAY : lecteur, x0,25 / x0,5, ◀ frame / frame ▶, zoom
│       ├── buffer/           # Brique 1
│       │   ├── SegmentRecorder.ts   # boucle start/stop d'enregistrement VisionCamera
│       │   ├── SegmentStore.ts      # liste des segments, suppression > 30 s, verrous pendant replay
│       │   └── useRollingBuffer.ts  # hook qui relie caméra + store
│       ├── replay/           # Brique 2
│       │   ├── ReplayPlayer.tsx     # react-native-video + enchaînement de segments
│       │   ├── useFrameStep.ts      # seek ± 1/fps
│       │   └── ZoomableView.tsx     # pinch + pan (gesture-handler + reanimated)
│       ├── score/            # Brique 3
│       │   ├── tennis.ts            # logique de score pure (points, jeux, sets, avantage)
│       │   ├── tennis.test.ts       # tests Jest
│       │   └── useScoreSync.ts      # client WebSocket + état « proposé / validé »
│       ├── pairing/          # QR : génération (react-native-qrcode-svg) + scan (code scanner VisionCamera)
│       └── diagnostics/      # overlay debug : fps réel, segments, Mo disque, batterie, latence VAR
├── server/                   # Relais Node (ws) : salles par matchId, état canonique du score
└── shared/protocol.ts        # Types des messages échangés (app + serveur)
```

Choix justifiables :
- **expo-router** : template Expo par défaut, 3 écrans suffisent.
- **Logique de score pure** (`tennis.ts`) séparée du réseau : testable sans téléphone.
- **Serveur qui garde l'état canonique** (pas un simple écho) : un téléphone qui se reconnecte récupère le score.

---

## 2. Stratégie du buffer de 30 s

### Principe : segments courts qui tournent, sur disque
On ne garde **aucune image en mémoire** (1 s de 1080p60 brut ≈ 370 Mo). On laisse l'encodeur matériel H.264 écrire des fichiers MP4 courts :

1. `camera.startRecording()` → au bout de **D = 5 s**, `stopRecording()` → le callback `onRecordingFinished` donne le chemin du fichier → on relance immédiatement `startRecording()`.
2. `SegmentStore` garde la liste `{ chemin, début, fin, durée }`. Dès que la fin d'un segment a plus de 30 s (+ une marge d'un segment), on le supprime (`expo-file-system`). En régime établi : **7 fichiers max** (~35 s), soit ~30–60 Mo selon le débit choisi → l'espace disque reste stable.
3. Fichiers dans le dossier cache de l'app, purgé au lancement (rien ne survit à une session).

### Appui sur VAR
1. On appelle `stopRecording()` sur le segment en cours → il est finalisé et contient l'instant de l'appui.
2. On **verrouille** les 2–3 derniers segments (le store ne les supprime pas pendant le replay).
3. On ouvre l'écran replay positionné ~5 s avant l'appui, en lisant les segments à la suite (passage automatique au segment précédent/suivant aux bords, timeline globale « −10 s … 0 s »).
4. L'enregistrement reprend en arrière-plan sur de nouveaux segments (le match continue). À la sortie du replay, on déverrouille et le nettoyage reprend.

### Le point faible connu : le trou entre deux segments
Entre `stop` et `start`, VisionCamera met quelques dizaines à quelques centaines de ms : ces images sont perdues. On le **mesure dès l'étape 4** (horodatage de fin d'un segment vs début du suivant). Pistes si c'est trop :
- segments plus longs (10 s → moins de trous, mais finalisation VAR identique) ;
- plan B : un petit module natif (AVAssetWriter sur iOS / MediaCodec + MediaMuxer sur Android) qui garde les **échantillons H.264 encodés** dans un tampon circulaire et n'écrit le MP4 qu'à l'appui sur VAR — zéro trou, mais du code natif. On ne le fait que si les mesures l'imposent.

---

## 3. Risques

| Risque | Pourquoi | Ce qu'on fait |
|---|---|---|
| **fps réel < 60** | Tous les capteurs n'offrent pas 60 fps à toutes les résolutions ; Android peut produire du fps variable ; la chauffe peut faire baisser le débit | Choisir le format avec `useCameraFormat({ fps: 60, videoResolution: 1280×720 })`, afficher le format retenu, vérifier sur un fichier enregistré (nombre d'images / durée). 720p60 vaut mieux que 1080p30 pour une balle de tennis. |
| **Trous entre segments** | Voir ci-dessus | Mesure, puis segments plus longs ou module natif. |
| **Latence VAR → image** | Finalisation du MP4 (~0,2–0,5 s) + navigation + chargement du lecteur | Mesurer appui → premier `onReadyForDisplay`. Objectif < 1,5 s. Préparer l'écran replay à l'avance si besoin. |
| **Image par image imprécise** | Le seek vise un temps, pas une frame ; reculer impose de repartir de la dernière image clé | Seek à ± 1/fps en pause, tolérance nulle ; régler un intervalle d'images clés court (≈ 1 s) si le recul est lent. |
| **Batterie / chauffe sur 1 h+** | Capteur + encodeur + écran allumés en continu | 720p plutôt que 4K, débit modéré, luminosité baissée, `expo-keep-awake` (sinon la caméra s'arrête en veille), journal batterie toutes les minutes (`expo-battery`), état thermique si dispo. Test d'endurance d'1 h dédié. |
| **App en arrière-plan** | iOS/Android coupent la caméra si l'app n'est plus au premier plan | Assumé pour le POC : l'écran reste allumé sur l'app. Le buffer redémarre proprement au retour. |
| **Réseau local** | Wi-Fi d'un club souvent absent/isolé entre clients | Pour le POC : même Wi-Fi que l'ordi. Reconnexion auto + état canonique côté serveur. |
| **Versions de libs** | VisionCamera / react-native-video évoluent vite avec la New Architecture | Vérifier la compatibilité avec la version d'Expo à l'étape 0, figer les versions. |

---

## 4. Étapes testables (chacune = un commit)

**Brique 0 — socle**
0. Projet Expo TypeScript + dev build installé sur le vrai téléphone, écran « hello ». *Test : l'app se lance sur le téléphone.*

**Brique 2 d'abord sur un clip unique (plus simple que le buffer)**
1. Aperçu caméra + choix du format 60 fps + overlay affichant résolution / fps retenus. *Test : on lit 60 fps à l'écran.*
2. Bouton « enregistrer 5 s » → lecture du fichier avec react-native-video. *Test : le clip se relit ; on vérifie son fps réel.*
3. Contrôles de replay sur ce clip : x0,25 / x0,5 / x1, pause, ◀ frame / frame ▶, pinch-zoom + déplacement. *Test : avancer/reculer d'une image fonctionne, le zoom est fluide.*

**Brique 1 — buffer circulaire**
4. Boucle de segments + `SegmentStore` + suppression > 30 s + overlay debug (nb fichiers, Mo, trou mesuré entre segments). *Test : 10 min d'enregistrement, disque stable, ≤ 7 fichiers.*
5. Bouton VAR : finalisation, verrouillage, replay enchaîné sur les derniers segments, reprise de l'enregistrement. *Test : on frappe dans ses mains, on appuie VAR, on retrouve le clap ; latence affichée.*
6. Test d'endurance 1 h : journal batterie / chauffe / fps. *Test : rapport chiffré pour le jury.* → décision : segments OK ou module natif.

**Brique 3 — score co-validé**
7. `tennis.ts` pur + tests Jest (15-30-40, égalité/avantage, jeux, tie-break, sets). *Test : `npm test` vert, sans téléphone.*
8. Serveur relais Node (`ws`) : salles, état canonique, protocole `shared/protocol.ts`. Un téléphone s'y connecte et affiche le score. *Test : un point marqué apparaît dans les logs serveur.*
9. Appairage QR (le téléphone témoin affiche `ws://IP:port` + `matchId`, l'autre scanne) + co-validation : un joueur propose « point pour X », le point n'est compté que quand l'autre valide (sinon refus / annulation). *Test : deux téléphones, même score en temps réel.*

**Synchro du replay entre deux angles**
10. Horloge commune : chaque téléphone estime son décalage avec le serveur (ping type NTP, plusieurs allers-retours). Le VAR est diffusé avec un instant `t_var` en temps serveur ; chaque téléphone le convertit dans son horloge et ouvre son replay au même instant. *Test : clap devant les deux téléphones, VAR, les deux écrans montrent le clap à quelques images près.*
11. Contrôles synchronisés : pause / vitesse / ◀ frame ▶ / position envoyés comme commandes, appliqués sur les deux lecteurs ; sortie du replay synchronisée. *Test : un joueur avance d'une image, l'autre écran suit.*

**Intégration**
12. Écran SCORE final (gros boutons, lisible de loin) avec caméra en fond + VAR → REPLAY → retour. *Test : un mini-match réel de quelques jeux.*

---

## Vérification
- Étapes 1–6 et 9–10 : sur vrai téléphone, chaque étape avec un critère observable (ci-dessus) et l'overlay de diagnostics.
- Étape 7 : tests Jest automatisés.
- Étape 8 : logs serveur + client.
- Pas d'étape suivante tant que la précédente n'est pas validée par toi ; commit à chaque étape qui fonctionne.

## Risque ajouté
- **Décalage d'horloge entre téléphones** : sans correction, les deux replays ne montrent pas le même instant. Mesure du décalage via le serveur ; précision visée ≈ 1–2 images.
