"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, Package, PlusCircle, Settings } from "lucide-react";

const dashboardRoutes = new Set([
  "/",
  "/orders",
  "/products",
  "/add-product",
  "/delivery-settings",
]);

export default function AppChrome({ children }) {
  const pathname = usePathname();
  const showSellerChrome = dashboardRoutes.has(pathname);
  const showMobileTopbar = showSellerChrome && pathname !== "/";

  if (!showSellerChrome) {
    return <main className="container public-chrome">{children}</main>;
  }

  return (
    <>
      {showMobileTopbar && (
        <header className="mobile-seller-topbar">
          <div className="flex items-center gap-2 text-[var(--primary)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
              <LayoutDashboard size={19} strokeWidth={2.2} />
            </span>
          </div>
          <Link href="/" className="font-display text-xl font-bold text-[var(--primary)] no-underline">
            Tikchop
          </Link>
          <Link href="/salia" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--outline)]/55 bg-[var(--surface-mid)] text-sm font-bold text-[var(--text-dim)] no-underline">
            SA
          </Link>
        </header>
      )}
      <nav className="navbar desktop-nav">
        <Link href="/" className="logo" aria-label="Accueil Tikchop">
          Tikchop
        </Link>
        <div className="nav-links">
          <Link href="/" className="nav-link">Dashboard</Link>
          <Link href="/orders" className="nav-link">Commandes</Link>
          <Link href="/products" className="nav-link">Catalogue</Link>
          <Link href="/salia" className="nav-link">Boutique test</Link>
          <Link href="/delivery-settings" className="nav-link">Livraison</Link>
          <Link href="/add-product" className="nav-link">Ajouter</Link>
        </div>
        <div className="seller-chip">
          <span>Salia Boutique</span>
        </div>
      </nav>
      <main className={`container ${showMobileTopbar ? "seller-chrome-main" : ""}`}>{children}</main>
      <nav className="mobile-tabbar" aria-label="Navigation mobile">
        <Link href="/" className="mobile-tabbar-item">
          <LayoutDashboard size={20} strokeWidth={2.2} />
          <span>Tableau</span>
        </Link>
        <Link href="/products" className="mobile-tabbar-item">
          <Package size={20} strokeWidth={2.2} />
          <span>Produits</span>
        </Link>
        <Link href="/add-product" className="mobile-tabbar-action">
          <PlusCircle size={24} strokeWidth={2.3} />
          <span>Ajouter</span>
        </Link>
        <Link href="/orders" className="mobile-tabbar-item">
          <ClipboardList size={20} strokeWidth={2.2} />
          <span>Commandes</span>
        </Link>
        <Link href="/delivery-settings" className="mobile-tabbar-item">
          <Settings size={20} strokeWidth={2.2} />
          <span>Réglages</span>
        </Link>
      </nav>
    </>
  );
}
