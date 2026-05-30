# Brief Antigravity - Tikchop WhatsApp Evolution API

## Decision actuelle

On configure et teste d'abord Evolution API. WAHA sera traite ensuite.

Pour Evolution, on n'installe pas de node communautaire n8n pour le moment. Le workflow utilise:

- un Webhook n8n standard pour recevoir les evenements Evolution
- des HTTP Request pour appeler Evolution API

Raison: c'est plus simple a debugger, plus transparent, et il n'y a pas de dependance supplementaire dans n8n.

## Etat live actuel

Evolution API:

```text
https://evolution-tikchop.76.13.59.214.sslip.io
```

Evolution Manager:

```text
https://evolution-tikchop.76.13.59.214.sslip.io/manager-login
```

Identifiants manager-login:

```text
user: voir coffre/env serveur
password: voir coffre/env serveur
```

La page `/manager-login` configure le navigateur avec `apiUrl`, `token`, `version`, puis redirige vers `/manager`. Sans cette etape, le manager affiche souvent:

```text
The application is taking longer than expected to load, please try again in a few minutes.
```

## Workflow n8n Evolution

Workflow cree et actif:

```text
Tikchop Sales Bot V2 - Evolution API
```

ID:

```text
tkchopEvobd8516ea
```

Webhook production:

```text
POST https://n8n.sakamomo.tech/webhook/tikchop-evolution-whatsapp?seller=salia
```

Le webhook est bien en `POST`, actif, et enregistre dans n8n.

## Instance Evolution de test

Instance:

```text
salia-test
```

Statut actuel:

```text
connectionStatus: open
```

Webhook configure sur l'instance:

```text
https://n8n.sakamomo.tech/webhook/tikchop-evolution-whatsapp?seller=salia
```

Evenements configures:

```text
MESSAGES_UPSERT
CONNECTION_UPDATE
QRCODE_UPDATED
```

Reglages appliques:

```json
{
  "rejectCall": true,
  "msgCall": "Merci pour votre appel. Envoyez votre demande par message WhatsApp.",
  "groupsIgnore": true,
  "alwaysOnline": true,
  "readMessages": true,
  "readStatus": false,
  "syncFullHistory": false
}
```

## Flux attendu pour le test

```text
Client WhatsApp
-> Evolution instance salia-test
-> n8n webhook Tikchop Evolution
-> normalisation payload Evolution
-> identification vendeur par seller=salia
-> chargement catalogue Salia
-> IA Tikchop
-> HTTP Request Evolution sendText
-> reponse envoyee depuis le numero WhatsApp connecte a salia-test
```

Endpoint de reponse:

```text
POST https://evolution-tikchop.76.13.59.214.sslip.io/message/sendText/{instanceName}
```

Headers:

```text
apikey: EVOLUTION_API_KEY
Content-Type: application/json
```

Body:

```json
{
  "number": "{{ remoteJid ou numero client }}",
  "text": "{{ reponse IA }}"
}
```

Dans le workflow actuel, `number` vient de:

```text
$('Normalize Evolution Payload').item.json.body.payload.from
```

## Normalisation n8n

Le noeud `Normalize Evolution Payload` transforme le payload Evolution en forme compatible avec la logique Tikchop existante:

```json
{
  "source": "evolution",
  "event": "MESSAGES_UPSERT",
  "instanceName": "salia-test",
  "seller": "salia",
  "body": {
    "session": "salia-test",
    "payload": {
      "id": "...",
      "from": "client@s.whatsapp.net",
      "body": "message client",
      "hasMedia": false,
      "_data": {
        "notifyName": "Client"
      }
    }
  }
}
```

Le workflow traite maintenant aussi:

- `CONNECTION_UPDATE` pour mettre a jour le statut WhatsApp vendeur
- `MESSAGES_UPSERT` pour les messages clients et vendeurs

Le workflow ignore volontairement:

- `QRCODE_UPDATED`
- les messages `fromMe`
- les evenements sans texte utile

## Paiement vendeur et livraison Abidjan

Le bot ne doit plus proposer les paiements en dur. Il doit lire la configuration du vendeur depuis `sellers`:

```sql
accepted_payment_methods
default_payment_method
payout_network
payout_phone
payout_status
paystack_subaccount_code
delivery_payment_timing
fixed_delivery_fee
```

Et les zones depuis `delivery_zones`:

```sql
name
fee
is_active
```

Regle produit:

