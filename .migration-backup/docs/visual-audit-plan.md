# Audit visuel et plan d'amelioration Tikchop

Date: 2026-05-05
Produit: Tikchop, application mobile-first pour vendeurs WhatsApp/TikTok

## Diagnostic rapide

Tikchop a maintenant une base plus moderne, mais l'impression globale reste inegale. Certaines surfaces sont premium, comme la landing, le dashboard vendeur et la boutique client. D'autres ecrans restent plus techniques, avec beaucoup de cartes, de champs, de statuts et de libelles qui demandent trop d'effort au vendeur.

Le probleme principal n'est plus seulement la couleur ou les formes. C'est le manque d'un design system unique, applique partout, avec une hierarchie claire pour les vendeurs peu techniques.

## Ce qui marche deja

- Le mobile est bien traite comme experience principale: bottom navigation, cartes larges, inputs tactiles, grands boutons.
- La boutique client est plus seduisante qu'avant: header sticky, hero commerce, panier en sheet, filtres horizontaux.
- Le dashboard vendeur commence a donner une impression produit moderne: hero sombre, statistiques simples, raccourcis clairs.
- La logique locale Abidjan est presente: livraison, paiement local, WhatsApp, livreur.
- Les icones lucide rendent les actions plus visibles que du texte seul.

## Points faibles prioritaires

### 1. Identite visuelle encore trop generique

Le vert/noir fonctionne, mais l'app ressemble encore parfois a un tableau de bord SaaS classique. Tikchop doit evoquer commerce mobile, WhatsApp, livraison locale, rapidite et confiance.

Problemes visibles:
- trop de surfaces blanches similaires;
- trop de cartes avec la meme presence visuelle;
- peu de signes propres a Tikchop hors logo texte;
- contrastes parfois tres forts noir/vert, parfois trop doux.

Direction:
- creer une signature Tikchop: vert profond, vert WhatsApp, jaune commerce, bleu livraison, neutres chauds;
- definir 3 niveaux de surface: fond app, surface standard, surface prioritaire;
- utiliser les accents seulement pour les actions importantes.

### 2. Navigation mobile pas encore assez intuitive pour vendeur debutant

La bottom nav existe, mais certains noms restent abstraits.

Problemes visibles:
- "Accueil", "Articles", "Publier", "Commandes", "Aide" ne racontent pas toujours le prochain geste;
- WhatsApp/support pourrait etre confondu avec client, bot, ou SAV;
- les vendeurs doivent comprendre seuls ou aller apres une commande.

Direction:
- renommer en langage action: "Aujourd'hui", "Articles", "Publier", "Commandes", "Assistant";
- ajouter un etat actif plus evident;
- rendre le bouton "Publier" visuellement central et constant;
- ajouter des micro-badges sur "Commandes" et "Assistant" quand il y a du travail.

### 3. Publication article trop dense pour le public cible

La page `add-product` est la cle du produit, mais elle reste chargee. Elle melange photo, IA, vocal, lot, details, liste, prix, taille et quantite dans un meme flux.

Problemes visibles:
- trop de modes visibles en meme temps;
- les cartes de lot deviennent longues et fatigantes;
- les champs prix/taille/quantite manquent d'une hierarchie emotionnelle;
- le vendeur peut hesiter entre manuel, lot et vocal;
- les messages IA ne sont pas encore assez rassurants.

Direction:
- transformer la page en assistant pas-a-pas plein ecran;
- premier ecran: "Choisis tes photos";
- deuxieme ecran: grille de validation avec photo + nom IA + prix obligatoire;
- vocal en bouton secondaire par article, pas en mode principal;
- prix en champ dominant, taille/quantite en chips rapides;
- barre sticky en bas: "Publier X articles".

### 4. Commandes: bon fond UX, mais presentation encore operationnelle

La page commandes a une logique utile: verifier, preparer, livrer. Mais elle peut encore ressembler a un outil interne alors que le vendeur doit savoir quoi faire sans reflechir.

