"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { getDashboardData } from "./actions";
import { getSellerByOwner } from "./seller-actions";
import AppIcon3D from "./components/AppIcon3D";
import BrandLogo from "./components/BrandLogo";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import SetupResumeBanner from "./components/SetupResumeBanner";
import { clearActiveSeller, getSellerInitials, readActiveSeller, useActiveSeller, writeActiveSeller } from "./components/sellerContext";
import { supabase } from "../lib/supabase";
import { getSellerAccessToken } from "../lib/seller-auth-client";

const dashboardRoutes = new Set([
  "/dashboard",
  "/orders",
  "/messages",
  "/crm",
  "/products",
  "/add-product",
  "/delivery-settings",
  "/payment-settings",
  "/shop-info",
  "/social-sharing",
  "/whatsapp",
  "/setup",
  "/plus",
  "/account",
]);

const appEntryRoutes = new Set([
  "/login",
  "/signup",
  "/onboarding",
  "/account/update-password",
]);

const ACCOUNT_SYNC_TIMEOUT_MS = 10000;

const sellerNavGroups = [
  {
    title: "Travail du jour",
    items: [
      { href: "/dashboard", label: "Accueil", icon: "home" },
      { href: "/add-product", label: "Publier", icon: "plus" },
      { href: "/orders", label: "Ventes", icon: "orders" },
      { href: "/messages", label: "DJASSAMAN", icon: "messages", badge: "IA" },
    ],
  },
  {
    title: "Boutique",
    items: [
      { href: "/products", label: "Articles", icon: "products" },
      { href: "/shop-info", label: "Boutique", icon: "store" },
      { href: "/social-sharing", label: "Partager", icon: "sharing" },
      { href: "/crm", label: "DJASSAMAN", icon: "crm" },
      { href: "/delivery-settings", label: "Livraison", icon: "delivery" },
      { href: "/payment-settings", label: "Paiement", icon: "payment" },
      { href: "/plus", label: "Plus", icon: "settings" },
    ],
  },
];

const mobilePageMeta = {
  "/add-product": "Publier",
  "/products": "Articles",
  "/orders": "Ventes",
  "/messages": "DJASSAMAN",
  "/crm": "DJASSAMAN",
  "/setup": "DJASSAMAN",
  "/delivery-settings": "Livraison",
  "/payment-settings": "Paiement",
  "/shop-info": "Boutique",
  "/social-sharing": "Partager",
  "/plus": "Plus",
  "/account": "Profil",
};

function getMobilePageMeta(pathname) {
  return mobilePageMeta[pathname] || "Tikchop";
}

function accountSyncTimeout(promise, message = "Verification du compte trop longue.") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ACCOUNT_SYNC_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Récupère le nombre de commandes en attente pour le badge
function usePendingOrderCount(seller) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!seller?.slug) return;
    let alive = true;

    async function fetchCount() {
      try {
        const token = await getSellerAccessToken();
        const { getPendingOrdersCount } = await import("./actions");
        const pending = await getPendingOrdersCount(seller.slug, token);
        if (!alive) return;
        setCount(pending || 0);
      } catch {
        // silently ignore
      }
    }

    fetchCount();
    return () => { alive = false; };
  }, [seller?.slug]);

  return count;
}

