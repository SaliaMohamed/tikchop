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
    <div
      className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-[#EFEAE2] md:max-w-4xl md:my-4 md:h-[92vh] md:rounded-3xl md:shadow-xl md:ring-1 md:ring-zinc-300"
      style={{
        ...brandStyles,
        backgroundImage: `radial-gradient(#d1d7db 0.75px, transparent 0.75px)`,
        backgroundSize: "20px 20px",
      }}
    >
      {/* Header style WhatsApp */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-[#F0F2F5] px-3.5 py-2.5 pt-[calc(0.6rem+env(safe-area-inset-top,0px))] md:px-4 md:py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href={`/${seller.slug}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-200/70"
            aria-label="Retour à la boutique"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-700 font-bold text-white shadow-sm ring-1 ring-zinc-200">
            {seller.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.logo_url} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              seller.name?.slice(0, 2).toUpperCase() || "TC"
            )}
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#F0F2F5] bg-[#25D366]" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-extrabold text-zinc-900 leading-tight">
              {seller.name}
            </h1>
            <p className="flex items-center gap-1 text-[0.68rem] font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              En ligne · DJASSAMAN IA
            </p>
          </div>
        </div>

        {needsName ? null : (
          <button
            type="button"
            onClick={() => setNeedsName(true)}
            className="flex h-8 items-center gap-1 rounded-full bg-white px-2.5 text-[0.68rem] font-bold text-zinc-700 shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-50"
            aria-label="Modifier mon prénom"
          >
            <span>{name ? `👤 ${name}` : "Mon nom"}</span>
          </button>
        )}
      </header>

      {needsName && (
        <div className="mx-3 mt-2 rounded-2xl bg-white/95 p-3.5 shadow-sm backdrop-blur-sm ring-1 ring-zinc-200">
          <p className="text-xs font-black text-zinc-900">Comment vous appelez-vous ?</p>
          <div className="mt-2 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && saveName(name)}
              placeholder="Votre prénom ou pseudo"
              className="min-h-[38px] flex-1 rounded-xl bg-zinc-100 px-3 text-xs font-semibold text-zinc-900 outline-none placeholder:text-zinc-400"
            />
            <button
              type="button"
              onClick={() => saveName(name)}
              disabled={!name.trim()}
              className="min-h-[38px] rounded-xl bg-[#00A884] px-4 text-xs font-bold text-white shadow-sm disabled:opacity-50"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Messages Scroll Body */}
      <main className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
        {messages.length === 0 && !typing && (
          <div className="mx-auto my-6 max-w-xs rounded-2xl bg-white/95 p-4 text-center shadow-sm backdrop-blur-sm">
            <MessageCircle className="mx-auto text-emerald-600" size={30} />
            <p className="mt-2 font-display text-sm font-black text-zinc-900">
              Bonjour{name ? ` ${name}` : ""} 👋
            </p>
            <p className="mt-1 text-[0.72rem] text-zinc-500 leading-relaxed">
              Bienvenue sur la messagerie de <strong className="text-zinc-800">{seller.name}</strong>.
              Posez vos questions, envoyez une photo d'article (📷) ou un vocal (🎤) pour commander !
            </p>
          </div>
        )}

        <div className="space-y-2">
          {messages.map((message) => {
            const isClient = message.direction === "in";
            return (
              <div key={message.id} className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
                <div
                  className={`relative max-w-[84%] rounded-2xl px-3.5 py-2 text-xs font-medium leading-relaxed shadow-[0_1px_1.5px_rgba(11,20,26,0.14)] whitespace-pre-line ${
                    isClient
                      ? "rounded-tr-xs bg-[#D9FDD3] text-zinc-900"
                      : "rounded-tl-xs bg-white text-zinc-900"
                  }`}
                >
                  {/* Affichage Image */}
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
                    <div className="mb-1.5 rounded-xl bg-black/5 p-2">
                      <div className="mb-1 flex items-center gap-1 text-[0.65rem] font-bold text-zinc-700">
                        <Mic size={12} />
                        <span>Message vocal</span>
                      </div>
                      <audio controls src={message.media.url} className="h-8 w-full" />
                    </div>
                  )}

                  {/* Contenu textuel */}
                  {renderMessageContent(message.text)}

                  <span className={`mt-1 block text-right text-[0.6rem] font-semibold ${isClient ? "text-zinc-500" : "text-zinc-400"}`}>
                    {formatTime(message.created_at)}
                  </span>
                </div>
              </div>
            );
          })}

          {typing && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2 shadow-sm">
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {imageUploading && (
            <div className="flex justify-end">
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-100 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-sm">
                <Loader2 size={14} className="animate-spin" />
                Analyse de la photo...
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </main>

      {error && (
        <div className="mx-3 mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-900 ring-1 ring-amber-200">
          {error}
        </div>
      )}

      {/* Quick replies */}
      {!isRecording && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-1.5">
          {QUICK_REPLIES.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => sendText(reply)}
              disabled={sending || imageUploading}
              className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-bold text-zinc-800 shadow-sm ring-1 ring-zinc-200/90 transition hover:bg-zinc-50 active:scale-95"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Barre d'action inférieure */}
      <footer className="border-t border-zinc-200/80 bg-[#F0F2F5] px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))] pt-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
        />

        {isRecording ? (
          <div className="flex items-center justify-between gap-3 rounded-full bg-red-50 px-4 py-2 text-red-600 ring-1 ring-red-200">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-ping rounded-full bg-red-500" />
              <span className="text-xs font-bold">
                Enregistrement ({recordingSeconds}s)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm"
                aria-label="Annuler vocal"
              >
                <Trash2 size={15} />
              </button>
              <button
                type="button"
                onClick={stopRecording}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
                aria-label="Envoyer vocal"
              >
                <Square size={13} className="fill-current" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || imageUploading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
              aria-label="Envoyer une photo"
              title="Envoyer une photo"
            >
              <Camera size={17} />
            </button>

            <button
              type="button"
              onClick={startRecording}
              disabled={sending || imageUploading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
              aria-label="Enregistrer un message vocal"
              title="Message vocal"
            >
              <Mic size={17} />
            </button>

            <div className="flex flex-1 items-center rounded-full bg-white px-3.5 py-1.5 shadow-sm ring-1 ring-zinc-200/80">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendText(input)}
                disabled={sending || imageUploading}
                placeholder="Écrivez un message..."
                className="w-full bg-transparent text-xs font-medium text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>

            <button
              type="button"
              onClick={() => sendText(input)}
              disabled={sending || imageUploading || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white shadow-md transition hover:bg-[#008f6f] active:scale-95 disabled:bg-zinc-300 disabled:shadow-none"
              aria-label="Envoyer"
            >
              <Send size={15} className="translate-x-0.5" />
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}