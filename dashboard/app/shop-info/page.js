"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import { getSellerBusinessProfile, saveSellerBusinessProfile, uploadSellerLogo } from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import { IllustrationBrandPulse } from "../components/TikchopIllustrations";
import { getPaymentOption } from "../../lib/local-commerce";
import { compressImage } from "../../lib/image-compressor";

const defaultProfile = {
  name: "",
  phone_number: "",
  owner_email: "",
  bot_tone: "",
  bot_greeting: "",
  bot_payment_preferences: "",
  bot_delivery_notes: "",
  bot_special_rules: "",
  logo_url: "",
  brand_color: "#c2572b",
  physical_address: "",
};

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

function getPublicUrl(slug) {
  if (!slug) return "";
  if (typeof window !== "undefined") return `${window.location.origin}/${slug}`;
  return `/${slug}`;
}

function statusOk(value) {
  return ["connected", "open", "standard_active"].includes(String(value || "").toLowerCase());
}

export default function ShopInfoPage() {
  const activeSeller = useActiveSeller();
  const [seller, setSeller] = useState(null);
  const [zones, setZones] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [profile, setProfile] = useState(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const logoFileInputRef = useRef(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");

  const publicUrl = useMemo(() => getPublicUrl(seller?.slug || activeSeller.slug), [seller?.slug, activeSeller.slug]);
  const whatsappReady = statusOk(seller?.whatsapp_status);
  const deliveryReady = zones.length > 0 || Number(seller?.fixed_delivery_fee || 0) > 0 || seller?.pickup_enabled;
  const paymentReady = Boolean(
    seller?.paystack_subaccount_code
    || seller?.payout_phone
    || ["paystack_ready", "direct_ready", "manual_review", "pending_confirmation"].includes(String(seller?.payout_status || "").toLowerCase()),
  );
  const botReady = Boolean(profile.bot_greeting || profile.bot_payment_preferences || profile.bot_delivery_notes || profile.bot_special_rules);
  const brandingReady = Boolean(profile.logo_url || profile.brand_color !== "#c2572b" || profile.physical_address);
  const readyCount = [profile.name, profile.phone_number, whatsappReady, deliveryReady, paymentReady, botReady, brandingReady].filter(Boolean).length;
  const readiness = Math.round((readyCount / 7) * 100);

  const loadData = useCallback(async function loadData() {
    if (!activeSeller.slug) {
      setLoading(false);
      setError("Aucune boutique active.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const token = await getSellerAccessToken();
      const data = await getSellerBusinessProfile(activeSeller.slug, token);
      const sellerData = data.seller || {};
      setSeller(sellerData);
      setZones(data.zones || []);
      setDrivers(data.drivers || []);
      setProfile({
        name: sellerData.name || "",
        phone_number: sellerData.phone_number || "",
        owner_email: sellerData.owner_email || "",
        bot_tone: sellerData.bot_tone || "",
        bot_greeting: sellerData.bot_greeting || "",
        bot_payment_preferences: sellerData.bot_payment_preferences || "",
        bot_delivery_notes: sellerData.bot_delivery_notes || "",
        bot_special_rules: sellerData.bot_special_rules || "",
        logo_url: sellerData.logo_url || "",
        brand_color: sellerData.brand_color || "#c2572b",
        physical_address: sellerData.physical_address || "",
      });
    } catch (err) {
      setError(friendlyError(err, "Informations boutique non chargees. Reessayez."));
    } finally {
      setLoading(false);
    }
  }, [activeSeller.slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  function updateField(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function handleLogoSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLogoError("");
      setLogoUploading(true);
      const preview = URL.createObjectURL(file);
      updateField("logo_url", preview);

      const compressedFile = await compressImage(file);
      const payload = new FormData();
      payload.append("image", compressedFile);
      const result = await uploadSellerLogo(payload);
      updateField("logo_url", result.cleanUrl || result.url);
      setNotice("Logo televerse. Enregistrez pour confirmer.");
    } catch (err) {
      setLogoError(friendlyError(err, "Logo non envoye. Essayez une image plus legere."));
    } finally {
      setLogoUploading(false);
      event.target.value = "";
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!seller?.id) return;

    try {
      setSaving(true);
      setError("");
      setNotice("");
      const token = await getSellerAccessToken();
      const updated = await saveSellerBusinessProfile(seller.id, profile, token);
      setSeller((current) => ({ ...current, ...updated }));
      setNotice("Informations boutique enregistrees.");
    } catch (err) {
      setError(friendlyError(err, "Informations non sauvegardees. Verifiez le nom et le numero."));
    } finally {
      setSaving(false);
    }
  }

  async function copyPublicUrl() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setNotice("Lien boutique copie.");
    } catch {
      setNotice("Lien boutique pret a partager.");
    }
  }

  if (loading) {
    return (
      <div className="app-shell flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin text-[#c2572b]" size={30} />
          <p className="mt-3 text-sm font-black text-[#2b2219]/50">Chargement boutique...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-8">
      <header className="overflow-hidden rounded-[26px] bg-[#2b2219] p-5 text-white shadow-[0_4px_28px_rgba(43, 34, 25,0.25)] md:p-7">
        <div className="grid gap-5 lg:grid-cols-[1fr_120px_280px] lg:items-center">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#f0954c]/80">Informations boutique</p>
            <h1 className="mt-2 font-display text-3xl font-black leading-tight text-white md:text-4xl">
              Tout ce que Tikchop doit savoir.
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-white/55">
              Nom, WhatsApp, paiements, zones, livreurs et consignes du bot. Si cette fiche est claire, Tikchop vend mieux.
            </p>
          </div>
          <div className="hidden lg:flex items-center justify-center">
            <IllustrationBrandPulse size={90} />
          </div>
          <div className="rounded-[20px] bg-white/8 p-4 ring-1 ring-white/10">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#f0954c]/70">Fiche complete</p>
            <div className="mt-3 flex items-end gap-3">
              <strong className="font-display text-5xl font-black text-white">{readiness}%</strong>
              <span className="pb-1.5 text-xs font-black text-white/50">{readyCount}/7 blocs</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/12">
              <div className="h-full rounded-full bg-[#f0954c] transition-all duration-700" style={{ width: `${readiness}%` }} />
            </div>
          </div>
        </div>
      </header>

      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}

      <main className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <form onSubmit={saveProfile} className="space-y-5">
          <section className="overflow-hidden rounded-[26px] bg-[#fbf6ee] ring-1 ring-[#2b2219]/10">
            <div className="flex items-center gap-2.5 border-b border-[#2b2219]/8 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#c2572b]/10 text-[#c2572b]">
                <Store size={17} />
              </span>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#c2572b]">Identite</p>
                <h2 className="font-display text-lg font-black text-[#2b2219]">Identite boutique</h2>
              </div>
            </div>
            <div className="p-4 grid gap-3 md:grid-cols-2">
              <Field label="Nom boutique">
                <input value={profile.name} onChange={(event) => updateField("name", event.target.value)} className="mobile-input" placeholder="Salia Boutique" />
              </Field>
              <Field label="WhatsApp vendeur">
                <input value={profile.phone_number} onChange={(event) => updateField("phone_number", event.target.value)} className="mobile-input" placeholder="+225..." />
              </Field>
              <Field label="Email proprietaire">
                <input value={profile.owner_email} onChange={(event) => updateField("owner_email", event.target.value)} className="mobile-input" placeholder="email@exemple.com" />
              </Field>
              <Field label="Lien public">
                <div className="flex min-h-[54px] overflow-hidden rounded-[18px] bg-[#fbf6ee] ring-1 ring-[#2b2219]/12">
                  <input value={publicUrl} readOnly className="min-w-0 flex-1 bg-transparent px-4 text-sm font-black text-[#2b2219] outline-none" />
                  <button type="button" onClick={copyPublicUrl} className="flex w-11 items-center justify-center border-l border-[#2b2219]/10 text-[#c2572b]" aria-label="Copier">
                    <Copy size={17} />
                  </button>
                </div>
              </Field>
            </div>
          </section>

          <section className="overflow-hidden rounded-[26px] bg-[#fbf6ee] ring-1 ring-[#2b2219]/10">
            <div className="flex items-center gap-2.5 border-b border-[#2b2219]/8 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#c2572b]/10 text-[#c2572b]">
                <Store size={17} />
              </span>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#c2572b]">Design & Branding</p>
                <h2 className="font-display text-lg font-black text-[#2b2219]">Personnalisation boutique</h2>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-[140px_1fr]">
                <div className="flex flex-col items-center justify-center">
                  <span className="text-xs font-black uppercase tracking-wider text-[#6e6354]/80 mb-2">Logo</span>
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoSelection}
                  />
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    disabled={logoUploading}
                    className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[#e7dac2] bg-white text-center hover:bg-[#fbf6ee] transition"
                  >
                    {profile.logo_url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={profile.logo_url} alt="Logo" className="h-full w-full object-cover" />
                        <span className="absolute inset-0 bg-black/25 opacity-0 hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-black">Changer</span>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-[#c2572b]">
                        <Store size={22} className="opacity-80" />
                        <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-[#2b2219]/50">Choisir</span>
                      </div>
                    )}
                    {logoUploading && (
                      <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[#c2572b]">
                        <Loader2 className="animate-spin" size={16} />
                      </span>
                    )}
                  </button>
                  {logoError && <p className="text-[10px] text-rose-600 font-semibold mt-1">{logoError}</p>}
                </div>
                <div className="space-y-3">
                  <Field label="Couleur de marque">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={profile.brand_color}
                        onChange={(event) => updateField("brand_color", event.target.value)}
                        className="h-11 w-16 shrink-0 cursor-pointer rounded-xl border border-[#2b2219]/12 p-1 bg-white"
                      />
                      <input
                        type="text"
                        value={profile.brand_color}
                        onChange={(event) => updateField("brand_color", event.target.value)}
                        className="mobile-input uppercase"
                        placeholder="#c2572b"
                      />
                    </div>
                  </Field>
                  <Field label="Adresse physique">
                    <input
                      value={profile.physical_address}
                      onChange={(event) => updateField("physical_address", event.target.value)}
                      className="mobile-input"
                      placeholder="Ex: Cocody, Rue des Jardins, Abidjan"
                    />
                  </Field>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[26px] bg-[#fbf6ee] ring-1 ring-[#2b2219]/10">
            <div className="flex items-center gap-2.5 border-b border-[#2b2219]/8 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#c2572b]/10 text-[#c2572b]">
                <Bot size={17} />
              </span>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#c2572b]">Bot</p>
                <h2 className="font-display text-lg font-black text-[#2b2219]">Consignes du Djassaman digital</h2>
              </div>
            </div>
            <div className="p-4 grid gap-3">
              <Field label="Ton vendeur">
                <input value={profile.bot_tone} onChange={(event) => updateField("bot_tone", event.target.value)} className="mobile-input" placeholder="Poli, direct, convaincant, style Abidjan" />
              </Field>
              <Field label="Message d&apos;accueil">
                <textarea value={profile.bot_greeting} onChange={(event) => updateField("bot_greeting", event.target.value)} className="mobile-input min-h-24 resize-none py-3" placeholder="Bonjour, bienvenue. Quel article vous interesse ?" />
              </Field>
              <Field label="Paiements preferes">
                <textarea value={profile.bot_payment_preferences} onChange={(event) => updateField("bot_payment_preferences", event.target.value)} className="mobile-input min-h-20 resize-none py-3" placeholder="Wave recommande. Orange Money accepte. Paiement livraison possible..." />
              </Field>
              <Field label="Notes livraison">
                <textarea value={profile.bot_delivery_notes} onChange={(event) => updateField("bot_delivery_notes", event.target.value)} className="mobile-input min-h-20 resize-none py-3" placeholder="Livraison Cocody, Marcory, Yopougon. Demander commune et quartier..." />
              </Field>
              <Field label="Regles speciales">
                <textarea value={profile.bot_special_rules} onChange={(event) => updateField("bot_special_rules", event.target.value)} className="mobile-input min-h-20 resize-none py-3" placeholder="Ne pas negocier sous tel prix. Confirmer taille avant paiement..." />
              </Field>
            </div>
          </section>

          <button disabled={saving} className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[24px] bg-[#2b2219] px-5 text-base font-black text-white disabled:opacity-60 active:scale-[0.99]">
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Enregistrer la fiche boutique
          </button>
        </form>

        <aside className="space-y-4">
          <InfoStatusCard
            icon={<Phone size={20} />}
            title="WhatsApp"
            ok={whatsappReady}
            text={whatsappReady ? "Assistant connecte." : "Connectez WhatsApp pour recevoir et repondre aux clients."}
            href="/whatsapp"
            action="Gerer WhatsApp"
          />
          <InfoStatusCard
            icon={<Wallet size={20} />}
            title="Paiement"
            ok={paymentReady}
            text={paymentReady ? paymentSummary(seller) : "Ajoutez Wave, Orange, MTN ou paiement livraison."}
            href="/payment-settings"
            action="Regler paiement"
          />
          <InfoStatusCard
            icon={<Truck size={20} />}
            title="Livraison"
            ok={deliveryReady}
            text={deliverySummary(seller, zones, drivers)}
            href="/delivery-settings"
            action="Gerer livraison"
          />

          <section className="overflow-hidden rounded-[26px] bg-[#fbf6ee] ring-1 ring-[#2b2219]/10">
            <div className="flex items-center gap-2.5 border-b border-[#2b2219]/8 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#c2572b]/10 text-[#c2572b]">
                <MapPin size={17} />
              </span>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#c2572b]">Zones</p>
                <h2 className="font-display text-lg font-black text-[#2b2219]">{zones.length} zone{zones.length > 1 ? "s" : ""} configuree{zones.length > 1 ? "s" : ""}</h2>
              </div>
            </div>
            <div className="p-3 space-y-2">
              {zones.slice(0, 6).map((zone) => (
                <div key={zone.id} className="flex items-center justify-between rounded-[16px] bg-white px-3 py-2.5 ring-1 ring-[#2b2219]/8">
                  <span className="text-sm font-black text-[#2b2219]">{zone.name}</span>
                  <span className="text-xs font-black text-[#c2572b]">{formatPrice(zone.fee)}</span>
                </div>
              ))}
              {zones.length === 0 && <p className="rounded-xl bg-white p-3 text-sm font-bold text-[#2b2219]/50 ring-1 ring-[#2b2219]/8">Aucune zone. Le bot devra demander la zone au client.</p>}
            </div>
          </section>

          <section className="overflow-hidden rounded-[26px] bg-[#2b2219] text-white">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#f0954c]/80">Apercu bot</p>
              <h2 className="font-display text-lg font-black">Ce que Tikchop sait dire</h2>
            </div>
            <div className="p-4">
              <p className="text-sm font-black text-white">{profile.name || "Votre boutique"}</p>
              <p className="mt-2 text-xs font-bold leading-5 text-white/55">
                Paiement: {paymentSummary(seller)}<br />
                Livraison: {deliverySummary(seller, zones, drivers)}<br />
                WhatsApp: {whatsappReady ? "connecte" : "a connecter"}
              </p>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function paymentSummary(seller) {
  const methods = Array.isArray(seller?.accepted_payment_methods) ? seller.accepted_payment_methods : [];
  const labels = methods
    .map((method) => getPaymentOption(method)?.shortLabel || getPaymentOption(method)?.label)
    .filter(Boolean);
  if (labels.length) return labels.join(", ");
  if (seller?.payout_phone) return `${seller.payout_network || "Mobile money"} ${seller.payout_phone}`;
  return "Paiement a configurer";
}

function deliverySummary(seller, zones, drivers) {
  if (!seller?.delivery_enabled && seller?.pickup_enabled) return "Retrait boutique uniquement.";
  if (zones.length > 0 && drivers.length > 0) return `${zones.length} zones, ${drivers.length} livreurs.`;
  if (zones.length > 0) return `${zones.length} zones configurees.`;
  if (Number(seller?.fixed_delivery_fee || 0) > 0) return `Frais fixe ${formatPrice(seller.fixed_delivery_fee)}.`;
  return "Livraison a configurer.";
}

function PanelTitle({ icon, title, text }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 font-display text-xl font-black text-[var(--text-main)]">
        {icon}
        {title}
      </h2>
      <p className="mt-1 text-xs font-bold text-[var(--text-dim)]">{text}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#c2572b]">{label}</span>
      {children}
    </label>
  );
}

function InfoStatusCard({ icon, title, ok, text, href, action }) {
  return (
    <section className={`overflow-hidden rounded-[24px] ring-1 ${
      ok ? "bg-[#fbefe2] ring-emerald-200/70" : "bg-[#fbf6ee] ring-[#2b2219]/10"
    }`}>
      <div className="flex items-center gap-3 border-b border-[#2b2219]/8 px-4 py-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
          ok ? "bg-[#c2572b]/15 text-[#c2572b]" : "bg-amber-100 text-amber-800"
        }`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-black text-[#2b2219]">{title}</h3>
            {ok && <CheckCircle2 size={15} className="text-[#c2572b]" />}
          </div>
        </div>
        <Link href={href} className="flex min-h-[34px] items-center gap-1.5 rounded-full bg-white px-3 text-xs font-black text-[#2b2219] no-underline shadow-sm ring-1 ring-[#2b2219]/10">
          {action}
          <ExternalLink size={12} />
        </Link>
      </div>
      <p className="px-4 py-3 text-sm font-bold leading-5 text-[#2b2219]/55">{text}</p>
    </section>
  );
}

function Notice({ children, tone = "success" }) {
  return (
    <div className={`mt-4 rounded-[22px] p-4 text-sm font-extrabold ring-1 ${
      tone === "error"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : "bg-emerald-50 text-emerald-900 ring-emerald-200"
    }`}>
      {children}
    </div>
  );
}