- proposer d'abord `default_payment_method`
- ne jamais proposer un moyen absent de `accepted_payment_methods`
- `CASH_ON_DELIVERY` = paiement apres reception, tres important pour Abidjan
- `WAVE`, `ORANGE_MONEY`, `MTN_MONEY` = paiement direct au numero vendeur si `payout_phone` existe
- `PAYSTACK` = "lien securise" uniquement, ne jamais dire Paystack au client
- toujours demander commune/quartier avant de confirmer les frais de livraison

Le workflow `tikchop_sales_bot_evolution.json` charge maintenant ces champs dans `Get Shop Info`, prepare `paymentText` et `deliveryText`, puis les injecte dans le prompt IA.

## Onboarding vendeur

Le QR seul ne suffit pas, car un vendeur ne peut pas scanner un QR affiche sur le meme telephone que son WhatsApp.

UX cible:

1. Le vendeur saisit son numero WhatsApp dans Tikchop.
2. Tikchop cree/connecte une instance Evolution avec le slug vendeur.
3. Tikchop appelle:

```text
GET /instance/connect/{instanceName}?number={phone}
```

4. Evolution retourne un `pairingCode`.
5. Tikchop affiche le code.
6. Le vendeur ouvre WhatsApp:

```text
Appareils connectes
-> Connecter un appareil
-> Connecter avec un numero de telephone
-> Entrer le code affiche
```

7. Le chatbot devient actif pour cette boutique.

Fallback: QR uniquement si le pairing code n'est pas disponible, avec instruction d'utiliser un deuxieme ecran.

## Dashboard Tikchop

Une action serveur a ete ajoutee:

```text
requestSellerWhatsAppPairing
```

Elle:

- cree l'instance Evolution si elle n'existe pas
- configure son webhook vers n8n
- connecte l'instance avec le numero vendeur
- retourne `pairingCode` et `qrBase64`

Variables serveur requises:

```text
EVOLUTION_API_URL=https://evolution-tikchop.76.13.59.214.sslip.io
EVOLUTION_API_KEY=<secret serveur>
N8N_TIKCHOP_EVOLUTION_WEBHOOK_URL=https://n8n.sakamomo.tech/webhook/tikchop-evolution-whatsapp
```

Ces variables doivent rester cote serveur. Ne pas exposer `EVOLUTION_API_KEY` au client.

## Interruption vendeur / pause bot

Tikchop peut maintenant reprendre la main sur une conversation depuis la page Commandes:

- bouton `Reprendre 24h` -> cree une ligne technique `human_pause` dans `public.messages`
- bouton `Envoyer moi-meme` -> envoie le message via Evolution et garde le bot en pause 24h
- bouton `Relancer le bot` -> supprime la pause

Le workflow n8n doit verifier ces lignes avant toute reponse automatique:

```sql
select id, contenu, created_at
from public.messages
where seller_slug in (:seller_slug, :instance_name)
  and customer_phone = :customer_phone
  and statut = 'human_pause'
  and created_at >= now() - interval '90 minutes'
order by created_at desc
limit 1;
```

Si une ligne existe et contient encore une pause active, n8n ne doit envoyer aucune reponse automatique. Cela permet au vendeur de discuter avec le client sans que le bot parle en meme temps.

## Choix WAHA vs Evolution

Etat actuel:

- Evolution est prioritaire pour le test multi-vendeur.
- WAHA sera teste ensuite.
- WAHA Core est limite a une seule session `default`.
- WAHA Plus peut gerer plusieurs sessions, mais c'est payant.
- Evolution est plus abordable pour tester le modele SaaS multi-boutique.

Decision finale a prendre apres test reel:

```text
Si Evolution repond correctement, on en fait le provider principal.
Si Evolution pose probleme en stabilite, on compare avec WAHA Plus.
```

## Comment tester maintenant

1. Verifier que `salia-test` est `open` dans Evolution Manager.
2. Depuis un autre numero WhatsApp, envoyer un message au numero connecte a `salia-test`.
3. Message exemple:

```text
Bonjour, je veux voir vos produits
```

4. La reponse doit arriver depuis le numero WhatsApp connecte a `salia-test`.

Important: le client recoit toujours la reponse depuis le numero WhatsApp du vendeur connecte a l'instance. Donc:

```text
message vers Salia -> reponse depuis le numero de Salia
message vers un autre vendeur -> reponse depuis l'instance de cet autre vendeur
```
