"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";
import { getSellerBusinessProfile, saveSellerBusinessProfile, uploadSellerLogo } from "../actions";
import { clearActiveSeller, getSellerInitials, useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import { compressImage } from "../../lib/image-compressor";
import { supabase } from "../../lib/supabase";
import { TkScreen } from "../components/TikchopUI";

export default function AccountPage() {
  const activeSeller = useActiveSeller();
  const sellerInitials = getSellerInitials(activeSeller);

  const [seller, setSeller] = useState(null);
  const [profile, setProfile] = useState({ name: "", phone_number: "", owner_email: "" });
  const [loading, setLoading] = useState(Boolean(activeSeller.slug));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const logoRef = useRef(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");

  useEffect(() => {
    if (!activeSeller.slug) {
      return;
    }

    async function load() {
      try {
        setLoading(true);
        const token = await getSellerAccessToken();
        const data = await getSellerBusinessProfile(activeSeller.slug, token);
        const s = data.seller || {};
        setSeller(s);
        setProfile({
          name: s.name || "",
          phone_number: s.phone_number || "",
          owner_email: s.owner_email || "",
          logo_url: s.logo_url || "",
          brand_color: s.brand_color || "#008f5a",
          physical_address: s.physical_address || "",
          bot_tone: s.bot_tone || "",
          bot_greeting: s.bot_greeting || "",
          bot_payment_preferences: s.bot_payment_preferences || "",
          bot_delivery_notes: s.bot_delivery_notes || "",
          bot_special_rules: s.bot_special_rules || "",
        });
      } catch (err) {
        setError(friendlyError(err, "Impossible de charger votre profil. Reessayez."));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [activeSeller.slug]);

  function updateField(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function handleLogoSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setLogoError("");
      setLogoUploading(true);
      updateField("logo_url", URL.createObjectURL(file));
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("image", compressed);
      const result = await uploadSellerLogo(form);
      updateField("logo_url", result.cleanUrl || result.url);
      setNotice("Photo mise a jour. Enregistrez pour confirmer.");
    } catch (err) {
      setLogoError(friendlyError(err, "Photo non envoyee. Essayez une image plus legere."));
    } finally {
      setLogoUploading(false);
      event.target.value = "";
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!seller?.id) return;
    try {
      setSaving(true);
      setError("");
      setNotice("");
      const token = await getSellerAccessToken();
      const updated = await saveSellerBusinessProfile(seller.id, profile, token);
      setSeller((s) => ({ ...s, ...updated }));
      setNotice("Profil enregistre.");
    } catch (err) {
      setError(friendlyError(err, "Impossible d'enregistrer. Verifiez les informations."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    clearActiveSeller();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const logoUrl = profile.logo_url;

  if (loading) {
    return (
      <TkScreen>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="animate-spin text-[#008f5a]" size={28} />
        </div>
      </TkScreen>
    );
  }

  return (
    <TkScreen>
      {/* Header avatar */}
      <div className="flex flex-col items-center pt-4 pb-6">
        <div className="relative">
          <button
            type="button"
            onClick={() => logoRef.current?.click()}
            disabled={logoUploading}
            className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] bg-[#07120d] font-display text-2xl font-black text-[#39f58e] shadow-[0_16px_36px_rgba(7,18,13,0.22)] transition active:scale-[0.97]"
            aria-label="Changer la photo"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Photo boutique" className="h-full w-full object-cover" />
            ) : (
              sellerInitials
            )}
            {logoUploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="animate-spin text-white" size={20} />
              </span>
            )}
            <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#008f5a] text-white shadow-md">
              <Camera size={14} />
            </span>
          </button>
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoSelect}
          />
        </div>
        {logoError && (
          <p className="mt-2 text-center text-xs font-bold text-rose-600">{logoError}</p>
        )}
        <h1 className="mt-4 font-display text-2xl font-black text-[#07120d]">
          {activeSeller.name || "Mon profil"}
        </h1>
        <p className="mt-1 text-xs font-bold text-[#07120d]/50">
          /{activeSeller.slug || "boutique"}
        </p>
      </div>

      {/* Notices */}
      {error && (
        <div className="mb-4 rounded-[20px] bg-amber-50 p-3.5 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-[20px] bg-emerald-50 p-3.5 text-sm font-bold text-emerald-900 ring-1 ring-emerald-200">
          {notice}
        </div>
      )}

      {/* Infos identité */}
      <form onSubmit={handleSave} className="space-y-3">
        <section className="overflow-hidden rounded-[26px] bg-white ring-1 ring-[#07120d]/8">
          <div className="flex items-center gap-2.5 border-b border-[#07120d]/6 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#008f5a]/10 text-[#008f5a]">
              <User size={15} />
            </span>
            <p className="text-sm font-black text-[#07120d]">Identite</p>
          </div>
          <div className="space-y-0 divide-y divide-[#07120d]/5">
            <ProfileField
              label="Nom boutique"
              id="account-name"
              value={profile.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Salia Boutique"
              icon={<Store size={16} />}
            />
            <ProfileField
              label="WhatsApp"
              id="account-phone"
              value={profile.phone_number}
              onChange={(e) => updateField("phone_number", e.target.value)}
              placeholder="+225 07 12 34 56 78"
              inputMode="tel"
              icon={<Phone size={16} />}
            />
            <ProfileField
              label="Email"
              id="account-email"
              value={profile.owner_email}
              onChange={(e) => updateField("owner_email", e.target.value)}
              placeholder="email@exemple.com"
              inputMode="email"
              icon={<Mail size={16} />}
            />
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          id="account-save-btn"
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#008f5a] text-base font-black text-white shadow-[0_14px_30px_rgba(0,143,90,0.2)] active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={19} /> : <CheckCircle2 size={19} />}
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>

      {/* Sécurité */}
      <section className="mt-3 overflow-hidden rounded-[26px] bg-white ring-1 ring-[#07120d]/8">
        <div className="flex items-center gap-2.5 border-b border-[#07120d]/6 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#008f5a]/10 text-[#008f5a]">
            <ShieldCheck size={15} />
          </span>
          <p className="text-sm font-black text-[#07120d]">Securite</p>
        </div>

        <Link
          href="/account/update-password"
          id="account-change-password"
          className="flex min-h-[58px] items-center justify-between px-4 py-3 no-underline active:bg-[#f2fbf6]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-[#fbf9f4] text-[#07120d]">
              <KeyRound size={16} />
            </span>
            <span>
              <p className="text-sm font-black text-[#07120d]">Changer le mot de passe</p>
              <p className="text-xs font-bold text-[#07120d]/45">Vous recevrez un lien par email</p>
            </span>
          </div>
          <ChevronRight size={17} className="text-[#07120d]/30" />
        </Link>
      </section>

      {/* Boutique */}
      <section className="mt-3 overflow-hidden rounded-[26px] bg-white ring-1 ring-[#07120d]/8">
        <div className="flex items-center gap-2.5 border-b border-[#07120d]/6 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#008f5a]/10 text-[#008f5a]">
            <Store size={15} />
          </span>
          <p className="text-sm font-black text-[#07120d]">Boutique</p>
        </div>

        <Link
          href="/shop-info"
          id="account-shop-info"
          className="flex min-h-[58px] items-center justify-between px-4 py-3 no-underline active:bg-[#f2fbf6]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-[#fbf9f4] text-[#07120d]">
              <Store size={16} />
            </span>
            <span>
              <p className="text-sm font-black text-[#07120d]">Informations boutique</p>
              <p className="text-xs font-bold text-[#07120d]/45">Logo, adresse, bot WhatsApp</p>
            </span>
          </div>
          <ChevronRight size={17} className="text-[#07120d]/30" />
        </Link>
      </section>

      {/* Déconnexion */}
      <div className="mt-5 mb-2">
        <button
          type="button"
          id="account-signout-btn"
          onClick={handleSignOut}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[20px] bg-white text-sm font-black text-[#07120d]/60 ring-1 ring-[#07120d]/10 active:bg-[#fbf9f4] active:scale-[0.98]"
        >
          <LogOut size={16} />
          Se deconnecter
        </button>
      </div>

      <p className="pb-2 text-center text-[0.62rem] font-bold text-[#07120d]/30">
        Tikchop · Espace vendeur
      </p>
    </TkScreen>
  );
}

function ProfileField({ label, id, value, onChange, placeholder, icon, inputMode }) {
  return (
    <label htmlFor={id} className="flex min-h-[62px] cursor-text items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#fbf9f4] text-[#008f5a]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">
          {label}
        </span>
        <input
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          inputMode={inputMode}
          className="mt-0.5 w-full bg-transparent text-sm font-black text-[#07120d] outline-none placeholder:text-[#07120d]/30"
        />
      </span>
    </label>
  );
}
