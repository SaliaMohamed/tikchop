"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Camera, ClipboardList, Home, Loader2, LogOut, Store } from "lucide-react";
import { getSellerByOwner } from "./seller-actions";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import { clearActiveSeller, getSellerInitials, readActiveSeller, useActiveSeller, writeActiveSeller } from "./components/sellerContext";
import { supabase } from "../lib/supabase";

const dashboardRoutes = new Set([
  "/dashboard",
  "/orders",
  "/crm",
  "/products",
  "/add-product",
  "/delivery-settings",
  "/whatsapp",
]);

const ACCOUNT_SYNC_TIMEOUT_MS = 10000;

function accountSyncTimeout(promise, message = "Verification du compte trop longue.") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ACCOUNT_SYNC_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export default function AppChrome({ children }) {
  const pathname = usePathname();
  const seller = useActiveSeller();
  const sellerInitials = getSellerInitials(seller);
  const showSellerChrome = dashboardRoutes.has(pathname);
  const showMobileTopbar = showSellerChrome && pathname !== "/dashboard";
  const showMobileTabbar = showSellerChrome && pathname !== "/add-product" && pathname !== "/onboarding";
  const sellerWorkspaceClass = showSellerChrome ? "seller-workspace" : "";

  if (!showSellerChrome) {
    return (
      <>
        <main className="container public-chrome">{children}</main>
        <PublicLegalFooter />
        <PwaInstallPrompt />
      </>
    );
  }

  return (
    <SellerAccountGate>
      {showMobileTopbar && (
        <header className="mobile-seller-topbar">
          <Link href="/dashboard" className="flex items-center gap-2 text-[var(--primary)]" aria-label="Retour espace vendeur">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
              <Home size={19} strokeWidth={2.2} />
            </span>
          </Link>
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
          <Link href="/add-product" className="nav-link">Ajouter articles</Link>
          <Link href="/orders" className="nav-link">Commandes</Link>
          <Link href="/whatsapp" className="nav-link">WhatsApp</Link>
          <Link href={seller.slug ? `/${seller.slug}` : "/onboarding"} className="nav-link">Boutique</Link>
        </div>
        <div className="seller-chip">
          <Store size={15} className="mr-1.5" />
          <span>{seller.name}</span>
        </div>
        <SignOutButton />
      </nav>
      <main className={`container ${sellerWorkspaceClass} ${showMobileTopbar ? "seller-chrome-main" : ""}`}>{children}</main>
      {showMobileTabbar && (
      <nav className="mobile-tabbar" aria-label="Navigation mobile">
        <Link href="/dashboard" className={`mobile-tabbar-item ${pathname === "/dashboard" ? "is-active" : ""}`}>
          <Home size={20} strokeWidth={2.2} />
          <span>Accueil</span>
        </Link>
        <Link href="/add-product" className="mobile-tabbar-action" aria-label="Publier un article">
          <Camera size={24} strokeWidth={2.3} />
          <span>Publier</span>
        </Link>
        <Link href="/orders" className={`mobile-tabbar-item ${pathname === "/orders" ? "is-active" : ""}`}>
          <ClipboardList size={20} strokeWidth={2.2} />
          <span>Commandes</span>
        </Link>
        <Link href={seller.slug ? `/${seller.slug}` : "/onboarding"} className="mobile-tabbar-item">
          <Store size={20} strokeWidth={2.2} />
          <span>Boutique</span>
        </Link>
      </nav>
      )}
      <PwaInstallPrompt />
    </SellerAccountGate>
  );
}

function PublicLegalFooter() {
  return (
    <footer className="container mt-10 pb-8 text-center text-xs font-bold text-zinc-500">
      <div className="mx-auto flex max-w-[520px] flex-wrap items-center justify-center gap-3 rounded-full bg-white/70 px-4 py-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.45)]">
        <Link href="/mentions-legales" className="text-zinc-600 no-underline hover:text-[var(--primary)]">
          Mentions legales
        </Link>
        <span className="text-zinc-300">|</span>
        <Link href="/confidentialite" className="text-zinc-600 no-underline hover:text-[var(--primary)]">
          Confidentialite
        </Link>
        <span className="text-zinc-300">|</span>
        <Link href="/conditions" className="text-zinc-600 no-underline hover:text-[var(--primary)]">
          Conditions
        </Link>
      </div>
    </footer>
  );
}

function SellerAccountGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeSeller = useActiveSeller();
  const hasLocalSeller = Boolean(activeSeller.slug);
  const [checking, setChecking] = useState(!hasLocalSeller);
  const [message, setMessage] = useState("Verification de votre compte...");

  useEffect(() => {
    let alive = true;

    async function syncSellerAccount() {
      function keepStoredSellerIfAvailable() {
        const storedSeller = readActiveSeller();
        if (!storedSeller.slug) return false;

        writeActiveSeller(storedSeller);
        if (alive) setChecking(false);
        return true;
      }

      if (!hasLocalSeller && keepStoredSellerIfAvailable()) {
        return;
      }

      if (!supabase) {
        setChecking(false);
        return;
      }

      try {
        if (!hasLocalSeller) {
          setChecking(true);
        }
        setMessage("Verification de votre compte...");
        const { data, error } = await accountSyncTimeout(
          supabase.auth.getSession(),
          "Session vendeur trop lente a verifier.",
        );
        if (error) throw error;

        const user = data.session?.user;
        if (!user) {
          if (hasLocalSeller) {
            if (alive) setChecking(false);
          } else {
            if (keepStoredSellerIfAvailable()) return;
            clearActiveSeller();
            router.replace("/onboarding");
          }
          return;
        }

        setMessage("Chargement de la boutique...");
        const seller = await accountSyncTimeout(
          getSellerByOwner(user.id),
          "Boutique trop longue a charger.",
        );
        if (seller) {
          writeActiveSeller(seller);
          if (alive) setChecking(false);
          return;
        }

        if (hasLocalSeller) {
          if (alive) setChecking(false);
          return;
        }

        if (keepStoredSellerIfAvailable()) return;
        clearActiveSeller();
        router.replace("/onboarding");
      } catch (error) {
        console.error("Seller account sync error:", error);
        if (!hasLocalSeller) {
          if (keepStoredSellerIfAvailable()) return;
          clearActiveSeller();
          router.replace("/onboarding");
        } else if (alive) {
          setChecking(false);
        }
      }
    }

    syncSellerAccount();

    return () => {
      alive = false;
    };
  }, [hasLocalSeller, pathname, router]);

  if (checking) {
    return (
      <main className="container">
        <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
            <Loader2 className="animate-spin" size={24} />
          </div>
          <p className="mt-4 font-display text-xl font-bold text-[var(--text-main)]">{message}</p>
          <p className="mt-2 max-w-[18rem] text-sm font-semibold leading-5 text-[var(--text-dim)]">
            Chaque boutique garde son propre espace Tikchop.
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
