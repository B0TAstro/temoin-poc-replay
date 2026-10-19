# Témoin · POC replay

## Le projet
Application mobile pour les matchs de tennis amateurs sans arbitre. Un téléphone posé au bord
du terrain filme en continu et garde les 30 dernières secondes. En cas de désaccord, un joueur
appuie sur « VAR » : le point s'affiche au ralenti, image par image, avec zoom, visible des deux
joueurs. L'app ne tranche jamais : ce sont les joueurs qui décident devant la même image.
Le score est tenu par l'app et validé par les deux joueurs.

## Objectif de ce POC
Vérifier trois briques techniques, rien de plus :
1. Buffer vidéo circulaire : garder en permanence les 30 dernières secondes, ne rien stocker au-delà
2. Replay : lecture au ralenti (x0,25 et x0,5), image par image (avance / recul d'une frame), zoom au pincement
3. Score co-validé : deux téléphones partagent le même score en temps réel, chaque point validé par les deux

## Stack
- React Native avec Expo en development build (pas Expo Go, à cause de la caméra)
- TypeScript
- Caméra : react-native-vision-camera, capture à 60 fps si l'appareil le permet
- Lecture vidéo : react-native-video
- Synchro du score : WebSocket ; pour le POC, un petit serveur relais Node sur mon ordinateur, sur le même Wi-Fi que les téléphones
- Appairage des deux téléphones par QR code

## Contraintes
- Tout le traitement vidéo reste en local sur le téléphone, aucune vidéo envoyée sur un serveur (RGPD)
- Supprimer les segments vidéo plus vieux que 30 secondes au fur et à mesure
- Surveiller batterie et chauffe : un match dure plus d'une heure
- Interface minimale : deux écrans (score, replay), gros boutons, lisible de loin
- Pas de détection ni d'IA dans ce POC

## Façon de travailler
- Propose un plan avant de coder, et attends ma validation
- Avance étape par étape, une brique à la fois, testable sur un vrai téléphone
- Explique tes choix techniques en quelques lignes, je dois pouvoir les justifier devant un jury
- Petits commits clairs à chaque étape qui fonctionne