# Tikchop

Tikchop est un MVP Next.js pour boutiques en ligne mobiles de vendeurs TikTok, Instagram et WhatsApp.

## Priorite produit

La version native Android/iPhone est mise au placard pour l'instant. Le produit principal est la PWA Tikchop:

- installation depuis Chrome ou Safari, sans Play Store ni App Store;
- experience mobile vendeur prioritaire;
- dashboard, ajout d'articles, commandes, WhatsApp et recus dans la meme web app;
- validation terrain plus rapide avant de relancer une app native.

## Parcours V1

- Dashboard vendeur: `/`
- Ajout produit simple: `/add-product`
- Boutique publique vendeur: `/[slug]`, exemple `/salia`
- Installation PWA: `/install`
- Commande WhatsApp: chaque produit ouvre `wa.me` avec une reference produit exploitable par n8n.

## Variables locales

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` sert uniquement au script `seed.js`; elle ne doit pas etre exposee au navigateur.

## Commandes

```bash
npm.cmd run dev
npm.cmd run lint
npm.cmd run build
node seed.js
```
