"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bot, Camera, ClipboardList, Home, Loader2, LogOut, MessageCircle, Package, Plus, Settings2, Share2, Store, Truck, Wallet } from "lucide-react";
import { getSellerByOwner } from "./seller-actions";
import BrandLogo from "./components/BrandLogo";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import { clearActiveSeller, getSellerInitials, readActiveSeller, useActiveSeller, writeActiveSeller } from "./components/sellerContext";
import { supabase } from "../lib/supabase";

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
  "/app",
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
      { href: "/dashboard", label: "Accueil", icon: Home },
      { href: "/add-product", label: "Publier", icon: Camera },
      { href: "/orders", label: "Commandes", icon: ClipboardList },
      { href: "/messages", label: "Clients", icon: MessageCircle },
    ],
  },
  {
    title: "Boutique",
    items: [
      { href: "/products", label: "Articles", icon: Package },
      { href: "/shop-info", label: "Boutique", icon: Store },
      { href: "/social-sharing", label: "Partager", icon: Share2 },
      { href: "/whatsapp", label: "Assistant", icon: Bot, badge: "IA" },
      { href: "/delivery-settings", label: "Livraison", icon: Truck },
      { href: "/payment-settings", label: "Paiement", icon: Wallet },
      { href: "/app", label: "Plus", icon: Settings2 },
    ],
  },
];

const mobilePageMeta = {
  "/add-product": { title: "Publier", subtitle: "Photos et prix" },
  "/products": { title: "Articles", subtitle: "Stock et boutique" },
  "/orders": { title: "Commandes", subtitle: "A preparer et livrer" },
  "/messages": { title: "Clients", subtitle: "Lire et repondre" },
  "/crm": { title: "Clients", subtitle: "Relances simples" },
  "/whatsapp": { title: "WhatsApp", subtitle: "Assistant de vente" },
  "/delivery-settings": { title: "Livraison", subtitle: "Zones et livreurs" },
  "/payment-settings": { title: "Paiement", subtitle: "Choix vendeur" },
  "/shop-info": { title: "Boutique", subtitle: "Infos et bot" },
  "/social-sharing": { title: "Partager", subtitle: "Reseaux et boutique" },
  "/app": { title: "Plus", subtitle: "Boutique et reglages" },
};

