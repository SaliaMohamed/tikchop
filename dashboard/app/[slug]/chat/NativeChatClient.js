"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, MessageCircle, Mic, Send, Square, Trash2, Loader2, ExternalLink } from "lucide-react";

const CLIENT_ID_KEY = "tk_client_id";
const CLIENT_NAME_KEY = "tk_client_name";

const QUICK_REPLIES = [
  "Voir le catalogue",
  "Ce produit est-il disponible ?",
  "Comment payer ?",
  "Livraison & retrait",
  "Parler à un vendeur",
];

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function newClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cli-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getClientId() {
  const existing = typeof window !== "undefined" ? localStorage.getItem(CLIENT_ID_KEY) : null;
  if (existing) return existing;
  const next = newClientId();
  if (typeof window !== "undefined") {
    localStorage.setItem(CLIENT_ID_KEY, next);
  }
  return next;
}

function renderMessageContent(text) {
  if (!text) return null;

  // Regex pour détecter les URLs (ex. Paystack, liens de paiement)
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = String(text).split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      const isPaystack = part.includes("paystack") || part.includes("checkout");
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`my-1.5 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black shadow-sm transition-all ${
            isPaystack
              ? "bg-[#0ba4db] text-white hover:bg-[#0991c2]"
              : "bg-[var(--primary)] text-white hover:opacity-90"
          }`}
        >
          <span>{isPaystack ? "💳 Payer par Paystack / Wave" : "Ouvrir le lien"}</span>
          <ExternalLink size={13} />
        </a>
      );
    }

    return String(part).split("\n").map((line, lineIndex) => (
      <React.Fragment key={`${index}-${lineIndex}`}>
        {line}
        {lineIndex < String(part).split("\n").length - 1 && <br />}
      </React.Fragment>
    ));
  });
}

