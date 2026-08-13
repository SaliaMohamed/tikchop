# Workflows n8n Tikchop

Workflows versionnés pour l'automatisation WhatsApp et les paiements.

## Fichiers actifs

| Fichier | Rôle |
|---|---|
| `tikchop_sales_bot_evolution.json` | Bot de vente principal (Evolution API) |
| `tikchop_sales_bot_v2.json` | Source WAHA → régénérer Evolution via `node tools/build_evolution_workflow.js` |
| `order_link_processor.json` | Liaison commande web ↔ WhatsApp |
| `paystack_webhook.json` | Validation paiement Paystack |

## Documentation

- `n8n_architecture.md` — architecture des workflows
- `evolution_api_antigravity_brief.md` — brief Evolution API

## Backups

Les exports ponctuels vont dans `backups/`.

## Ne pas committer

Réponses API n8n, dumps de schéma Supabase, listes de credentials — voir `.gitignore`.