export default function AppChrome({ children }) {
  const pathname = usePathname();
  const seller = useActiveSeller();
  const sellerInitials = getSellerInitials(seller);
  const showAdminChrome = pathname === "/admin" || pathname.startsWith("/admin/");
  const showSellerChrome = dashboardRoutes.has(pathname);
  const showMobileTopbar = showSellerChrome && pathname !== "/dashboard";
  const showMobileTabbar = showSellerChrome && pathname !== "/onboarding";
  const sellerWorkspaceClass = showSellerChrome ? "seller-workspace" : "";
  const showAppEntryChrome = appEntryRoutes.has(pathname);
  const mobileMeta = getMobilePageMeta(pathname);
  const publishActive = ["/add-product", "/products"].includes(pathname);
  const messagesActive = pathname === "/messages" || pathname === "/crm";
  const menuActive = ["/plus", "/delivery-settings", "/payment-settings", "/shop-info", "/social-sharing", "/whatsapp", "/account"].includes(pathname);
  const pendingCount = usePendingOrderCount(showSellerChrome ? seller : null);

  if (showAdminChrome) {
    return <main className="admin-chrome">{children}</main>;
  }

  if (!showSellerChrome) {
    return (
      <>
        <main className={showAppEntryChrome ? "app-entry-chrome" : "container public-chrome"}>{children}</main>
        {!showAppEntryChrome && <PublicLegalFooter />}
      </>
    );
  }

  return (
    <SellerAccountGate>
      {showMobileTopbar && (
        <header className="mobile-seller-topbar">
          <Link href="/dashboard" className="mobile-seller-topbar-back" aria-label="Retour accueil vendeur">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF8F2] text-[#059669]">
              <ArrowLeft size={17} strokeWidth={1.6} />
            </span>
            <span className="hidden md:inline text-sm font-black text-[#0F2B20]/60">Accueil</span>
          </Link>
          <div className="mobile-seller-topbar-title" aria-label={`Page ${mobileMeta}`}>
            <strong className="tk-slide-down">{mobileMeta}</strong>
          </div>
          <Link href="/plus" className="mobile-seller-topbar-avatar relative overflow-hidden flex items-center justify-center" aria-label="Ouvrir le menu vendeur">
            {seller.logo_url ? (
              <Image src={seller.logo_url} alt="Logo" fill sizes="40px" className="object-cover" />
            ) : (
              sellerInitials
            )}
          </Link>
        </header>
      )}
      <nav className="navbar desktop-nav seller-desktop-topbar">
        <BrandLogo href="/dashboard" size="sm" />
        <div className="nav-links">
          <Link href="/dashboard" className="nav-link">Accueil</Link>
          <Link href="/add-product" className="nav-link">Publier</Link>
          <Link href="/products" className="nav-link">Articles</Link>
          <Link href="/orders" className="nav-link">Ventes</Link>
          <Link href="/messages" className="nav-link">DJASSAMAN</Link>
          <Link href="/plus" className="nav-link">Plus</Link>
        </div>
        <div className="seller-chip">
          <AppIcon3D app="store" size={17} />
          <span>{seller.name}</span>
        </div>
        <SignOutButton />
      </nav>
      <div className="seller-desktop-frame">
        <DesktopSellerSidebar seller={seller} sellerInitials={sellerInitials} pathname={pathname} />
        <main className={`container ${sellerWorkspaceClass} seller-desktop-main ${showMobileTopbar ? "seller-chrome-main" : ""}`}>
          {pathname !== "/setup" && <SetupResumeBanner />}
          {children}
        </main>
      </div>
      {showMobileTabbar && (
      <nav className="mobile-tabbar" aria-label="Navigation mobile">
        <Link href="/dashboard" className={`mobile-tabbar-item ${pathname === "/dashboard" ? "is-active" : ""}`}>
          <span className="mobile-tabbar-icon"><AppIcon3D app="home" size={16} /></span>
          <span>Accueil</span>
        </Link>
        <Link href="/orders" className={`mobile-tabbar-item ${pathname === "/orders" ? "is-active" : ""}`}>
          <span className="mobile-tabbar-icon relative">
            <AppIcon3D app="orders" size={16} />
            {pendingCount > 0 && (
              <span className="mobile-tabbar-badge">{pendingCount > 9 ? "9+" : pendingCount}</span>
            )}
          </span>
          <span>Ventes</span>
        </Link>
        <Link href="/add-product" className={`mobile-tabbar-action ${publishActive ? "is-active" : ""}`} aria-label="Publier un article">
          <span className="mobile-tabbar-icon"><AppIcon3D app="plus" size={20} /></span>
          <span>Publier</span>
        </Link>
        <Link href="/messages" className={`mobile-tabbar-item ${messagesActive ? "is-active" : ""}`}>
          <span className="mobile-tabbar-icon"><AppIcon3D app="messages" size={16} /></span>
          <span>DJASSAMAN</span>
        </Link>
          <Link href="/plus" className={`mobile-tabbar-item ${menuActive ? "is-active" : ""}`}>
            <span className="mobile-tabbar-icon"><AppIcon3D app="settings" size={16} /></span>
            <span>Plus</span>
          </Link>
      </nav>
      )}
      <PwaInstallPrompt />
    </SellerAccountGate>
  );
}

