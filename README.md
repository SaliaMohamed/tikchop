# Tikchop 🛍️

> Mini-boutiques mobiles pour vendeurs TikTok, Instagram et WhatsApp — Côte d'Ivoire

Tikchop permet à des vendeurs de créer une boutique en ligne en quelques minutes, de recevoir des commandes WhatsApp automatisées, et de gérer leurs stocks, livraisons et paiements depuis un dashboard mobile.

---

## Stack technique

| Couche | Techno |
|---|---|
| **Frontend / Dashboard** | Next.js 16 (App Router) + React 19 |
| **Styling** | Tailwind CSS 4 + CSS Variables (design system) |
| **Base de données** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (cookie HttpOnly via `@supabase/ssr`) |
| **Upload images** | Cloudinary |
| **Paiements** | Paystack (Wave, Orange Money, MTN MoMo, Djamo) |
| **WhatsApp** | Evolution API + WAHA |
| **Automation** | n8n (workflows chatbot) |
| **IA vision** | Gemini Flash (analyse automatique des photos produit) |
| **Déploiement** | Vercel |

---

## Structure du projet

```
tikchop/
├── dashboard/          # App Next.js principale (PWA vendeur)
│   ├── app/            # Pages et routes (App Router)
│   ├── components/     # Composants UI réutilisables
│   ├── lib/            # Utilitaires, clients API (supabase, paystack, evolution…)
│   ├── hooks/          # React hooks custom
│   ├── scripts/        # Scripts QA et tests CLI
│   └── public/         # Assets statiques
├── n8n-workflows/      # Workflows chatbot WhatsApp (JSON versionnés)
├── tools/              # Scripts utilitaires (build workflow, rembg)
├── mobile/             # App Android native (en pause)
├── docs/               # Documentation architecture et décisions
├── deployment/         # Config déploiement WAHA
└── dashboard/supabase-migrations/   # Source de vérité du schéma (voir section Base de données)
```

---

## Démarrage local

### Prérequis

- Node.js 20+
- npm 10+

### Installation

```bash
# 1. Cloner le repo
git clone https://github.com/VOTRE_USERNAME/tikchop.git
cd tikchop/dashboard

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env.local
# → Remplir .env.local avec les vraies valeurs (voir section Variables)

# 4. Lancer le serveur de dev
npm run dev
# → http://localhost:3000
```

---

## Variables d'environnement

Copier `.env.example` en `.env.local` et remplir les valeurs :

```env
# Supabase (obligatoire)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Uniquement pour scripts serveur, jamais exposé au navigateur

# Cloudinary (upload images produit)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_URL=

# n8n (automation WhatsApp)
N8N_URL=
N8N_API_KEY=

# Evolution API (WhatsApp)
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
N8N_TIKCHOP_EVOLUTION_WEBHOOK_URL=

# Paystack (paiements)
PAYSTACK_SECRET_KEY=
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
NEXT_PUBLIC_TIKCHOP_ONLINE_PAYMENTS_ENABLED=false

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# IA vision (analyse photos)
GEMINI_API_KEY=
GEMINI_VISION_MODEL=gemini-flash-latest
AI_VISION_PROVIDER=gemini,openrouter,openai
```

> ⚠️ Ne jamais committer `.env.local` — il est dans `.gitignore`.

---

## Commandes utiles

```bash
npm run dev                    # Serveur de développement
npm run build                  # Build production
npm run lint                   # ESLint
npm run typecheck              # Type-check TypeScript (tsc --noEmit)
npm run check:readiness        # Vérifie que tous les services sont configurés
npm run check:seller-isolation # Teste l'isolation multi-vendeur
npm run check:whatsapp-stack   # Vérifie Evolution API + WAHA
npm run smoke:beta             # Smoke test complet
npm run qa:ui                  # Tests UI Playwright
npm run qa:all                 # Tout : lint + build + checks + smoke + qa
```

---

## Architecture clé

### Multi-tenant
Chaque vendeur possède un `slug` unique et un `owner_user_id` lié à Supabase Auth.
Toute action serveur passe par `requireSellerUser()` + vérification `owner_user_id` — aucun vendeur ne peut accéder aux données d'un autre.

### Parcours vendeur
1. **Onboarding** `/onboarding` — création compte + boutique
2. **Dashboard** `/dashboard` — stats, QR WhatsApp, raccourcis
3. **Produits** `/products` + `/add-product` — catalogue avec photos IA
4. **Commandes** `/orders` — gestion et partage livreur
5. **Boutique publique** `/[slug]` — page client partageable
6. **Installation PWA** `/install` — sans App Store ni Play Store

### Chatbot WhatsApp
Les workflows n8n (dans `/n8n-workflows`) traitent les messages entrants via Evolution API.
Le client envoie `wa.me/?text=PRODUIT_ID` → n8n détecte la référence → répond automatiquement avec prix, stock et lien de paiement.

---

## Base de données

**La source de vérité du schéma est `dashboard/supabase-migrations/`** (23 migrations
ordonnées + `APPLY_IN_SUPABASE_SQL_EDITOR.sql`, le patch live idempotent).

> ⚠️ `schema.sql` à la racine est un **bootstrap historique obsolète** (RLS désuète,
> tables manquantes). Ne pas l'utiliser comme référence ; un nouveau projet doit
> rejouer `schema.sql` **puis** `APPLY_IN_SUPABASE_SQL_EDITOR.sql`.

Tables principales :

| Table | Rôle |
|---|---|
| `sellers` | Vendeurs (slug, WhatsApp, config bot, paiements, owner_user_id) |
| `products` | Produits (nom, prix, stock, images, variantes, visibilité) |
| `orders` | Commandes (client, produits, statut, livraison, Paystack) |
| `delivery_zones` / `delivery_drivers` | Livraison par vendeur |
| `messages` | Messages WhatsApp (avec dedup par external_message_id) |

---

## Déploiement

Le dashboard est déployé sur **Vercel** (connecté au repo GitHub).
Chaque push sur `main` déclenche un déploiement automatique.

URL production : `https://dashboard-mu-blue-xduynfs3jo.vercel.app`

---

## État du projet

- ✅ Dashboard vendeur (mobile-first PWA)
- ✅ Boutique publique client
- ✅ Commandes WhatsApp automatisées (n8n)
- ✅ Paiements Paystack (Wave, Orange Money, MTN, Djamo)
- ✅ Upload photos + analyse IA (Gemini)
- ✅ Multi-vendeur sécurisé
- ⏸️ App Android native (mise en pause, dossier `mobile/`)
