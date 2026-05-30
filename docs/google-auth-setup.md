# Tikchop - Google sign in setup

Google sign in is wired in the app, but it must stay hidden until Supabase has a valid Google OAuth client.

## URLs

Production app URL:

```text
https://dashboard-mu-blue-xduynfs3jo.vercel.app
```

Tikchop OAuth callback route:

```text
https://dashboard-mu-blue-xduynfs3jo.vercel.app/auth/callback
```

Supabase project callback URL to add in Google:

```text
https://suhqntkvldwzrzaidnsw.supabase.co/auth/v1/callback
```

## Google Cloud

Create an OAuth client:

- Application type: Web application
- Authorized JavaScript origin:

```text
https://dashboard-mu-blue-xduynfs3jo.vercel.app
```

- Authorized redirect URI:

```text
https://suhqntkvldwzrzaidnsw.supabase.co/auth/v1/callback
```

Keep the Client ID and Client Secret.

## Supabase

In Supabase Dashboard:

- Auth
- Sign In / Providers
- Google
- Enable Google
- Paste Client ID
- Paste Client Secret
- Save

In Auth URL Configuration, allow:

```text
https://dashboard-mu-blue-xduynfs3jo.vercel.app/auth/callback
https://dashboard-mu-blue-xduynfs3jo.vercel.app/onboarding
https://dashboard-mu-blue-xduynfs3jo.vercel.app/dashboard
http://localhost:3001/auth/callback
http://localhost:3001/onboarding
```

## Vercel

Only after Supabase Google provider is saved, enable the button:

```text
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
```

Then redeploy production.