function DesktopSellerSidebar({ seller, sellerInitials, pathname }) {
  return (
    <aside className="seller-desktop-sidebar" aria-label="Navigation vendeur ordinateur">
      <div>
        <BrandLogo href="/dashboard" subtitle="Espace vendeur" size="lg" className="seller-desktop-brand" />

        <div className="seller-desktop-shop">
          <span className="seller-desktop-avatar relative overflow-hidden flex items-center justify-center">
            {seller.logo_url ? (
              <Image src={seller.logo_url} alt="Logo" fill sizes="56px" className="object-cover" />
            ) : (
              sellerInitials
            )}
          </span>
          <span className="min-w-0">
            <strong>{seller.name || "Boutique Tikchop"}</strong>
            <small>/{seller.slug || "boutique"}</small>
          </span>
        </div>

        <nav className="seller-desktop-links" aria-label="Pages vendeur">
          {sellerNavGroups.map((group) => (
            <div key={group.title} className="seller-desktop-link-group">
              <p className="seller-desktop-link-title">{group.title}</p>
              {group.items.map(({ href, label, icon, badge }) => (
                <Link key={href} href={href} className={`seller-desktop-link ${badge ? "is-critical" : ""} ${pathname === href ? "is-active" : ""}`}>
                  <AppIcon3D app={icon} size={18} />
                  <span>{label}</span>
                  {badge && <small className="seller-desktop-link-badge">{badge}</small>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className="seller-desktop-bottom">
        <Link href={seller.slug ? `/${seller.slug}` : "/onboarding"} className="seller-desktop-store-link">
          <AppIcon3D app="store" size={18} />
          Voir la boutique
        </Link>
        <SignOutButton />
      </div>
    </aside>
  );
}

function PublicLegalFooter() {
  return (
    <footer className="container mt-10 pb-8 text-center text-xs font-bold text-[#0F2B20]/40">
      <div className="mx-auto flex max-w-[520px] flex-wrap items-center justify-center gap-3 rounded-[20px] bg-[#F6FBF7] px-4 py-3 ring-1 ring-[#0F2B20]/10">
        <Link href="/mentions-legales" className="text-[#0F2B20]/60 no-underline hover:text-[#059669]">
          Mentions legales
        </Link>
        <span className="text-[#0F2B20]/20">|</span>
        <Link href="/confidentialite" className="text-[#0F2B20]/60 no-underline hover:text-[#059669]">
          Confidentialite
        </Link>
        <span className="text-[#0F2B20]/20">|</span>
        <Link href="/conditions" className="text-[#0F2B20]/60 no-underline hover:text-[#059669]">
          Conditions
        </Link>
      </div>
    </footer>
  );
}

function SellerAccountGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [clientReady, setClientReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("Verification de votre compte...");

  useEffect(() => {
    const timer = window.setTimeout(() => setClientReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let alive = true;

    async function syncSellerAccount() {
      const storedSeller = readActiveSeller();
      const canUseStoredSeller = Boolean(storedSeller.slug);

      if (canUseStoredSeller) {
        writeActiveSeller(storedSeller);
        if (alive) setChecking(false);
        return;
      }

      if (!supabase) {
        clearActiveSeller();
        router.replace("/login");
        return;
      }

      try {
        if (!canUseStoredSeller) setChecking(true);
        setMessage("Verification de votre compte...");
        const { data, error } = await accountSyncTimeout(
          supabase.auth.getSession(),
          "Session vendeur trop lente a verifier.",
        );
        if (error) throw error;

        const user = data.session?.user;
        if (!user) {
          clearActiveSeller();
          router.replace("/login");
          return;
        }

        setMessage("Chargement de la boutique...");
        const seller = await accountSyncTimeout(
          getSellerByOwner(user.id, data.session?.access_token),
          "Boutique trop longue a charger.",
        );
        if (seller) {
          writeActiveSeller(seller);
          if (alive) setChecking(false);
          return;
        }

        if (!canUseStoredSeller) {
          clearActiveSeller();
          router.replace("/onboarding?step=account");
        }
      } catch (error) {
        console.error("Seller account sync error:", error);
        const fallbackSeller = readActiveSeller();
        if (fallbackSeller.slug) {
          writeActiveSeller(fallbackSeller);
          if (alive) setChecking(false);
          return;
        }
        clearActiveSeller();
        router.replace("/login");
      }
    }

    syncSellerAccount();

    return () => {
      alive = false;
    };
  }, [pathname, router]);

  if (checking || !clientReady) {
    return (
      <main className="container">
        <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#0F2B20] shadow-[0_20px_48px_rgba(15, 43, 32,0.22)]">
            <span
              style={{ backgroundImage: "url('/icon.svg')" }}
              className="h-12 w-12 rounded-[14px] bg-center bg-cover bg-no-repeat"
              aria-hidden="true"
            />
          </div>
          <p className="mt-6 font-display text-lg font-black text-[#0F2B20]">{message}</p>
          <div className="mt-3 flex items-center justify-center gap-1.5" aria-label="Chargement en cours">
            <span className="tk-dot-1 h-2 w-2 rounded-full bg-[#059669]" />
            <span className="tk-dot-2 h-2 w-2 rounded-full bg-[#059669]" />
            <span className="tk-dot-3 h-2 w-2 rounded-full bg-[#059669]" />
          </div>
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
    window.location.href = "/login";
  }

  return (
    <button type="button" onClick={handleSignOut} className="app-icon-button" aria-label="Se deconnecter">
      <LogOut size={17} />
    </button>
  );
}
