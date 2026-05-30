# Tikchop - PWA First

Decision du 2026-05-16: l'app native Android/iPhone est mise au placard pour l'instant. Toute l'energie produit part sur la PWA.

## Pourquoi

- Les vendeurs peuvent tester Tikchop sans passer par les stores.
- Les corrections UI/UX sont deployables vite sur Vercel.
- Le meme lien marche sur Android, iPhone et desktop.
- Le budget et le temps restent concentres sur le coeur: ajout d'articles, commandes, WhatsApp, livraison, paiement et recu.

## Priorites PWA

1. Onboarding mobile sans friction.
2. Ajout d'articles depuis la galerie, avec IA et mode vocal optionnel.
3. Commandes simples a traiter, partager au livreur, marquer comme livrees.
4. WhatsApp connecte, avec reprise manuelle possible par le vendeur.
5. PWA installable et claire sur Android Chrome et iPhone Safari.
6. Tests terrain avec vrais vendeurs avant toute reprise native.

## Ce qu'on evite pour l'instant

- APK, Play Store, App Store.
- Build Expo/Flutter prioritaire.
- Logique dupliquee entre web et mobile natif.
- Design ou navigation differents entre PWA et app native.

## Condition pour reprendre le natif

Reprendre l'app native seulement apres validation terrain de la PWA: vendeurs actifs, commandes reelles, parcours WhatsApp stable, et besoin clair que la PWA ne couvre pas.
