"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import BrandLogo from "./BrandLogo";

const INSTALL_DISMISSED_KEY = "tikchop-install-dismissed";
const INSTALL_SEEN_KEY = "tikchop-install-seen";

function getDeviceHelp(isIOS) {
  if (isIOS) {
    return {
      title: "Installer sur iPhone",
      body: "Depuis Safari, ajoutez la PWA Tikchop a l'ecran d'accueil.",
    };
  }

  return {
    title: "Installer la PWA",
    body: "Ajoutez Tikchop sur votre telephone depuis le navigateur.",
  };
}

export default function PwaInstallPrompt({ variant = "floating" }) {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [manualHelp, setManualHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then((registration) => {
          registration.update().catch(() => {});
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        })
        .catch(() => {});
    }

    function syncInstallState() {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
      const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
      const alreadyDismissed = window.localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
      const alreadySeen = window.localStorage.getItem(INSTALL_SEEN_KEY) === "1";
      setInstalled(standalone);
      setIsIOS(ios);
      setIsMobileViewport(window.matchMedia("(max-width: 767px)").matches);
      setDismissed(alreadyDismissed || alreadySeen);
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
    }

    function handleInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
      window.localStorage.setItem(INSTALL_SEEN_KEY, "1");
    }

    window.setTimeout(syncInstallState, 0);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("resize", syncInstallState);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("resize", syncInstallState);
    };
  }, []);

  const help = useMemo(() => getDeviceHelp(isIOS), [isIOS]);
  const showFull = variant === "page";
  const isSetupRoute = pathname === "/install"
    || pathname === "/onboarding"
    || pathname === "/login"
    || pathname?.startsWith("/account/");
  const showFloating = variant === "floating"
    && false
    && isMobileViewport
    && !installed
    && !dismissed
    && !isSetupRoute;

  useEffect(() => {
    if (!showFloating || typeof window === "undefined") return undefined;

    window.localStorage.setItem(INSTALL_SEEN_KEY, "1");
    const timer = window.setTimeout(() => {
      setDismissed(true);
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [showFloating]);

  async function installApp() {
    window.localStorage.setItem(INSTALL_SEEN_KEY, "1");
    if (!deferredPrompt) {
      setManualHelp(true);
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setDismissed(true);
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
  }

  function dismiss() {
    setDismissed(true);
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    window.localStorage.setItem(INSTALL_SEEN_KEY, "1");
  }

  if (installed && !showFull) return null;
  if (!showFull && !showFloating) return null;

  if (showFull) {
    return (
      <section className="mx-auto max-w-[520px] px-4 py-4">
        <div className="rounded-[28px] bg-[#2b2219] p-5 text-white shadow-[var(--shadow-lg)]">
          <BrandLogo size="sm" subtitle="App vendeur" className="text-white [&_.brand-logo-copy_small]:text-white/70 [&_.brand-logo-copy_strong]:text-white" />
          <p className="quiet-label mt-4 text-[var(--primary-bright)]">Priorite PWA</p>
          <h1 className="mt-2 font-display text-2xl font-bold leading-8">Installer Tikchop</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/86">
            Ajoutez Tikchop a l&apos;ecran d&apos;accueil. La vendeuse ouvre son espace comme une app, sans passer par les stores.
          </p>
          <button
            type="button"
            onClick={installApp}
            className="mt-5 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[22px] bg-[var(--primary-bright)] text-base font-extrabold text-[var(--text-main)]"
          >
            <Download size={20} />
            {deferredPrompt ? "Installer maintenant" : isIOS ? "Voir les etapes iPhone" : "Voir les etapes Android"}
          </button>
          {!deferredPrompt && (
            <p className="mt-3 rounded-2xl bg-white/10 p-3 text-sm font-semibold leading-5 text-white/82">
              Si le bouton automatique n&apos;apparait pas, suivez les cartes Android ou iPhone juste au-dessus.
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="fixed inset-x-4 bottom-[calc(5.8rem+env(safe-area-inset-bottom,0px))] z-[160] mx-auto max-w-[390px] rounded-[22px] border border-[rgba(0,108,73,0.14)] bg-white/96 p-3 shadow-[0_16px_40px_rgba(13,23,18,0.14)] backdrop-blur-2xl md:bottom-5">
      <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2">
        <span className="brand-logo-mark tk-logo-mark h-10 w-10 shrink-0 rounded-2xl" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-[var(--text-main)]">Installer ?</p>
          <p className="truncate text-xs font-bold text-[var(--text-dim)]">Optionnel.</p>
        </div>
        <button
          type="button"
          onClick={installApp}
          className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-2xl bg-[var(--primary)] px-3 text-xs font-extrabold text-white"
        >
          <Download size={15} />
          {deferredPrompt ? "Ajouter" : "Etapes"}
        </button>
        <button type="button" onClick={dismiss} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-dim)]" aria-label="Masquer">
          <X size={16} />
        </button>
      </div>
      {manualHelp && (
        <Link href="/install" className="mt-2 flex min-h-[38px] items-center justify-center rounded-2xl bg-[var(--surface-soft)] px-3 text-xs font-extrabold text-[var(--primary)] no-underline">
          Voir le guide complet
        </Link>
      )}
    </div>
  );
}
