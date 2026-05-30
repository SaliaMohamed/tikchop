import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PROTECTED_ROUTES, LOGIN_REDIRECT, POST_LOGIN_REDIRECT } from "../constants";

export async function updateSession(request: NextRequest) {
  // Crée la réponse de base et le client Supabase SSR (cookie-based)
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Rafraîchit le cookie sur la réponse
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Récupère l'utilisateur depuis le cookie (ne pas utiliser getSession côté serveur)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const helper = {
    redirect: (path: string): NextResponse => {
      const url = request.nextUrl.clone();
      url.pathname = path;
      return NextResponse.redirect(url);
    },
  };

  // --- Route est-elle protégée ? ---
  const isProtectedRoute = PROTECTED_ROUTES.some((path) =>
    pathname === path || pathname.startsWith(`${path}/`)
  );

  // Route de login (pour éviter redirect loop)
  const isLoginRoute = pathname === LOGIN_REDIRECT;

  // 1. Utilisateur authentifié qui accède à la page de login → renvoyer au dashboard
  if (user && isLoginRoute) {
    return helper.redirect(POST_LOGIN_REDIRECT);
  }

  // 2. Utilisateur non authentifié sur une route protégée → renvoyer au login
  if (!user && isProtectedRoute) {
    // Mémorise la destination pour y revenir après connexion
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_REDIRECT;
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Dans tous les autres cas, laisser passer (rafraîchissement de session inclus)
  return response;
}
