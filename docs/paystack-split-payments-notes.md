# Tikchop - Notes d'integration paiements vendeurs

Date: 2026-05-17

## Decision d'architecture

Tikchop garde les tables existantes:

- `public.sellers` pour les boutiques/vendeurs
- `public.orders` pour les commandes

On ne cree pas `profiles_vendedores` ni `commandes`, afin d'eviter deux sources de verite.

## Colonnes ajoutees

Migration locale:

`dashboard/supabase-migrations/2026-05-17-paystack-seller-payouts.sql`

Principaux champs:

- `sellers.payout_network`
- `sellers.payout_phone`
- `sellers.payout_bank_code`
- `sellers.payout_status`
- `sellers.paystack_subaccount_created_at`
- `sellers.subscription_active`
- `orders.paystack_split_subaccount_code`
- `orders.paystack_split_bearer`

## Paystack CI: points verifies

Sources officielles:

- Paystack Split Payments: https://paystack.com/docs/payments/split-payments/
- Paystack Subaccount API: https://paystack.com/docs/api/subaccount/
- Paystack API currency/XOF: https://paystack.com/docs/api/
- Paystack automated payouts: https://support.paystack.com/en/articles/2123586

Corrections importantes:

- Pour donner 0% a Tikchop sur la transaction article, le subaccount doit utiliser `percentage_charge: 0`.
- `percentage_charge` represente la part du compte principal, pas celle du vendeur.
- Pour XOF, Paystack demande quand meme de multiplier le montant par 100.
- Pour les sous-comptes CI, Tikchop garde le numero vendeur avec `225` en base, mais envoie a Paystack le numero local dans `account_number` (ex: `0701234567`). Paystack refuse le format `2250701234567` pour la creation de subaccount.
- Pour la Cote d'Ivoire, les paiements automatiques sont annonces comme regles apres environ 2 jours ouvrables, pas une garantie stricte J+1.
- Les frais peuvent etre portes par le compte principal ou le subaccount via `bearer`. Tikchop utilise `PAYSTACK_SPLIT_FEE_BEARER=account` par defaut pour garder la promesse "article au vendeur" aussi propre que possible.

## Codes banques detectes via List Banks avec `currency=XOF`

- Orange Money: `ORANGE_CI`
- MTN MoMo: `MTN_CI`
- Djamo: `CI202`
- Wave: pas detecte dans la liste subaccount au moment du test. L'option reste visible comme moyen client, mais le depot vendeur automatique passe en verification manuelle tant qu'un code officiel n'est pas confirme.

## UX vendeur

Nouvelle page:

`/payment-settings`

Nom visible:

`Reception argent`

Le mot "Paystack" reste volontairement absent de l'interface vendeur. Le vendeur choisit seulement le moyen de depot et le numero.
