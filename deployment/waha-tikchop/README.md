# WAHA Tikchop

Instance WAHA separee pour les boutiques Tikchop.

Cette instance doit etre distincte de `https://sakawaha.online`, qui reste reservee a l'autre projet.

## Demarrage sur le VPS

```bash
mkdir -p /opt/tikchop/waha
cd /opt/tikchop/waha
cp .env.example .env
```

Modifier `.env` :

```bash
WAHA_PUBLIC_URL=https://waha-tikchop.76.13.59.214.sslip.io
WAHA_API_KEY=une-cle-longue-et-secrete
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=un-mot-de-passe-long
WHATSAPP_SWAGGER_USERNAME=admin
WHATSAPP_SWAGGER_PASSWORD=un-mot-de-passe-long
N8N_TIKCHOP_WEBHOOK_URL=https://n8n.sakamomo.tech/webhook/tikchop-whatsapp
```

Puis lancer :

```bash
docker compose up -d
```

## Principe

WAHA envoie tous les messages des sessions Tikchop vers le webhook global n8n.

Le champ `session` dans chaque evenement permet a n8n de retrouver le bon vendeur dans Supabase via `sellers.waha_session`.

Exemple :

```json
{
  "session": "salia",
  "payload": {
    "from": "221770000000@c.us",
    "body": "Bonjour"
  }
}
```

Si `sellers.waha_session = 'salia'`, n8n charge les produits de Salia et repond avec la session WAHA `salia`.
