import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, ClipboardList, CreditCard, Smartphone, Store, Truck } from "lucide-react";
import { IllustrationRocket } from "./TikchopIllustrations";

export default function LaunchProgressPanel({ stats = {}, compact = false }) {
  const hasProducts = Number(stats.products || 0) > 0;
  const whatsappConnected = Boolean(stats.whatsappConnected);
  const payoutReady = Boolean(stats.payoutReady);
  const totalOrders = Number(stats.orders || 0);

  const blocks = [
    {
      title: "App PWA mobile",
      text: "Inscription, navigation vendeur, installation telephone.",
      status: "ready",
      icon: Smartphone,
    },
    {
      title: "Boutique + checkout",
      text: hasProducts
        ? `${stats.products} article(s) publie(s) sur le catalogue public.`
        : "Catalogue public vide. Ajoutez au moins un article.",
      status: hasProducts ? "ready" : "todo",
      icon: Store,
    },
    {
      title: "WhatsApp Assistant",
      text: whatsappConnected
        ? "Votre assistant WhatsApp est connecte et repond aux clients."
        : "Liez votre numero pour que le bot gere vos discussions.",
      status: whatsappConnected ? "ready" : "todo",
      icon: Bot,
    },
    {
      title: "Paiement direct",
      text: payoutReady
        ? "Moyens de paiement acceptes (Wave, OM ou cash livraison)."
        : "Configurez votre numero de paiement pour recevoir l'argent.",
      status: payoutReady ? "ready" : "todo",
      icon: CreditCard,
    },
    {
      title: "Gestion ventes",
      text: totalOrders > 0
        ? `${totalOrders} commande(s) enregistree(s). Cycle valide.`
        : "En attente de votre premiere commande client de test.",
      status: totalOrders > 0 ? "ready" : "todo",
      icon: Truck,
    },
    {
      title: "Tests terrain",
      text: totalOrders >= 3
        ? "Tests termines avec succes. Pret pour le grand public."
        : totalOrders > 0
          ? "Tests en cours. Faites tester a quelques clients externes."
          : "Faites au moins 3 commandes de test reel avant de lancer.",
      status: totalOrders >= 3 ? "ready" : totalOrders > 0 ? "risk" : "todo",
      icon: ClipboardList,
    },
  ];

  // Calculate dynamic readiness percentage based on status scores:
  // ready = 1, risk = 0.5, todo = 0.
  const readyScore = blocks.reduce((sum, block) => {
    if (block.status === "ready") return sum + 1;
    if (block.status === "risk") return sum + 0.5;
    return sum;
  }, 0);
  const dynamicPercent = Math.round((readyScore / blocks.length) * 100);

  const sellerReady = getSellerLaunchReadiness(stats);
  const blockers = blocks.filter((item) => item.status !== "ready");

  return (
    <section className={`overflow-hidden rounded-[28px] bg-[#07120d] text-white ring-1 ring-white/6 ${compact ? "p-3" : "p-4 md:p-5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#39f58e]">Lancement officiel</p>
          <h2 className="mt-1 font-display text-2xl font-black leading-8 text-white">
            {dynamicPercent}% pret
          </h2>
          <p className="mt-1 text-sm font-bold leading-5 text-white/50">
            {dynamicPercent === 100
              ? "Felicitations ! Votre boutique est prete pour la production."
              : "Suivez les etapes ci-dessous pour preparer le lancement public."}
          </p>
        </div>
        <IllustrationRocket size={56} className="shrink-0 opacity-90" />
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#008f5a] to-[#39f58e]"
          style={{ width: `${dynamicPercent}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <LaunchMiniMetric label="Pret" value={`${dynamicPercent}%`} done={dynamicPercent === 100} />
        <LaunchMiniMetric label="Etapes" value={`${readyScore}/${blocks.length}`} />
        <LaunchMiniMetric label="Restant" value={`${blockers.length}`} warn={blockers.length > 0} />
      </div>

      {!compact && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {blocks.map((item) => (
            <LaunchBlock key={item.title} item={item} />
          ))}
        </div>
      )}

      <div className="mt-4 rounded-[22px] bg-white/8 p-3 ring-1 ring-white/8">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] ${sellerReady.done ? "bg-[#39f58e] text-[#07120d]" : "bg-[#fff7d8]/15 text-[#ffcf3d]"}`}>
            {sellerReady.done ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white">{sellerReady.title}</p>
            <p className="mt-1 text-xs font-bold leading-4 text-white/55">{sellerReady.text}</p>
            <Link href={sellerReady.href} className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-[16px] bg-[#39f58e] px-4 text-xs font-black text-[#07120d] no-underline active:scale-[0.98] transition-transform">
              {sellerReady.cta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function LaunchMiniMetric({ label, value, done = false, warn = false }) {
  return (
    <div className={`rounded-[18px] p-2.5 text-center ring-1 ${done ? "bg-[#39f58e]/15 text-[#39f58e] ring-[#39f58e]/20" : warn ? "bg-[#ffcf3d]/15 text-[#ffcf3d] ring-[#ffcf3d]/20" : "bg-white/8 text-white ring-white/8"}`}>
      <strong className="block font-display text-lg font-black leading-none">{value}</strong>
      <small className="mt-1 block text-[0.62rem] font-black uppercase tracking-[0.08em] opacity-60">{label}</small>
    </div>
  );
}

function LaunchBlock({ item }) {
  const Icon = item.icon;
  const done = item.status === "ready";
  const risk = item.status === "risk";

  return (
    <div className={`grid min-h-[82px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[20px] p-3 ring-1 ${done ? "bg-[#39f58e]/10 ring-[#39f58e]/15" : risk ? "bg-[#ffcf3d]/12 ring-[#ffcf3d]/20" : "bg-white/6 ring-white/8"}`}>
      <span className={`flex h-11 w-11 items-center justify-center rounded-[18px] ${done ? "bg-[#39f58e]/20 text-[#39f58e]" : risk ? "bg-[#ffcf3d]/20 text-[#ffcf3d]" : "bg-white/10 text-white/60"}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0">
        <strong className="block text-sm font-black leading-5 text-white">{item.title}</strong>
        <small className="mt-0.5 block text-xs font-bold leading-4 text-white/45">{item.text}</small>
      </span>
      {done ? <CheckCircle2 className="text-[#39f58e]" size={19} /> : <AlertTriangle className={risk ? "text-[#ffcf3d]" : "text-white/25"} size={19} />}
    </div>
  );
}

function getSellerLaunchReadiness(stats) {
  if (!Number(stats.products || 0)) {
    return {
      done: false,
      title: "Votre boutique test a besoin d'un article",
      text: "Ajoutez au moins un article pour tester le vrai cycle client.",
      href: "/add-product",
      cta: "Publier un article",
    };
  }

  if (!stats.whatsappConnected) {
    return {
      done: false,
      title: "WhatsApp doit etre valide en conditions reelles",
      text: "QR et code sont OK cote serveur. Il reste a valider la liaison sur le telephone du vendeur.",
      href: "/whatsapp",
      cta: "Verifier WhatsApp",
    };
  }

  return {
    done: true,
    title: "Boutique vendeur prete pour beta terrain",
    text: "Le cycle article, commande, livreur et recu est valide. Prochaine etape: tester avec une vendeuse externe.",
    href: "/orders",
    cta: "Voir les ventes",
  };
}