Problemes visibles:
- "Verifier", "Preparer", "Livrer" sont bons, mais pas assez incarnes visuellement;
- les statuts restent proches d'un back-office;
- le detail de commande melange client, livreur, total, actions;
- les actions secondaires prennent parfois autant de place mentale que l'action principale.

Direction:
- afficher une "commande suivante" comme carte principale;
- utiliser une timeline simple: 1 verifier, 2 paquet pret, 3 livrer;
- separer clairement "Action maintenant" et "Infos";
- transformer les statuts en phrases: "A confirmer", "Paquet a faire", "Pret pour livreur", "Terminee";
- garder un gros bouton unique par etape.

### 5. Boutique client encore perfectible pour convertir

La boutique `/[slug]` est mieux, mais elle peut encore vendre davantage. Le client doit comprendre vite: produit, prix, livraison, paiement, panier.

Problemes visibles:
- le hero prend beaucoup de place et peut repousser les produits;
- les cartes produits manquent d'une ligne de confiance;
- le panier est clair mais peut etre plus rassurant;
- pas assez de preuve locale: "livraison Abidjan", "paiement Wave", "recu apres achat".

Direction:
- hero plus compact apres scroll;
- cartes produit avec badges: "Disponible", "Livraison", "Paiement local";
- panier avec total toujours visible;
- checkout en 3 blocs tres distincts: Livraison, Paiement, Confirmation;
- ajouter un etat "commande recue" plus beau avec recu telechargeable.

### 6. Design system fragile

Le CSS contient beaucoup de classes globales et plusieurs familles historiques: `marketing-*`, `tk-*`, `app-*`, `shop-*`. Cela rend les futures ameliorations moins propres.

Problemes visibles:
- composants visuels similaires recrees plusieurs fois;
- rayons, ombres, espacements et styles de boutons pas totalement uniformes;
- risque de regressions quand on modifie `globals.css`;
- difficile d'obtenir un rendu "Stitch exact" sans composants reutilisables.

Direction:
- creer une petite bibliotheque locale de composants UI;
- centraliser les tokens: couleur, rayon, ombre, hauteur bouton, typographie;
- limiter les classes marketing/app/shop aux layouts, pas aux composants de base.

## Plan d'amelioration

### Phase 1 - Harmonisation visible rapide

Objectif: donner tout de suite une impression plus premium et plus coherente.

Actions:
- definir une palette Tikchop officielle;
- harmoniser les rayons: 16px pour inputs, 20px pour cartes, 28px pour sheets/heros;
- creer 4 composants de base: `ActionButton`, `SurfaceCard`, `PageHeader`, `BottomSheet`;
- appliquer ces composants a dashboard, commandes, produits, publication;
- revoir la bottom nav mobile avec labels plus actionnels.

Livrable attendu:
- app plus coherent sur mobile;
- moins d'ecart visuel entre les pages;
- navigation plus claire pour un vendeur debutant.

### Phase 2 - Refonte publication article

Objectif: rendre la mise en ligne d'article ultra simple.

Actions:
- remplacer les modes visibles par un choix principal: "Ajouter avec photos";
- mettre "Vocal" comme aide contextuelle par article;
- afficher les articles en file de validation: photo, nom propose, prix, taille, quantite;
- utiliser des chips de taille: S, M, L, XL, 38, 39, 40, Autre;
- ajouter des steppers de quantite;
- afficher une progression: "3 photos analysees, 2 pretes";
- rendre le bouton final sticky: "Publier 2 articles";
- preparer l'etat IA: analyse en cours, nom propose, erreur simple.

Livrable attendu:
- un vendeur peut selectionner plusieurs photos et publier vite;
- le prix devient l'action principale;
- le vocal reste optionnel et non bloquant.

### Phase 3 - Refonte commandes et livraison

Objectif: transformer les commandes en checklist operationnelle.

