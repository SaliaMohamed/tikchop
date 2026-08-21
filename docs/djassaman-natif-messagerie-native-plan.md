# Djassaman Natif — Messagerie native Tikchop (sans n8n, sans Evolution API)

> État : **Étude / Plan** — aucune modification de code.
> Date : 2026-08-21

---

## 1. Contexte & objectif

Le chatbot actuel ("djassaman") passe par **WhatsApp (Evolution API → n8n → Supabase)**.
Une partie des vendeurs n'a **pas sa clientèle sur WhatsApp** (clients à l'étranger,
sans WhatsApp, ou qui passent par TikTok/Instagram/la page publique), et le câblage
WhatsApp ajoute des dépendances externes (coût Evolution, risque de ban, latence n8n).

**Décision :** le **djassaman natif devient le canal standard** — une messagerie
intégrée à Tikchop, **sans n8n ni Evolution API**, où le client converse depuis la
boutique publique. Le **chatbot WhatsApp reste disponible en option premium**
(Evolution API + n8n conservés pour les vendeurs qui en ont besoin).

Fonctionnalités cibles (voir §4 pour le détail enrichi) :
- échange sur les produits vendus (catalogue, prix, stock) ;
- **analyse de captures d'écran** pour vérifier la disponibilité d'un produit ;
- **commande + paiement Paystack depuis le chat** ;
- **messages vocaux** (enregistrement + transcription) ;
- **pause du bot par le vendeur** pour répondre manuellement ;
- **fonctionnalités de vente et échange locaux** (négociation, échange produit,
  acompte, livraison locale, paiement à la livraison).

Contrainte : **pas d'intégration TikTok directe** — messagerie interne à Tikchop.

---

## 2. Audit de l'existant (ce qui se réutilise, ce qui bloque)

### 2.1 Réutilisable tel quel (sans n8n ni Evolution)

| Brique | Emplacement | Commentaire |
|---|---|---|
| Création de commande (validation stock, zones livraison, frais) | `dashboard/app/lib/actions/orders.js` (`createOrder`) | 100 % channel-agnostic |
| Paiement Paystack | `dashboard/lib/paystack.js`, `dashboard/lib/order-payments.js` | envoyé par le bot, idem natif |
| Lookup produits / stock | `dashboard/app/lib/actions/products.js` (`getSellerProducts`, `updateProduct`) | réutilisable |
| Vision IA (Gemini/OpenRouter/OpenAI) | `analyzeProductImage*` dans `products.js` | réutilisable pour les captures écran |
| Transcription audio (Gemini/OpenRouter) | parsing vocal dans `products.js` | réutilisable pour le vocal |
| UI messagerie vendeur | `dashboard/app/messages/page.js`, `components/ChatPanel.js`, `MessageBubble`, `MessageMedia` | existante mais **codée WhatsApp** (voir 2.2) |
| Pause/reprise bot | `pauseBotForCustomer` / `resumeBotForCustomer` (actions `orders.js`) + `handoff` | opère sur `messages`, réutilisable |
| Table `messages` | migrations `2026-05-08` / `2026-05-16` | à adapter (voir 3.1) |

### 2.2 Blocages — couplage WhatsApp (et dépendances externes)

1. **Clé client composite** : `messages.client` vaut
   `"<slug> : <name> : <phone>@s.whatsapp.net"`. Le parsing
   (`parseStoredMessageClient`, `normalizeStoredMessage`) et le sens in/out dérivé de
   `statut` supposent un numéro WhatsApp.
2. **Direction** : pas de colonne `sender` — le sens est inféré depuis `statut`
   (`in/bot/out/followup/human_pause`).
3. **Dépendances externes** : inbound + outbound passent par **Evolution API**, et
   l'orchestration IA par **n8n**. Pour le natif : plus aucun de ces appels.
4. **UI** : copies WhatsApp dures (`Connecter WhatsApp`, `tel:`, `Client WhatsApp`,
   suffixes `@s.whatsapp.net`). Refactor channel-agnostic nécessaire.

---

## 3. Architecture cible — 100 % natif (dans Tikchop)

### 3.1 Modèle de données — colonne `channel`

Ajouter `messages.channel text NOT NULL DEFAULT 'whatsapp'` (+ index
`(seller_slug, channel, created_at DESC)`).

- **`channel = 'native'`** : canal standard. Le client est identifié par un
  **`client_id`** (UUID généré côté client, `localStorage`, conservé par appareil) :

