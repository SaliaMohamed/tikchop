"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { getSellerChatbotSettings, saveSellerChatbotSettings } from "../seller-actions";
import { useActiveSeller } from "./sellerContext";
import TikchopLottie from "./TikchopLottie";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";

export const DJASSAMAN_PRESET = {
  bot_tone: "Francais ivoirien simple, chaud et convaincant. Parle comme un bon vendeur WhatsApp: poli, direct, rassurant, jamais robotique.",
  bot_greeting: "Bonjour, bienvenue chez nous. Dites-moi ce que vous cherchez, je vous montre les articles disponibles et je vous aide a commander rapidement.",
  bot_payment_preferences: "Proposer le paiement a la livraison en premier quand la zone le permet, puis Wave, Orange Money, MTN MoMo ou Djamo. Toujours confirmer le montant total avant d'encaisser.",
  bot_delivery_notes: "Demander quartier, commune, point de repere et numero joignable. Apres paiement ou confirmation, envoyer les infos utiles au livreur par WhatsApp et tenir le client informe.",
  bot_special_rules: "Toujours verifier stock, taille/couleur et prix avant de confirmer. Envoyer un recu ou recap clair au client. Relancer poliment si le client hesite, sans forcer.",
};

const EMPTY_SETTINGS = {
  bot_tone: "",
  bot_greeting: "",
  bot_payment_preferences: "",
  bot_delivery_notes: "",
  bot_special_rules: "",
};

const FIELDS = [
  {
    key: "bot_tone",
    label: "Ton & personnalite",
    hint: "Comment DJASSAMAN parle a vos clients.",
    placeholder: DJASSAMAN_PRESET.bot_tone,
    rows: 4,
  },
  {
    key: "bot_greeting",
    label: "Message d'accueil",
    hint: "Le premier message quand un client ecrit.",
    placeholder: DJASSAMAN_PRESET.bot_greeting,
    rows: 2,
  },
  {
    key: "bot_payment_preferences",
    label: "Paiement",
    hint: "Quels moyens proposer et dans quel ordre.",
    placeholder: DJASSAMAN_PRESET.bot_payment_preferences,
    rows: 3,
  },
  {
    key: "bot_delivery_notes",
    label: "Livraison",
    hint: "Quelles infos demander et comment informer.",
    placeholder: DJASSAMAN_PRESET.bot_delivery_notes,
    rows: 3,
  },
  {
    key: "bot_special_rules",
    label: "Regles speciales",
    hint: "Les consignes importantes pour la vente.",
    placeholder: DJASSAMAN_PRESET.bot_special_rules,
    rows: 3,
  },
];

export default function StyleEditor({ onSaved }) {
  const seller = useActiveSeller();
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!seller.slug) return;
    let alive = true;
    getSellerAccessToken()
      .then((token) => getSellerChatbotSettings(seller, token))
      .then((data) => { if (alive) setSettings((c) => ({ ...EMPTY_SETTINGS, ...(data || {}) })); })
      .catch(() => { if (alive) setError("Style non charge. Actualisez."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [seller]);

  function updateSetting(field, value) {
    setSettings((c) => ({ ...c, [field]: value }));
  }

  function applyPreset() {
    setSettings((c) => ({ ...c, ...DJASSAMAN_PRESET }));
    setMessage("Preset applique. Relisez, puis enregistrez.");
    setError("");
  }

  async function saveSettings() {
    try {
      setBusy("settings");
      setError("");
      setMessage("");
      const token = await getSellerAccessToken();
      const data = await saveSellerChatbotSettings(seller, settings, token);
      setSettings((c) => ({ ...EMPTY_SETTINGS, ...(data || c) }));
      setMessage("Style DJASSAMAN enregistre.");
      onSaved?.();
    } catch (err) {
      setError(friendlyError(err, "Style non enregistre."));
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="animate-spin text-[#c2572b]" size={30} />
        <p className="mt-3 text-sm font-black text-[#2b2219]/45">Chargement du style...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#2b2219] text-[#f0954c]">
            <Bot size={20} />
          </span>
          <div>
            <p className="text-sm font-black text-[#2b2219]">Personnalisez DJASSAMAN</p>
            <p className="text-xs font-bold text-[#2b2219]/45">Il repond et vend pour vous 24h/24</p>
          </div>
        </div>
        <button
          type="button"
          onClick={applyPreset}
          className="flex shrink-0 items-center gap-1.5 rounded-[12px] bg-[#261e16] px-3 py-2 text-[0.66rem] font-black text-[#f0954c]"
        >
          <Sparkles size={13} />
          Preset
        </button>
      </div>

      {(message || error) && (
        <div className={`flex items-center gap-2.5 rounded-[16px] p-3 text-sm font-bold leading-5 ${error ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-[#fbeee0] text-[#96451f] ring-1 ring-[#fbefe2]"}`}>
          {!error && <TikchopLottie name="sparkle" size={20} speed={1.3} className="shrink-0" ariaLabel="Enregistre" />}
          {error || message}
        </div>
      )}

      <div className="grid gap-3">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <div className="flex items-center justify-between">
              <label className="block text-[0.66rem] font-black uppercase tracking-[0.1em] text-[#2b2219]/50">{field.label}</label>
              <span className="text-[0.6rem] font-bold text-[#2b2219]/35">{field.hint}</span>
            </div>
            <textarea
              value={settings[field.key]}
              onChange={(e) => updateSetting(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={field.rows}
              className="mt-1.5 min-h-0 w-full resize-none rounded-[14px] bg-[#fbf6ee] px-3.5 py-2.5 text-sm font-semibold text-[#2b2219] outline-none ring-1 ring-[#2b2219]/8 placeholder:text-[#2b2219]/30 focus:ring-2 focus:ring-[#c2572b]/30"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={saveSettings}
        disabled={busy === "settings"}
        className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[20px] bg-[linear-gradient(135deg,#261e16,#8a3c1c)] px-4 text-sm font-black text-white shadow-[0_14px_30px_rgba(38,30,22,0.16)] disabled:opacity-60"
      >
        {busy === "settings" ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />}
        Enregistrer le style
      </button>

      <p className="text-center text-xs font-bold text-[#2b2219]/40">Etape 2 sur 3</p>
    </div>
  );
}
