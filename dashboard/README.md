# Tikchop

Tikchop est un MVP Next.js pour mini-boutiques de vendeurs TikTok, Instagram et WhatsApp.

## Parcours V1

- Dashboard vendeur: `/`
- Ajout produit simple: `/add-product`
- Boutique publique vendeur: `/[slug]`, exemple `/salia`
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