```
client          = "<slug> : <prénom client> : <client_id>@native"
customer_phone  = <client_id>   (colonne existante, réutilisée pour le natif)
external_message_id = <UUID émis par le client>  (réutilise le dedup existant)
```

- **`channel = 'whatsapp'`** : **premium** — comporte le câblage Evolution/n8n
  existant, inchangé, pour les vendeurs premium.

Option écartée : table `native_messages` séparée → dupliquerait dédup + UI.
**Colonne `channel` + parsing channel-aware** converge vers une UI unifiée.

> ⚠️ `normalizeStoredMessage` / `parseStoredMessageClient` (actions `shared.js`) doivent
> devenir channel-aware (le suffixe `@native` ne doit pas être traité comme un phone).

### 3.2 Parcours d'un message natif (inbound) — sans n8n

```
Client (boutique /[slug]/chat)
   │  texte / image (capture écran) / audio
   ▼
Route API du dashboard (ex. /api/chat/[slug]/send)   ← REÇOIT directement
   │  1. identifie seller par slug
   │  2. écrit le message : statut 'in', channel 'native', external_message_id
   │  3. déclenche le moteur natif (action serveur, voir 3.3)
   ▼
MOTEUR NATIF (server-side, in-process)               ← REMPLACE n8n
   │  historique + mémoire (table messages)
   │  catalogue produits + stock (getSellerProducts)
   │  agent IA Gemini/OpenRouter (fonctions : chercher produit,
   │    vérifier stock, créer commande, lancer paiement, suivre commande)
   │  média : image → vision (analyse capture écran), audio → transcription
   ▼
Réponse : INSERT statut 'bot' / 'followup' + Realtime → affichée chez le client
```

### 3.3 Moteur natif — orchestrateur IA in-process

Un nouveau module serveur (ex. `dashboard/lib/native-bot/`) avec :

| Composant | Rôle | Équivalent n8n |
|---|---|---|
| `runNativeBot({ seller, message, history })` | orchestration : décide action selon intent | `Router Ai` |
| Appel LLM **Gemini** (déjà utilisé dans `products.js`) | agent + fonctions (tool calling) | `OpenAI Chat Model` |
| Mémoire | historique depuis `messages` (last N) | `Postgres Chat Memory` |
| `nativeBotTools` | `search_product`, `check_stock`, `create_order`, `start_payment`, `track_order`, `check_delivery` | nodes n8n |
| Vision | `analyzeProductImage*` → vérif stock sur capture écran | `Analyze image` |
| Transcription | parsing vocal Gemini existant | `Transcribe Audio` |
| Livraison réponse | INSERT `statut 'bot'` + Realtime | `Envoyer Réponse` |
| Follow-up | `node-cron` / Edge Function Supabase + `schedule.followups` | `Wait Follow-up Window` |

### 3.4 Canal premium (WhatsApp) — conservé en option

- **Non inclus dans le socle natif** : aucun code Evolution/n8n exécuté pour le natif.
- **Premium** : les vendeurs abonnés gardent le chatbot WhatsApp actuel (Evolution + n8n)
  **en parallèle** avec le natif. Le sélecteur de canal (`channel`) les rend coexistants.
- Bascule tarifaire suggérée en §6.5.

### 3.5 Identification client (pas de numéro WhatsApp)

- À la première visite de `/[slug]/chat`, générer `tk_client_id` (UUID) en `localStorage`.
- Le bot demande **prénom + téléphone** en début de conversation (déjà le comportement
  actuel) pour que le vendeur connaisse son client.
- Continuité par appareil ; un même client sur plusieurs appareils = plusieurs
  conversations natives (limite assumée, une app sans compte).

---

## 4. Fonctionnalités — liste enrichie (vente & échange locaux)

### A. Messagerie & produits
| # | Fonctionnalité | Description |
|---|---|---|
| A1 | Chat produits | Le client discute depuis `/[slug]/chat` ; le bot répond sur le catalogue (nom, prix, stock). |
| A2 | Analyse de captures d'écran | Le client envoie une capture → vision IA → le bot vérifie si ce produit est dispo en stock et répond (oui/non + prix). |
| A3 | Recherche produit | Le bot cherche dans le catalogue par nom/mot-clé. |
| A4 | Fiche produit dans le chat | Image, prix, stock, lien de paiement directement dans la conversation. |
| A5 | Messages vocaux | Enregistrement micro client → upload → transcription → le bot répond (comme WhatsApp). |