export default function NativeChatClient({ seller }) {
  const brandColor = seller.brand_color || "#059669";
  const brandStyles = { "--primary": brandColor };
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);

  // Médias
  const [imageUploading, setImageUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const cid = getClientId();
      const storedName = localStorage.getItem(CLIENT_NAME_KEY) || "";
      if (!active) return;
      setClientId(cid);
      setName(storedName);
      setNeedsName(!storedName);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    let channel = null;
    let fallbackTimer = null;

    async function loadHistory() {
      try {
        const res = await fetch(`/api/chat/${seller.slug}/messages?client_id=${encodeURIComponent(clientId)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (active && Array.isArray(data?.messages)) {
          setMessages(data.messages);
          setTyping(false);
        }
      } catch {
        // keep last state
      }
    }

    async function setupRealtime() {
      // Chargement initial de l'historique
      await loadHistory();
      if (!active) return;

      // Tentative d'abonnement Supabase Realtime
      try {
        const { supabase } = await import("../../../lib/supabase");
        if (!supabase) throw new Error("supabase-not-configured");

        channel = supabase
          .channel(`djassaman:${seller.slug}:${clientId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `customer_phone=eq.${clientId}`,
            },
            (payload) => {
              if (!active || !payload?.new) return;
              const row = payload.new;
              const direction = /seller|manual|followup|out|from_me|vendeur/.test(String(row.statut || "").toLowerCase())
                ? "out"
                : /bot|assistant/.test(String(row.statut || "").toLowerCase())
                  ? "bot"
                  : "in";

              const payloadMedia = row.media_payload && typeof row.media_payload === "object" ? row.media_payload : {};
              const mimeType = String(row.media_mime_type || payloadMedia.mimetype || "").trim();
              const explicitType = String(row.media_type || payloadMedia.type || "").toLowerCase();
              const derivedType = explicitType
                || (mimeType.startsWith("image/") ? "image" : "")
                || (mimeType.startsWith("audio/") ? "audio" : "")
                || (mimeType.startsWith("video/") ? "video" : "");
              const mediaUrl = String(row.media_url || payloadMedia.url || "").trim();

              const media = (derivedType || mediaUrl) ? {
                type: derivedType || "image",
                url: mediaUrl,
                mime_type: mimeType,
                caption: String(row.media_caption || payloadMedia.caption || "").trim(),
              } : null;

              setMessages((prev) => {
                const exists = prev.some((m) => String(m.id) === String(row.id));
                if (exists) return prev;
                return [
                  ...prev,
                  {
                    id: String(row.id),
                    text: String(row.contenu || "").trim(),
                    direction,
                    status: row.statut || "",
                    created_at: row.created_at || null,
                    customer_phone: String(row.customer_phone || "").trim(),
                    customer_name: String(row.client_name || "").trim(),
                    media,
                  },
                ];
              });
              setTyping(false);
            },
          )
          .subscribe((status) => {
            // Si l'abonnement échoue → bascule sur polling 5s
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              if (active && !fallbackTimer) {
                fallbackTimer = setInterval(loadHistory, 5000);
              }
            }
          });
      } catch {
        // Supabase non configuré → polling 5s de secours
        if (active) {
          fallbackTimer = setInterval(loadHistory, 5000);
        }
      }
    }

    setupRealtime();

    return () => {
      active = false;
      if (channel) {
        channel.unsubscribe().catch(() => {});
      }
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, [clientId, seller.slug]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  function saveName(nextName) {
    const clean = String(nextName || "").trim();
    setName(clean);
    localStorage.setItem(CLIENT_NAME_KEY, clean);
    setNeedsName(false);
  }

  async function sendMessagePayload({ text = "", media = null }) {
    if (!clientId || sending) return;

    setSending(true);
    setError("");
    setInput("");
    setTyping(true);

    try {
      const res = await fetch(`/api/chat/${seller.slug}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          name,
          text,
          media,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Message non envoyé.");
      }
      if (Array.isArray(data?.messages) && data.messages.length) {
        setMessages(data.messages);
      } else {
        await refreshConversation();
      }
    } catch (sendError) {
      setError(sendError.message || "Message non envoyé. Réessayez.");
    } finally {
      setSending(false);
      setTyping(false);
    }
  }

  async function sendText(rawText) {
    const text = String(rawText || "").trim();
    if (!text) return;
    await sendMessagePayload({ text });
  }

  // --- Gestion Photo / Capture d'écran ---
  async function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image valide.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("Image trop volumineuse (max 8 Mo).");
      return;
    }

    setImageUploading(true);
    setError("");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = String(reader.result || "").split(",")[1];
        if (!base64Data) {
          setError("Impossible de lire l'image.");
          setImageUploading(false);
          return;
        }

        const currentText = input.trim();
        await sendMessagePayload({
          text: currentText || "Cette photo / capture est-elle disponible en stock ?",
          media: {
            type: "image",
            base64: base64Data,
            mimeType: file.type || "image/jpeg",
          },
        });
        setImageUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.onerror = () => {
        setError("Erreur de lecture du fichier.");
        setImageUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err.message || "Erreur d'envoi de la photo.");
      setImageUploading(false);
    }
  }

  // --- Gestion Message Vocal ---
  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Enregistrement vocal non supporté sur ce navigateur.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        clearInterval(recordingTimerRef.current);

        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size < 1000) {
          // Trop court
          setIsRecording(false);
          setRecordingSeconds(0);
          return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
          const base64Data = String(reader.result || "").split(",")[1];
          if (base64Data) {
            await sendMessagePayload({
              text: "",
              media: {
                type: "audio",
                base64: base64Data,
                mimeType,
              },
            });
          }
          setIsRecording(false);
          setRecordingSeconds(0);
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError("Accès au micro refusé ou indisponible.");
      setIsRecording(false);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  function cancelRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  }

  async function refreshConversation() {
    if (!clientId) return;
    const res = await fetch(`/api/chat/${seller.slug}/messages?client_id=${encodeURIComponent(clientId)}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (Array.isArray(data?.messages)) setMessages(data.messages);
  }

  return (
    <div style={brandStyles} className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-white md:max-w-6xl">
      <header className="shop-topbar sticky top-0 z-40 -mx-4 px-4 py-3 md:mx-0 md:rounded-b-none md:px-4 md:py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/${seller.slug}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--text-main)] shadow-sm" aria-label="Retour à la boutique">
              <ArrowLeft size={19} />
            </Link>
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[0.72rem] font-black text-[var(--primary)] ring-1 ring-[#0F2B20]/7 md:h-11 md:w-11">
              {seller.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={seller.logo_url} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                seller.name?.slice(0, 2).toUpperCase() || "TC"
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[1.05rem] font-black leading-5 text-[var(--text-main)]">{seller.name}</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-[0.68rem] font-bold leading-3 text-[var(--primary)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                Djassaman · IA & Vendeur
              </p>
            </div>
          </div>
          {needsName ? null : (
            <button
              type="button"
              onClick={() => setNeedsName(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--text-main)] shadow-sm"
              aria-label="Modifier mon nom"
            >
              <MessageCircle size={19} />
            </button>
          )}
        </div>
      </header>

      {needsName && (
        <div className="mx-4 mt-3 rounded-2xl bg-[var(--surface-soft)] p-4">
          <p className="text-sm font-extrabold text-[var(--text-main)]">Comment vous appelez-vous ?</p>
          <div className="mt-2 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && saveName(name)}
              placeholder="Votre prénom"
              className="min-h-[42px] flex-1 rounded-xl border-0 bg-white px-3 text-sm font-semibold outline-none"
            />
            <button
              type="button"
              onClick={() => saveName(name)}
              disabled={!name.trim()}
              className="min-h-[42px] rounded-xl bg-[var(--primary)] px-4 text-sm font-extrabold text-white disabled:bg-[var(--surface-mid)] disabled:text-[var(--outline)]"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
        {messages.length === 0 && !typing && (
          <div className="mx-auto max-w-[360px] rounded-[24px] bg-[var(--surface-soft)] p-4 text-sm font-semibold leading-6 text-[var(--text-dim)]">
            <p className="font-display text-base font-extrabold text-[var(--text-main)]">
              Bonjour{name ? ` ${name}` : ""} 👋
            </p>
            <p className="mt-1">
              Bienvenue sur la messagerie de <span className="font-extrabold text-[var(--text-main)]">{seller.name}</span>.
              Posez vos questions, envoyez une photo d&apos;un article (📷) ou un vocal (🎤), et passez commande directement ici.
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          {messages.map((message) => {
            const isClient = message.direction === "in";
            return (
              <div key={message.id} className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[84%] rounded-[18px] px-3.5 py-2.5 text-sm font-medium leading-5 whitespace-pre-line ${
                    isClient
                      ? "bg-[var(--primary)] text-white rounded-br-[6px]"
                      : "bg-[#F1F5F0] text-[var(--text-main)] rounded-bl-[6px]"
                  }`}
                >
                  {/* Affichage Image / Capture d'écran */}
                  {message.media?.type === "image" && message.media?.url && (
                    <div className="mb-2 overflow-hidden rounded-xl bg-black/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={message.media.url}
                        alt="Photo client"
                        className="max-h-60 w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Affichage Audio / Message Vocal */}
                  {message.media?.type === "audio" && message.media?.url && (
                    <div className="mb-2">
                      <audio controls src={message.media.url} className="h-9 w-full max-w-[240px]" />
                    </div>
                  )}

                  {/* Contenu textuel */}
                  {renderMessageContent(message.text)}

                  <span className={`mt-1 block text-right text-[0.6rem] ${isClient ? "text-white/65" : "text-[var(--text-dim)]"}`}>
                    {formatTime(message.created_at)}
                  </span>
                </div>
              </div>
            );
          })}

          {typing && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-[18px] bg-[#F1F5F0] px-4 py-3 text-[var(--text-dim)]">
                <span className="h-2 w-2 animate-bounce rounded-full bg-current" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-current" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-current" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {imageUploading && (
            <div className="flex justify-end">
              <div className="flex items-center gap-2 rounded-[18px] bg-[var(--primary)]/20 px-3.5 py-2 text-xs font-bold text-[var(--primary)]">
                <Loader2 size={14} className="animate-spin" />
                Analyse de la photo...
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </main>

      {error && (
        <div className="mx-4 mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-900">
          {error}
        </div>
      )}

      {/* Quick replies */}
      {!isRecording && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-2 pb-1.5">
          {QUICK_REPLIES.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => sendText(reply)}
              disabled={sending || imageUploading}
              className="shrink-0 rounded-full border border-[rgba(15,43,32,0.08)] bg-white px-3 py-1.5 text-[0.72rem] font-extrabold text-[var(--text-main)] active:scale-95"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Barre d'action inférieure */}
      <footer className="border-t border-[var(--line)] bg-white px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2.5">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
        />

        {isRecording ? (
          <div className="flex items-center justify-between gap-3 rounded-[18px] bg-red-50 px-4 py-2.5 text-red-600">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 animate-ping rounded-full bg-red-500" />
              <span className="text-sm font-bold">
                Enregistrement ({recordingSeconds}s)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm"
                aria-label="Annuler vocal"
              >
                <Trash2 size={16} />
              </button>
              <button
                type="button"
                onClick={stopRecording}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
                aria-label="Envoyer vocal"
              >
                <Square size={14} className="fill-current" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || imageUploading}
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-main)] transition-colors hover:bg-[var(--surface-mid)] disabled:opacity-50"
              aria-label="Envoyer une photo / capture d'écran"
              title="Envoyer une photo ou capture d'écran"
            >
              <Camera size={20} />
            </button>

            <button
              type="button"
              onClick={startRecording}
              disabled={sending || imageUploading}
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-main)] transition-colors hover:bg-[var(--surface-mid)] disabled:opacity-50"
              aria-label="Enregistrer un message vocal"
              title="Message vocal"
            >
              <Mic size={20} />
            </button>

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendText(input)}
              disabled={sending || imageUploading}
              placeholder="Écrivez un message..."
              className="min-h-[46px] flex-1 rounded-[18px] border border-[var(--line)] bg-white px-4 text-sm font-semibold outline-none focus:border-[var(--primary)]"
            />

            <button
              type="button"
              onClick={() => sendText(input)}
              disabled={sending || imageUploading || !input.trim()}
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-sm disabled:bg-[var(--surface-mid)] disabled:text-[var(--outline)]"
              aria-label="Envoyer"
            >
              <Send size={18} />
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}