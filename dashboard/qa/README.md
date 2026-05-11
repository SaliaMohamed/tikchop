# Tikchop QA

Objectif: figer des tests reproductibles au lieu de refaire des audits manuels sans fin.

## UI/UX avec Playwright

```powershell
$env:QA_BASE_URL="https://dashboard-l3negw2oa-saliamohamed05-8715s-projects.vercel.app"
npm.cmd run qa:ui
```

Ce test vérifie:
- mobile `/` redirige vers `/onboarding`
- création de compte affiche WhatsApp, mot de passe et Google
- login affiche Email et Google, sans étape onboarding
- desktop garde la page de présentation

## Backend/API avec Postman

```powershell
$env:base_url="https://dashboard-l3negw2oa-saliamohamed05-8715s-projects.vercel.app"
npm.cmd run qa:api -- --env-var "base_url=$env:base_url"
```

La collection Postman est dans `qa/postman/tikchop-api.postman_collection.json`.
Elle vérifie surtout les garde-fous publics: routes mobiles protégées, pages légales publiques, PDF reçu sans order rejeté.

## Charge légère avec k6

Installer k6 puis lancer:

```powershell
$env:QA_BASE_URL="https://dashboard-l3negw2oa-saliamohamed05-8715s-projects.vercel.app"
k6 run qa/k6/public-smoke.js
```

## Backend business complet

```powershell
npm.cmd run check:readiness
npm.cmd run smoke:beta
```

`smoke:beta` crée une boutique temporaire, ajoute produits, zone, livreur, commande, reçu HTML/PDF, puis nettoie.

## Outils IA externes

- Momentic: importer les scénarios depuis ce README et cibler `/onboarding`, `/login`, `/add-product`, `/orders`.
- BrowserStack: lancer `qa:ui` sur vrais iPhone/Android avec la preview Vercel.
- Sentry: activer après déploiement production pour capturer erreurs, lenteurs et Web Vitals.
