# Architecture des Workflows n8n - TikTok Sellers

Ce document détaille la configuration exacte des nœuds pour les 3 flows principaux de l'automatisation. Vous pourrez recréer ces workflows dans votre instance n8n.

---

## Workflow 1 : Agent d'ajout de produit (Upload vocal/texte + Image)

**Objectif :** Permettre au vendeur d'envoyer une image et une note vocale (ou texte) sur WhatsApp pour ajouter automatiquement un produit à son catalogue.

### Nœuds :

1. **Webhook (Trigger)**
   - **Méthode :** POST
   - **Path :** `whatsapp-webhook`
   - **Rôle :** Reçoit le message entrant de Waha (WhatsApp API).

2. **Switch (Routeur)**
   - **Condition :** Vérifie si le numéro expéditeur appartient à un vendeur enregistré (requête Supabase préalable) ET s'il y a un média (image).
   - **Rôle :** Isole le flux "Ajout de produit" des autres messages.

3. **HTTP Request (Download Image)**
   - **URL :** Récupère l'image depuis l'URL temporaire de Waha.
   - **Rôle :** Télécharge le fichier image dans n8n.

4. **HTTP Request (Upload Cloudinary)**
   - **Méthode :** POST
   - **URL :** `https://api.cloudinary.com/v1_1/{votre_cloud_name}/image/upload`
   - **Body (Multipart-form) :** `file` (binary), `upload_preset` (votre preset).
   - **Rôle :** Stocke l'image et récupère une URL publique pérenne (`secure_url`).

5. **OpenAI / Whisper (Si vocal)**
   - **Nœud :** OpenAI (Audio Transcription)
   - **Entrée :** Le fichier audio WhatsApp.
   - **Rôle :** Transforme le vocal en texte brut (ex: "C'est une robe rouge à 15000 francs et j'en ai 10 en stock").

6. **OpenAI (Agent Parseur)**
   - **Prompt Système :** "Tu es un assistant d'extraction de données. Extrais le nom du produit, le prix en nombre, et la quantité en stock à partir du texte suivant. Renvoie UNIQUEMENT un JSON avec les clés : `name`, `price`, `stock_quantity`."
   - **Entrée :** Le texte transcrit (ou le texte brut du vendeur).

7. **Supabase (Insert)**
   - **Opération :** Insert
   - **Table :** `products`
   - **Données :** 
     - `seller_id`: L'ID du vendeur (identifié par son numéro de téléphone).
     - `name`: Extrait de l'étape 6.
     - `price`: Extrait de l'étape 6.
     - `stock_quantity`: Extrait de l'étape 6.
     - `image_url`: L'URL Cloudinary de l'étape 4.

8. **HTTP Request (Send WhatsApp via Waha)**
   - **Méthode :** POST
   - **URL :** `http://{votre_waha_url}/api/sendText`
   - **Body :** 
     ```json
     {
       "chatId": "{{ $json.expediteur }}@c.us",
       "text": "✅ Produit '{{ $json.name }}' ajouté avec succès. Prix : {{ $json.price }} FCFA. Lien : tonsite.com/{{ $json.seller_slug }}"
     }
     ```

---

## Workflow 2 : Liaison de commande (Client vient du site web)

**Objectif :** Faire le lien entre la commande `PENDING` créée sur le site web et le numéro de téléphone WhatsApp du client qui vient d'envoyer le message.

### Nœuds :

1. **Webhook (Trigger)**
   - **Rôle :** Reçoit le message WhatsApp entrant.

2. **If (Condition)**
   - **Condition :** Le texte contient `Ref Commande:`.
   - **Rôle :** Détecte qu'une commande a déjà été initiée sur le dashboard Next.js.

3. **Code (JavaScript)**
   - **Rôle :** Extrait la référence publique `order_ref` avec une regex : `/Ref Commande:\s*([A-Z0-9]{8})/i`.

4. **Supabase (Get/List)**
   - **Opération :** List
   - **Filtre :** `order_ref=eq.{{$json.ref}}`
   - **Rôle :** Retrouve la commande exacte dans Supabase sans caster l'UUID.

5. **Supabase (Update)**
   - **Table :** `orders`
   - **Données :** Met à jour `customer_phone` avec le numéro WhatsApp de l'expéditeur.
   - **Rôle :** "Lier" officiellement la commande au client.

6. **HTTP Request (Send WhatsApp via Waha)**
   - **Texte :** "Merci ! Votre commande {{ref}} a bien été reçue. Souhaitez-vous payer par Wave ou Paystack pour valider l'envoi ?"
   - **Rôle :** Confirmation immédiate et appel à l'action pour le paiement.

---

## Workflow 3 : Webhook Paystack (Validation paiement)

**Objectif :** Valider automatiquement la commande quand le client paie.

### Nœuds :

1. **Webhook (Trigger)**
   - **Méthode :** POST
   - **Path :** `paystack-webhook`

2. **If (Condition Event)**
   - **Condition :** `event === 'charge.success'`

3. **Supabase (Update)**
   - **Table :** `orders`
   - **Filtre :** L'ID de référence fourni à Paystack (qui correspond à `order.id`).
   - **Données :** `status: 'PAID'`

4. **Supabase (Update Stock)**
   - **Table :** `products`
   - **Opération :** Décrémenter le stock.

5. **HTTP Request (Notification Vendeur)**
   - **Texte :** "🎉 Nouvelle commande payée ! Le client (numéro Y) a payé X FCFA pour le produit Z."

6. **HTTP Request (Notification Client)**
   - **Texte :** "✅ Paiement reçu ! Votre commande est validée et sera expédiée bientôt. Merci de votre confiance."
