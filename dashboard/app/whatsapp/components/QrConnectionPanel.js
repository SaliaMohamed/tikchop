"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  MessageCircle,
  MonitorSmartphone,
  Phone,
  PlugZap,
  Power,
  QrCode,
  RefreshCw,
  ScanLine,
  Smartphone,
} from "lucide-react";
import { formatPairingCode, getPairingValidityLabel } from "../../../lib/whatsapp-utils";
import TikchopLottie from "../../components/TikchopLottie";

function QrStep({ icon, title, text }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 rounded-2xl bg-[var(--surface-soft)] p-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[var(--primary)] shadow-sm">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-black text-[var(--text-main)]">{title}</span>
        <span className="mt-0.5 block text-xs font-bold leading-4 text-[var(--text-dim)]">{text}</span>
      </span>
    </div>
  );
}

export function QrConnectionPanel({
  pairing,
  qrSource,
  connection,
  whatsappNumber,
  phoneReady,
  busy,
  loading,
  watchingConnection,
  onConnect,
  onRefresh,
  onRefreshPairingCode,
  onPhoneChange,
  onPhoneBlur,
  onCopyPairingCode,
}) {
  const isConnected = Boolean(connection?.isConnected);
  const hasPairing = Boolean(pairing);
  const hasCode = Boolean(pairing?.pairingCode);
  const hasCodeOnlyPairing = pairing?.pairingMode === "code";

  return (
    <div className="mt-6 rounded-[28px] bg-white p-4 text-[var(--text-main)] shadow-[0_24px_60px_rgba(0,0,0,0.22)] ring-1 ring-white/40 md:mt-0 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="quiet-label text-[var(--primary)]">QR Evolution</p>
          <h2 className="mt-1 font-display text-2xl font-black leading-8 md:text-3xl">Connecter WhatsApp</h2>
        </div>
        {watchingConnection ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800">
            <Loader2 className="animate-spin" size={14} />
            Verification
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${isConnected ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-700"}`}>
            {isConnected ? <CheckCircle2 size={14} /> : <QrCode size={14} />}
            {isConnected ? "Connecte" : "Pret"}
          </span>
        )}
      </div>

      {!isConnected && (
        <div className="mt-5 rounded-[24px] bg-[#0F2B20] p-3 text-white shadow-[0_18px_38px_rgba(38, 30, 22,0.16)]">
          <label htmlFor="seller-whatsapp-number" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--primary-bright)]">
            <Phone size={15} />
            Numero WhatsApp vendeur
          </label>
          <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-2 rounded-[18px] bg-white px-3 py-2 text-[#0F2B20]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--primary)]">
              <Smartphone size={19} />
            </span>
            <input
              id="seller-whatsapp-number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={whatsappNumber}
              onChange={(event) => onPhoneChange(event.target.value)}
              onBlur={onPhoneBlur}
              placeholder="+225 07 00 00 00 00"
              className="min-h-12 w-full bg-transparent text-lg font-black tracking-normal outline-none placeholder:text-zinc-400"
            />
          </div>
          <p className="mt-2 text-xs font-bold leading-4 text-white/68">
            Le QR sera genere pour ce numero. Mets le numero WhatsApp que le vendeur utilise avec ses clients.
          </p>
          {!phoneReady && (
            <p className="mt-2 rounded-2xl bg-amber-100 px-3 py-2 text-xs font-black leading-4 text-amber-950">
              Entre le numero avant de generer le QR.
            </p>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px] lg:items-start">
        <div className="rounded-[24px] bg-[var(--surface-soft)] p-4">
          {isConnected ? (
            <div className="flex min-h-[270px] flex-col items-center justify-center text-center">
              <TikchopLottie name="success" size={150} />
              <h3 className="mt-2 font-display text-2xl font-black text-[var(--text-main)]">WhatsApp est connecte</h3>
              <p className="mt-2 max-w-sm text-sm font-semibold leading-5 text-[var(--text-dim)]">
                Tikchop peut maintenant recevoir les messages et vendre depuis ce numero.
              </p>
              <Link
                href="/messages"
                className="mt-5 flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-[#0A2319] px-5 text-sm font-black text-white no-underline"
              >
                <MessageCircle size={17} />
                Voir les discussions
              </Link>
            </div>
          ) : qrSource ? (
            <div className="flex flex-col items-center justify-center">
              <div className="rounded-[24px] bg-white p-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.6)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSource} alt="QR WhatsApp Evolution" className="h-[260px] w-[260px] max-w-full object-contain md:h-[310px] md:w-[310px]" />
              </div>
              <p className="mt-3 text-center text-sm font-black text-[var(--text-main)]">Scanne ce QR avec WhatsApp sur ton telephone.</p>
              <p className="mt-1 text-center text-xs font-bold leading-4 text-[var(--text-dim)]">Le QR expire vite. Regenerer si WhatsApp refuse.</p>
            </div>
          ) : hasPairing ? (
            <div className="flex min-h-[270px] flex-col items-center justify-center text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-amber-100 text-amber-800 shadow-[var(--shadow-sm)]">
                <KeyRound size={34} />
              </span>
              <h3 className="mt-4 font-display text-2xl font-black text-[var(--text-main)]">
                {pairing.pairingCode ? "Code WhatsApp pret" : "Code non recu"}
              </h3>
              <p className="mt-2 max-w-sm text-sm font-semibold leading-5 text-[var(--text-dim)]">
                {pairing.pairingCode
                  ? "Entre le code dans WhatsApp si l'option de liaison avec numero est affichee."
                  : "Genere un code neuf pour la liaison par numero, ou scanne le QR."}
              </p>
              <button
                type="button"
                onClick={onRefreshPairingCode}
                disabled={busy === "code"}
                className="mt-5 flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] bg-[#0A2319] px-5 text-sm font-black text-white disabled:opacity-70"
              >
                {busy === "code" ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                Reessayer
              </button>
            </div>
          ) : (
            <div className="flex min-h-[270px] flex-col items-center justify-center text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-white text-[var(--primary)] shadow-[var(--shadow-sm)]">
                <ScanLine size={36} />
              </span>
              <h3 className="mt-4 font-display text-2xl font-black text-[var(--text-main)]">QR pret a generer</h3>
              <p className="mt-2 max-w-sm text-sm font-semibold leading-5 text-[var(--text-dim)]">
                Clique sur le bouton, puis ouvre WhatsApp sur ton telephone pour scanner.
              </p>
              <button
                type="button"
                onClick={onConnect}
                disabled={busy === "pairing" || !phoneReady}
                className="mt-5 flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] bg-[#0A2319] px-5 text-sm font-black text-white disabled:opacity-70"
              >
                {busy === "pairing" ? <Loader2 className="animate-spin" size={18} /> : <QrCode size={18} />}
                Generer le QR
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <QrStep icon={<Smartphone size={18} />} title="1. Telephone" text="Ouvre WhatsApp." />
          <QrStep icon={<MonitorSmartphone size={18} />} title="2. Appareils" text="Va dans Appareils connectes." />
          <QrStep icon={<ScanLine size={18} />} title="3. Scan" text="Scanne le QR affiche ici." />
          <div className="rounded-2xl bg-amber-50 p-3 text-xs font-bold leading-4 text-amber-900 ring-1 ring-amber-100">
            Sur le meme telephone, le QR est difficile a scanner. Affiche Tikchop sur un autre ecran, ou utilise le code WhatsApp si Appareils connectes propose la liaison par numero.
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="mt-1 flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-[var(--outline)] bg-white px-4 text-xs font-black text-[var(--text-main)] disabled:opacity-60"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} size={15} />
            Verifier
          </button>
        </div>
      </div>

      {hasPairing && hasCode && (
        <div className="mt-4 rounded-[22px] border border-[var(--outline)] bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[var(--text-dim)]">Code WhatsApp temporaire</p>
              <p className="mt-1 font-display text-2xl font-black text-[var(--primary)]">{formatPairingCode(pairing.pairingCode)}</p>
            </div>
            <button type="button" onClick={onCopyPairingCode} className="app-icon-button" aria-label="Copier le code WhatsApp temporaire">
              <Copy size={17} />
            </button>
          </div>
          <p className="mt-3 text-xs font-bold leading-4 text-[var(--text-dim)]">
            Ce n&apos;est pas le mot de passe Tikchop. Ouvre WhatsApp, Appareils connectes, puis choisis la liaison avec numero si l&apos;option est affichee. {getPairingValidityLabel(pairing)}
          </p>
          <button
            type="button"
            onClick={onRefreshPairingCode}
            disabled={busy === "code"}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0A2319] px-4 text-xs font-black text-white disabled:opacity-60"
          >
            {busy === "code" ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
            Generer un nouveau code
          </button>
        </div>
      )}
      {hasPairing && !hasCode && !hasCodeOnlyPairing && (
        <div className="mt-4 rounded-[22px] bg-emerald-50 p-3 text-xs font-bold leading-4 text-emerald-950 ring-1 ring-emerald-100">
          Le QR est pret. Pour connecter sans scanner, genere un code WhatsApp neuf dedie au mode numero.
          <button
            type="button"
            onClick={onRefreshPairingCode}
            disabled={busy === "code"}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0A2319] px-4 text-xs font-black text-white disabled:opacity-60"
          >
            {busy === "code" ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
            Generer un code WhatsApp
          </button>
        </div>
      )}
      {hasPairing && !pairing.pairingCode && pairing.pairingError && (
        <div className="mt-4 rounded-[22px] bg-amber-50 p-3 text-xs font-bold leading-4 text-amber-900 ring-1 ring-amber-100">
          Le QR est disponible, mais Evolution n&apos;a pas donne de code WhatsApp pour cette tentative. Regenere le QR ou utilise Tikchop sur un second ecran.
          <button
            type="button"
            onClick={onRefreshPairingCode}
            disabled={busy === "code"}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-950 px-4 text-xs font-black text-white disabled:opacity-60"
          >
            {busy === "code" ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
            Reessayer le code
          </button>
        </div>
      )}
    </div>
  );
}
