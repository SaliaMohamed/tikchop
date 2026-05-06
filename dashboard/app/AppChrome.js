"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Camera, ClipboardList, Home, Loader2, LogOut, MessageCircle, Package, Store } from "lucide-react";
import { getSellerByOwner } from "./seller-actions";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import { clearActiveSeller, getSellerInitials, useActiveSeller, writeActiveSeller } from "./components/sellerContext";
import { supabase } from "../lib/supabase";

const dashboardRoutes = new Set([
  "/dashboard",
  "/orders",
  "/products",
  "/add-product",
  "/delivery-settings",
  "/whatsapp",
]);

export default function AppChrome({ children }) {
  const pathname = usePathname();
  const seller = useActiveSeller();
  const sellerInitials = getSellerInitials(seller);
  const showSellerChrome = dashboardRoutes.has(pathname);
  const showMobileTopbar = showSellerChrome && pathname !== "/dashboard";
  const showMobileTabbar = showSellerChrome && pathname !== "/add-product" && pathname !== "/onboarding";

  if (!showSellerChrome) {
    return (
      <>
        <main className="container public-chrome">{children}</main>
        {pathname !== "/" && <PwaInstallPrompt />}
      </>
    );
  }

  return (
    <SellerAccountGate>
      {showMobileTopbar && (
        <header className="mobile-seller-topbar">
          <div className="flex items-center gap-2 text-[var(--primary)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
              <Home size={19} strokeWidth={2.2} />
            </span>
          </div>
          <Link href="/dashboard" className="font-display text-xl font-bold text-[var(--primary)] no-underline">
            Tikchop
          </Link>
          <Link href={seller.slug ? `/${seller.slug}` : "/onboarding"} className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--outline)]/55 bg-[var(--surface-mid)] text-sm font-bold text-[var(--text-dim)] no-underline">
            {sellerInitials}
          </Link>
        </header>
      )}
      <nav className="navbar desktop-nav">
        <Link href="/dashboard" className="logo" aria-label="Accueil Tikchop">
          Tikchop
        </Link>
        <div className="nav-links">
          <Link href="/dashboard" className="nav-link">Accueil</Link>
          <Link href="/orders" className="nav-link">Commandes</Link>
          <Link href="/products" className="nav-link">Articles</Link>
          <Link href={seller.slug ? `/${seller.slug}` : "/onboarding"} className="nav-link">Boutique</Link>
          <Link href="/whatsapp" className="nav-link">Assistant</Link>
          <Link href="/delivery-settings" className="nav-link">Livraison</Link>
          <Link href="/add-product" className="nav-link">Publier</Link>
          <Link href="/onboarding" className="nav-link">Nouveau vendeur</Link>
        </div>
        <div className="seller-chip">
          <Store size={15} className="mr-1.5" />
          <span>{seller.name}</span>
        </div>
        <SignOutButton />
      </nav>
      <main className={`container ${showMobileTopbar ? "seller-chrome-main" : ""}`}>{children}</main>
      {showMobileTabbar && (
      <nav className="mobile-tabbar" aria-label="Navigation mobile">
        <Link href="/dashboard" className={`mobile-tabbar-item ${pathname === "/dashboard" ? "is-active" : ""}`}>
          <Home size={20} strokeWidth={2.2} />
          <span>Accueil</span>
        </Link>
        <Link href="/products" className={`mobile-tabbar-item ${pathname === "/products" ? "is-active" : ""}`}>
          <Package size={20} strokeWidth={2.2} />
          <span>Articles</span>
        </Link>
        <Link href="/add-product" className="mobile-tabbar-action" aria-label="Publier un article">
          <Camera size={24} strokeWidth={2.3} />
          <span>Publier</span>
        </Link>
        <Link href="/orders" className={`mobile-tabbar-item ${pathname === "/orders" ? "is-active" : ""}`}>
          <ClipboardList size={20} strokeWidth={2.2} />
          <span>Commandes</span>
        </Link>
        <Link href="/whatsapp" className={`mobile-tabbar-item ${pathname === "/whatsapp" ? "is-active" : ""}`}>
          <MessageCircle size={20} strokeWidth={2.2} />
          <span>Aide</span>
        </Link>
      </nav>
      )}
      <PwaInstallPrompt />
    </SellerAccountGate>
  );
}

function SellerAccountGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("Verification du compte vendeur...");

  useEffect(() => {
    let alive = true;

    async function syncSellerAccount() {
      if (!supabase) {
        setChecking(false);
        return;
      }

      try {
        setMessage("Verification du compte vendeur...");
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const user = data.session?.user;
        if (!user) {
          clearActiveSeller();
          router.replace("/onboarding");
          return;
        }

        setMessage("Chargement de la boutique...");
        const seller = await getSellerByOwner(user.id);
        if (seller) {
          writeActiveSeller(seller);
          if (alive) setChecking(false);
          return;
        }

        clearActiveSeller();
        router.replace("/onboarding");
      } catch (error) {
        console.error("Seller account sync error:", error);
        clearActiveSeller();
        router.replace("/onboarding");
      }
    }

    syncSellerAccount();

    return () => {
      alive = false;
    };
  }, [pathname, router]);

  if (checking) {
    return (
      <main className="container">
        <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
            <Loader2 className="animate-spin" size={24} />
          </div>
          <p className="mt-4 font-display text-xl font-bold text-[var(--text-main)]">{message}</p>
          <p className="mt-2 max-w-[18rem] text-sm font-semibold leading-5 text-[var(--text-dim)]">
            Chaque vendeur voit uniquement son espace Tikchop.
          </p>
        </div>
      </main>
    );
  }

  return children;
}

function SignOutButton() {
  async function handleSignOut() {
    clearActiveSeller();
    if (supabase) {
      await supabase.auth.signOut();
    }
    window.location.href = "/onboarding";
  }

  return (
    <button type="button" onClick={handleSignOut} className="app-icon-button" aria-label="Se deconnecter">
      <LogOut size={17} />
    </button>
  );
}
