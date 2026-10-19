# Témoin · POC replay

Application mobile pour les matchs de tennis amateurs sans arbitre : les téléphones posés au bord du
terrain filment en continu et gardent les 30 dernières secondes. En cas de désaccord, « VAR » rejoue
le point au ralenti, image par image, sur tous les téléphones du match. Le score est co-validé par les
deux joueurs.

## Structure

| Dossier | Contenu |
|---|---|
| `app/` | Application Expo (React Native, TypeScript, development build) |
| `app/src/app/` | Écrans (expo-router) |
| `app/src/diagnostics/` | Mesures affichées en surimpression (fps réel, …) |
| `docs/` | Description du projet, plan par étapes, conventions, guides |
| `server/` *(à venir)* | Relais WebSocket Node pour synchroniser score et replay |
| `shared/` *(à venir)* | Types du protocole partagés entre l'app et le serveur |

## Documentation
- [Projet et contraintes](docs/projet.md)
- [Plan technique et étapes](docs/plan.md)
- [Lancer sur un iPhone](docs/lancer-sur-iphone.md)
- [Conventions Expo](docs/conventions-expo.md)

## État d'avancement
- [x] Étape 0 : socle Expo + development build
- [x] Étape 1 : caméra arrière plein écran à 60 fps, fps réel affiché *(à valider sur iPhone)*
- [ ] Étape 2 : enregistrer un clip et le relire
