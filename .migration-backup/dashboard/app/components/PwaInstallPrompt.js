"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, MonitorDown, Share, Smartphone, X } from "lucide-react";

function getDeviceHelp(isIOS) {
  if (isIOS) {
    return {
      title: "Installer sur iPhone",
      body: "Depuis Safari, ajoute Tikchop à l'écran d'accueil sans App Store.",
      icon: <Share size={20} />,
    };
  }

  return {
    title: "Installer l'app gratuitement",
    body: "Ajoute Tikchop sur ton téléphone sans passer par les stores.",
    icon: <Download size={20} />,
  };
}

export default function PwaInstallPrompt({ variant = "floating" }) {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    window.setTimeout(() => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
      const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
      setInstalled(standalone);
      setIsIOS(ios);
      setDismissed(window.localStorage.getItem("tikchop-install-dismissed") === "1");
    }, 0);

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
      setDismissed(false);
    }

    function handleInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
      window.localStorage.setItem("tikchop-install-dismissed", "1");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const help = useMemo(() => getDeviceHelp(isIOS), [isIOS]);
  const showFull = variant === "page";
  const showFloating = variant === "floating" && !installed && !dismissed && pathname !== "/install";

  async function installApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  function dismiss() {
    setDismissed(true);
    window.localStorage.setItem("tikchop-install-dismissed", "1");
  }

  if (installed && !showFull) return null;
  if (!showFull && !showFloating) return null;

  if (showFull) {
    return (
      <section className="mx-auto max-w-[520px] px-4 py-8">
        <div className="rounded-[30px] bg-[var(--text-main)] p-5 text-white shadow-[var(--shadow-lg)]">
          <p className="quiet-label text-white/50">Alternative gratuite aux stores</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-10">Installer Tikchop</h1>
          <p className="mt-3 text-base font-semibold leading-6 text-white/70">
            {"Tikchop peut être installé comme une vraie application mobile depuis le navigateur. Aucun Play Store, aucun App Store et aucun paiement ne sont nécessaires pour l'installation."}
          </p>
          <button
            type="button"
            onClick={installApp}
            disabled={!deferredPrompt}
            className="mt-5 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[22px] bg-[var(--primary-bright)] text-base font-extrabold text-[var(--text-main)] disabled:bg-white/14 disabled:text-white/55"
          >
            <Download size={20} />
            {deferredPrompt ? "Installer maintenant" : isIOS ? "Ajouter depuis Safari" : "Ouvrir dans Chrome pour installer"}
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <InstallStep icon={<Smartphone size={20} />} title="Android" body="Ouvre Tikchop avec Chrome, puis appuie sur Installer. L'app apparaîtra sur l'écran d'accueil." />
          <InstallStep icon={<Share size={20} />} title="iPhone" body="Ouvre Tikchop avec Safari, touche Partager, puis choisis Sur l'écran d'accueil." />
          <InstallStep icon={<MonitorDown size={20} />} title="Ordinateur" body="Dans Chrome ou Edge, utilise l'icône Installer dans la barre d'adresse." />
        </div>

        <Link href="/onboarding" className="mt-5 flex min-h-[56px] items-center justify-center rounded-[20px] bg-white text-sm font-extrabold text-[var(--text-main)] no-underline shadow-[var(--shadow-sm)] ring-1 ring-[var(--line)]">
          Créer une boutique gratuite
        </Link>
      </section>
    );
  }

  return (
    <div className="fixed inset-x-3 bottom-[calc(5.9rem+env(safe-area-inset-bottom,0px))] z-[160] mx-auto max-w-[430px] rounded-[24px] border border-white/80 bg-white/94 p-3 shadow-[0_22px_58px_rgba(13,23,18,0.18)] backdrop-blur-2xl md:bottom-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--text-main)] text-[var(--primary-bright)]">
          {help.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[var(--text-main)]">{help.title}</p>
          <p className="mt-0.5 text-xs font-semibold leading-4 text-[var(--text-dim)]">{help.body}</p>
        </div>
        <button type="button" onClick={dismiss} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-dim)]" aria-label="Masquer">
          <X size={16} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={installApp}
          disabled={!deferredPrompt}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 text-sm font-extrabold text-white disabled:bg-[var(--surface-mid)] disabled:text-[var(--text-dim)]"
        >
          <Download size={17} />
          Installer
        </button>
        <Link href="/install" className="flex min-h-[48px] items-center justify-center rounded-2xl bg-[var(--surface-soft)] px-4 text-sm font-extrabold text-[var(--primary)] no-underline">
          Aide
        </Link>
      </div>
    </div>
  );
}

function InstallStep({ icon, title, body }) {
  return (
    <article className="rounded-[22px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="flex gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
          {icon}
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--text-main)]">{title}</h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-dim)]">{body}</p>
        </div>
      </div>
    </article>
  );
}