### B. Vente & commande
| # | Fonctionnalité | Description |
|---|---|---|
| B1 | Commande depuis le chat | Le client commande dans le chat → `createOrder` (validation stock, zones, frais). |
| B2 | Paiement Paystack | Lien de paiement (Wave, Orange Money, MTN MoMo, Djamo) envoyé dans le chat. |
| B3 | Suivi de commande | Le client demande l'état de sa commande → le bot suit (livré, en cours, etc.). |
| B4 | **Paiement à la livraison** | Option "payer en arrivant" pour les ventes locales (pas de lien Paystack). |
| B5 | **Réservation / acompte** | Le client verse un acompte pour réserver un article ; solde à la livraison. |
| B6 | **Négociation de prix (marchandage)** | Le vendeur fixe un prix mini ; le bot négocie dans cette fourchette et confirme la remise. |

### C. Échange & vente locale
| # | Fonctionnalité | Description |
|---|---|---|
| C1 | **Échange de produit** | Le client propose un échange (produit + éventuelle différence) → le vendeur accepte/refuse dans le chat. |
| C2 | **Vente / reprise d'occasion** | Le client propose un article d'occasion à revendre → le vendeur valide, le bot ajoute au catalogue (avec vision pour l'état/prix suggéré). |
| C3 | **Livraison locale** | Auto-attribution au livreur local (réutilise `delivery_drivers` / `delivery_zones`) ; suivi dans le chat. |
| C4 | **Point de retrait** | Option retrait sur place / point relais selon les zones du vendeur. |
| C5 | Promotions & bons plans | Le bot annonce les promos/ruptures/arrivages aux clients actifs. |

### D. Contrôle vendeur & pilotage
| # | Fonctionnalité | Description |
|---|---|---|
| D1 | Pause / reprise du bot | Le vendeur met le bot en pause sur une conversation pour répondre lui-même (réutilise les handoffs) ; reprise à tout moment. |
| D2 | Réponse manuelle | Le vendeur répond dans le même thread natif (UI `/messages`). |
| D3 | Filtres & badges canal | L'UI `/messages` distingue conversations natives / WhatsApp. |
| D4 | Métriques de chat | Conversions : conversations natives, taux de réponse, commandes issues du chat. |
| D5 | Follow-up automatique | Relance 6 h après une commande sans paiement (comme le workflow actuel), réservée au natif. |

### E. Premium (WhatsApp — option)
| # | Fonctionnalité | Description |
|---|---|---|
| E1 | Chatbot WhatsApp complet | Câblage Evolution + n8n actuel, inchangé. |
| E2 | Multi-canal unifié | Le vendeur premium gère natif + WhatsApp dans `/messages`. |
| E3 | Broadcast WhatsApp | Annonces groupées aux clients WhatsApp. |
| E4 | OTP WhatsApp | Login par code 6 chiffres (existant, réservé aux vendeurs premium). |

---

## 5. Schéma de données — migration proposée

```sql
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp';

CREATE INDEX IF NOT EXISTS messages_seller_channel_created_idx
  ON public.messages (seller_slug, channel, created_at DESC);
```

Tables / colonnes nouvelles (phase 5, follow-up & métriques) :
```sql
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS client_name text;            -- prénom natif
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp';
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text;          -- cash_on_delivery / deposit / paystack
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'native'; -- native | premium
```

RPC existantes (`mark_processed`) : inchangées.

Refactor de code (sans migration) :
- `parseStoredMessageClient` / `normalizeStoredMessage` / `getMessagePhone` :
  channel-aware (ne pas parser `@native` comme un téléphone).
- `getSellerWhatsAppConversations` : filtrer/étiqueter par `channel`.

---

## 6. Plan d'implémentation par phases

| Phase | Contenu | Effort | Livrable |
|---|---|---|---|
| **0 — Fondations données** | Migration `channel` (+ `plan`, `client_name`) ; refactor parsing channel-aware ; constante `CHANNEL_NATIVE` | ~0,5 j | messages bicanal sûrs |
| **1 — Chat client natif (texte)** | Route `/api/chat/[slug]/send` ; page `/[slug]/chat` ; `tk_client_id` localStorage ; historique + polling 3 s ; réponses du bot en mode "menu rapide" (sans IA) | ~3 j | client discute en texte, bot basique |
| **2 — Moteur natif IA** | Module `lib/native-bot/` : agent Gemini (tool calling), mémoire, recherche produit, **commande + Paystack depuis le chat** | ~4 j | parité coeur du djassaman actuel |
| **3 — Vision & vocal** | **Capture écran → vérif stock** (Gemini vision) ; messages **vocaux** (Recorder + upload + transcription) | ~2,5 j | A2 + A5 |
| **4 — Vente & échange locaux** | Négociation de prix (B6), paiement à la livraison + acompte (B4/B5), **échange** (C1), **reprise occasion** (C2), livraison/retrait (C3/C4) | ~3,5 j | fonctions locales complètes |
| **5 — Contrôle vendeur & premium** | UI `/messages` bicanal (badges/filtres/pause natif) ; métriques (D4) ; follow-up natif (D5) ; badge premium + gates WhatsApp (E) | ~2,5 j | v1 stable + premium |
| **6 — Robustesse & finitions** | Realtime Supabase (remplacer polling) ; notifications ; partage `?chat=1` (QR) ; tests `qa:*` ; docs | ~2 j | v1 production |

**Total ≈ 18 jours-homme.** (le cœur natif — phases 0→3 — ≈ 10 j-h ; les fonctions
locales & premium ajoutent ~8 j-h.)

### Ordre conseillé
0 → 1 → 2 → 3 → 4 → 5 → 6. La **phase 2** est le cœur (parité IA). Les phases 4-5
peuvent être livrées en lots séparés.

---

## 7. Décisions clés & options écartées

1. **Moteur natif in-process** (sans n8n ni Evolution) — variante écartée :
   rebouclage sur n8n (parité immédiate mais 2 dépendances externes, latence, coût,
   2 moteurs à maintenir). Le natif est **la** solution, WhatsApp devient premium.
2. **Canal = colonne `channel`** (pas de table séparée) — convergence UI + dédup.
3. **Identité client = UUID localStorage** (sans compte) — variante écartée :
   OTP téléphone (lourd ; c'est le rôle premium WhatsApp).
4. **Temps réel v1 = polling 3 s** — Realtime Supabase en phase 6 (RLS + canal sur
   `messages`).
5. **Négociation de prix** : bornée par `sellers.min_price_pct` (ex. -20 % max), jamais
   en dessous du prix mini du vendeur — évite toute perte involontaire.

---

## 8. Risques & limites

| Risque | Impact | Mitigation |
|---|---|---|
| Client change d'appareil → conversation perdue (UUID local) | Moyen | Bot demande tél/prénom ; option future OTP/email |
| Moteur IA en code serveur = moins flexible que n8n (pas de canvas visuel) | Moyen | Modèle "tools" simple + tests ; migrations faciles de nouvelles fonctions |
| Latence LLM (Gemini) sur longue conversation | Moyen | Mémoire bornée (last N), température basse, tool calling strict |
| Realtime ouvert sur `messages` = risque RLS | Moyen | Restreindre à `channel='native'` + `seller_slug` ; sinon polling |
| Négociation mal configurée → remise excessive | Élevé si mal fait | Plancher `min_price_pct` obligatoire (décision 7.5) + test dédié |
| Coexistence natif / WhatsApp premium | Moyen | Phase 0 (channel) + tests `tests/` |
| Médias audio volumineux | Faible | Upload Cloudinary compressé |

---

## 9. Modèle économique (ébauche)

- **Socle natif (standard)** : gratuit/inclus — messagerie native complète (A, B, C, D).
- **Premium** : chatbot **WhatsApp** (E1-E4) — Evolution + n8n conservés, facturé en
  supplément mensuel. Le natif reste inclus.
- Bascule : champ `sellers.plan` (`native` | `premium`) → gates sur les pages
  WhatsApp (`/whatsapp`, OTP, broadcast).

---

## 10. Prochaines étapes

1. Valider **l'architecture sans n8n/Evolution** (§3) comme référence.
2. Valider la **liste de fonctionnalités** (§4) et prioriser A/B/C/D (le premium E se
   greffe sans toucher au natif).
3. Lancer la **Phase 0** (migration `channel` + refactor parsing) — socle sans risque.
4. Puis Phase 1 (chat texte) → Phase 2 (moteur IA) → Phase 3 (vision & vocal).