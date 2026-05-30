// Routes publiques (boutiques clients, onboarding, login)
// Toutes les autres routes nécessitent une session vendeur active.

export const PUBLIC_ROUTES = [
  '/',
  '/app',
  '/login',
  '/onboarding',
  '/signup',
  '/confidentialite',
  '/mentions-legales',
  '/conditions',
  '/install',
  '/receipt',
] as const;

// Routes protégées — accès réservé aux vendeurs authentifiés
export const PROTECTED_ROUTES = [
  '/dashboard',
  '/orders',
  '/products',
  '/add-product',
  '/delivery-settings',
  '/whatsapp',
  '/account',
  '/crm',
  '/shop',
  '/payment',
] as const;

// Route de connexion vers laquelle rediriger si non authentifié
export const LOGIN_REDIRECT = '/login';

// Route par défaut après connexion réussie
export const POST_LOGIN_REDIRECT = '/dashboard';

