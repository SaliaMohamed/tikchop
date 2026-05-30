# Tikchop - Fond propre open source

Tikchop utilise deja Cloudinary pour rendre les photos plus claires. Pour enlever le fond et poser l'article sur un fond neutre, l'app appelle un petit service open source base sur `rembg`.

## Variables Tikchop

Dans Vercel, ajouter :

```env
REMBG_API_URL=https://votre-service-rembg.example.com
REMBG_API_KEY=une-cle-longue-optionnelle
NEXT_PUBLIC_BACKGROUND_REMOVAL_ENABLED=true
```

Si `NEXT_PUBLIC_BACKGROUND_REMOVAL_ENABLED` n'est pas `true`, le bouton "Creer un fond propre" reste cache pour ne pas montrer une fonction non branchee aux vendeurs.

## Lancer le service localement

```powershell
cd "C:\Users\HP ELITEBOOK 840 G5\Pictures\tiktok chatbot\tools\rembg-service"
docker build -t tikchop-rembg .
docker run --rm -p 8080:8080 -e REMBG_API_KEY=dev-secret tikchop-rembg
```

Puis dans `.env.local` du dashboard :

```env
REMBG_API_URL=http://127.0.0.1:8080
REMBG_API_KEY=dev-secret
```

## VPS

Sur un VPS, exposer le service derriere HTTPS avec Nginx ou Caddy. Le service accepte :

- `POST /remove`
- champ fichier `image`
- champ `background`: `warm`, `white`, `gray`, `transparent`
- header optionnel `x-api-key`

## Strategie produit

- Garder l'original.
- Garder la version Cloudinary "Photo claire".
- Generer "Fond propre" seulement quand le vendeur le demande.
- Ne pas l'appliquer automatiquement a toutes les images pour eviter les erreurs sur les articles difficiles.