Actions:
- creer un hero "Prochaine commande a traiter";
- separer les commandes par etape: Nouvelles, A preparer, A livrer, Terminees;
- refaire le detail commande comme une fiche livreur:
  - articles;
  - client;
  - adresse;
  - paiement;
  - action principale;
- rendre le partage livreur plus visuel avec liste de livreurs;
- ajouter un message client joli: prise en charge, livraison, recu.

Livrable attendu:
- le vendeur sait exactement quoi faire;
- le livreur recoit une fiche propre;
- la confusion "a traiter" vs "a preparer" disparait.

### Phase 4 - Refonte boutique client

Objectif: augmenter la confiance et la conversion.

Actions:
- hero plus court sur mobile, produits visibles plus vite;
- cartes produits plus fashion/commerce selon categorie;
- badges de confiance: "Stock", "Livraison Abidjan", "Paiement local";
- checkout plus rassurant avec recap toujours visible;
- apres commande: page/etat "Commande recue" avec lien recu;
- rendre le recu telechargeable visuellement coherent avec Tikchop.

Livrable attendu:
- le client comprend plus vite;
- le panier inspire confiance;
- la boutique donne une impression professionnelle.

### Phase 5 - Onboarding vendeur

Objectif: l'inscription doit etre simple, rassurante et vendeuse.

Actions:
- transformer l'onboarding en experience type assistant mobile;
- afficher la progression en haut;
- demander moins de choses par ecran;
- expliquer pourquoi chaque info est utile;
- mieux presenter la connexion WhatsApp par code;
- terminer par une page "Boutique prete" avec actions simples.

Livrable attendu:
- chaque vendeur cree son compte et sa boutique sans voir les autres;
- moins d'abandon pendant l'inscription;
- le vendeur comprend la valeur de Tikchop avant meme de publier.

## Priorite recommandee

1. Refonte publication article.
2. Refonte commandes/livraison.
3. Harmonisation design system.
4. Refonte boutique client.
5. Refonte onboarding.

La publication article doit passer en premier parce que c'est le moment ou Tikchop remplace le plus directement la methode actuelle du vendeur. Si cette page est simple, l'app devient credible.

## Definition du rendu cible

Tikchop doit donner cette impression:

- moderne sans etre complique;
- mobile avant desktop;
- vendeur, pas admin;
- confiance locale Abidjan;
- actions visibles meme pour quelqu'un qui lit peu;
- beaucoup de photos, peu de texte inutile;
- une action principale par ecran.

## Regles visuelles a appliquer partout

- Un seul CTA principal par ecran.
- Les boutons importants font au moins 56px de haut.
- Les champs critiques, surtout prix et telephone, doivent etre grands.
- Les cards ne doivent pas etre empilees dans d'autres cards.
- Les ecrans vendeur doivent utiliser des phrases d'action.
- Les etats vides doivent proposer une action concrete.
- Les erreurs doivent etre courtes et orienter vers la prochaine action.
- Les icones doivent aider a reconnaitre l'action, pas decorer.
- Le desktop doit elargir le contenu, pas inventer une experience differente.

## Checklist de validation mobile

- iPhone SE largeur 375px: pas de texte coupe.
- Android courant largeur 360px: bottom nav lisible.
- iPhone 15 largeur 393px: CTA visible sans scroll excessif.
- Desktop 1366px: layout propre, pas etire.
- Les modales/sheets ne depassent pas l'ecran.
- Les boutons principaux sont accessibles au pouce.
- Les images produit gardent un ratio stable.
- Les formulaires restent utilisables avec clavier ouvert.

## Risques a surveiller

- Trop d'effets visuels pourraient ralentir les petits telephones.
- Trop de couleurs pourraient rendre l'app moins serieuse.
- Trop d'informations sur la page publication peut ramener la confusion actuelle.
- La refonte doit rester compatible avec Supabase, Cloudinary, Gemini et n8n/Evolution.
- Les fichiers CSS globaux doivent etre reduits progressivement pour eviter les regressions.