function getMobilePageMeta(pathname) {
  return mobilePageMeta[pathname] || { title: "Tikchop", subtitle: "Espace vendeur" };
}

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
  const showAdminChrome = pathname === "/admin" || pathname.startsWith("/admin/");
  const showSellerChrome = dashboardRoutes.has(pathname);
  const showMobileTopbar = showSellerChrome && pathname !== "/dashboard";
  const showMobileTabbar = showSellerChrome && pathname !== "/onboarding";
  const sellerWorkspaceClass = showSellerChrome ? "seller-workspace" : "";
  const showAppEntryChrome = appEntryRoutes.has(pathname);
  const mobileMeta = getMobilePageMeta(pathname);
  const publishActive = ["/add-product", "/products"].includes(pathname);
  const messagesActive = pathname === "/messages" || pathname === "/crm";
  const menuActive = ["/app", "/delivery-settings", "/payment-settings", "/shop-info", "/social-sharing", "/whatsapp"].includes(pathname);

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
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">
              <ArrowLeft size={18} strokeWidth={2.35} />
            </span>
            <span className="hidden md:inline">Accueil</span>
          </Link>
          <div className="mobile-seller-topbar-title" aria-label={`Page ${mobileMeta.title}`}>
            <strong>{mobileMeta.title}</strong>
          </div>
          <Link href="/app" className="mobile-seller-topbar-avatar overflow-hidden flex items-center justify-center" aria-label="Ouvrir le menu vendeur">
            {seller.logo_url ? (
              <img src={seller.logo_url} alt="Logo" className="h-full w-full object-cover" />
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
          <Link href="/orders" className="nav-link">Commandes</Link>
          <Link href="/messages" className="nav-link">Clients</Link>
          <Link href="/app" className="nav-link">Plus</Link>
        </div>
        <div className="seller-chip">
          <Store size={15} className="mr-1.5" />
          <span>{seller.name}</span>
        </div>
        <SignOutButton />
      </nav>
      <div className="seller-desktop-frame">
        <DesktopSellerSidebar seller={seller} sellerInitials={sellerInitials} pathname={pathname} />
        <main className={`container ${sellerWorkspaceClass} seller-desktop-main ${showMobileTopbar ? "seller-chrome-main" : ""}`}>{children}</main>
      </div>
      {showMobileTabbar && (
      <nav className="mobile-tabbar" aria-label="Navigation mobile">
        <Link href="/dashboard" className={`mobile-tabbar-item ${pathname === "/dashboard" ? "is-active" : ""}`}>
          <span className="mobile-tabbar-icon"><Home size={19} strokeWidth={2.65} /></span>
          <span>Accueil</span>
        </Link>
        <Link href="/orders" className={`mobile-tabbar-item ${pathname === "/orders" ? "is-active" : ""}`}>
          <span className="mobile-tabbar-icon"><ClipboardList size={19} strokeWidth={2.65} /></span>
          <span>Ventes</span>
        </Link>
        <Link href="/add-product" className={`mobile-tabbar-action ${publishActive ? "is-active" : ""}`} aria-label="Publier un article">
          <span className="mobile-tabbar-icon"><Plus size={22} strokeWidth={2.75} /></span>
          <span>Publier</span>
        </Link>
        <Link href="/messages" className={`mobile-tabbar-item ${messagesActive ? "is-active" : ""}`}>
          <span className="mobile-tabbar-icon"><MessageCircle size={19} strokeWidth={2.65} /></span>
          <span>Clients</span>
        </Link>
          <Link href="/app" className={`mobile-tabbar-item ${menuActive ? "is-active" : ""}`}>
            <span className="mobile-tabbar-icon"><Settings2 size={19} strokeWidth={2.65} /></span>
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
          <span className="seller-desktop-avatar overflow-hidden flex items-center justify-center">
            {seller.logo_url ? (
              <img src={seller.logo_url} alt="Logo" className="h-full w-full object-cover" />
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
              {group.items.map(({ href, label, icon: Icon, badge }) => (
                <Link key={href} href={href} className={`seller-desktop-link ${badge ? "is-critical" : ""} ${pathname === href ? "is-active" : ""}`}>
                  <Icon size={18} />
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
          <Store size={18} />
          Voir la boutique
        </Link>
        <SignOutButton />
      </div>
    </aside>
  );
}

function PublicLegalFooter() {
  return (
    <footer className="container mt-10 pb-8 text-center text-xs font-bold text-[#07120d]/40">
      <div className="mx-auto flex max-w-[520px] flex-wrap items-center justify-center gap-3 rounded-[20px] bg-[#fbf9f4] px-4 py-3 ring-1 ring-[#07120d]/10">
        <Link href="/mentions-legales" className="text-[#07120d]/60 no-underline hover:text-[#008f5a]">
          Mentions legales
        </Link>
        <span className="text-[#07120d]/20">|</span>
        <Link href="/confidentialite" className="text-[#07120d]/60 no-underline hover:text-[#008f5a]">
          Confidentialite
        </Link>
        <span className="text-[#07120d]/20">|</span>
        <Link href="/conditions" className="text-[#07120d]/60 no-underline hover:text-[#008f5a]">
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
        <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#fbf9f4] text-[#008f5a] ring-1 ring-[#07120d]/5">
            <Loader2 className="animate-spin" size={26} />
          </div>
          <p className="mt-5 font-display text-2xl font-black text-[#07120d]">{message}</p>
          <p className="mt-2 max-w-[18rem] text-sm font-bold leading-5 text-[#07120d]/50">
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
    window.location.href = "/login";
  }

  return (
    <button type="button" onClick={handleSignOut} className="app-icon-button" aria-label="Se deconnecter">
      <LogOut size={17} />
    </button>
  );
}
