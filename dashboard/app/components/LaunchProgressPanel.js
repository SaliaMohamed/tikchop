import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, ClipboardList, CreditCard, Rocket, Smartphone, Store, Truck } from "lucide-react";

const OFFICIAL_LAUNCH_PERCENT = 84;

const launchBlocks = [
  {
    title: "App PWA mobile",
    text: "Inscription, navigation vendeur, installation telephone.",
    status: "ready",
    icon: Smartphone,
  },
  {
    title: "Boutique + checkout",
    text: "Catalogue public, panier, livraison, recu client.",
    status: "ready",
    icon: Store,
  },
  {
    title: "Gestion ventes",
    text: "Ventes, fiche livreur, recu, statut de commande.",
    status: "ready",
    icon: Truck,
  },
  {
    title: "WhatsApp reel",
    text: "QR, code temporaire, fiche livreur et cycle terrain valides.",
    status: "ready",
    icon: Bot,
  },
  {
    title: "Paiement officiel",
    text: "Paiement livraison d'abord. Paiement direct a finaliser en dernier.",
    status: "todo",
    icon: CreditCard,
  },
  {
    title: "Test terrain",
    text: "Cycle test OK. Reste 2 ou 3 vendeuses externes avant lancement public.",
    status: "risk",
    icon: ClipboardList,
  },
];

export default function LaunchProgressPanel({ stats = {}, compact = false }) {
  const sellerReady = getSellerLaunchReadiness(stats);
  const blockers = launchBlocks.filter((item) => item.status !== "ready");

  return (
    <section className={`overflow-hidden rounded-[28px] bg-[#fbf9f4] ring-1 ring-[#07120d]/10 ${compact ? "p-3" : "p-4 md:p-5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Lancement officiel</p>
          <h2 className="mt-1 font-display text-2xl font-black leading-8 text-[#07120d]">
            {OFFICIAL_LAUNCH_PERCENT}% pret
          </h2>
          <p className="mt-1 text-sm font-bold leading-5 text-[#07120d]/50">
            La beta terrain fonctionne. Le lancement public attend surtout 2 ou 3 vendeuses externes et le paiement final.
          </p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#07120d] text-[#39f58e] shadow-sm">
          <Rocket size={22} />
        </span>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white ring-1 ring-[#07120d]/5">
        <div className="h-full rounded-full bg-[#008f5a]" style={{ width: `${OFFICIAL_LAUNCH_PERCENT}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <LaunchMiniMetric label="Beta" value="OK" done />
        <LaunchMiniMetric label="Officiel" value="84%" />
        <LaunchMiniMetric label="Restant" value={`${blockers.length}`} warn />
      </div>

      {!compact && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {launchBlocks.map((item) => (
            <LaunchBlock key={item.title} item={item} />
          ))}
        </div>
      )}

      <div className="mt-4 rounded-[22px] bg-white p-3 ring-1 ring-[#07120d]/8">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] ${sellerReady.done ? "bg-[#eafff5] text-[#005f3d]" : "bg-[#fff7d8] text-[#9a6500]"}`}>
            {sellerReady.done ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#07120d]">{sellerReady.title}</p>
            <p className="mt-1 text-xs font-bold leading-4 text-[#07120d]/60">{sellerReady.text}</p>
            <Link href={sellerReady.href} className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-[16px] bg-[#07120d] px-4 text-xs font-black text-white no-underline active:scale-[0.98] transition-transform">
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
    <div className={`rounded-[18px] p-2.5 text-center ring-1 ${done ? "bg-[#eafff5] text-[#005f3d] ring-[#008f5a]/20" : warn ? "bg-[#fff7d8] text-[#171006] ring-[#ffcf3d]/45" : "bg-white text-[#07120d] ring-[#07120d]/10"}`}>
      <strong className="block font-display text-lg font-black leading-none">{value}</strong>
      <small className="mt-1 block text-[0.62rem] font-black uppercase tracking-[0.08em] opacity-50">{label}</small>
    </div>
  );
}

function LaunchBlock({ item }) {
  const Icon = item.icon;
  const done = item.status === "ready";
  const risk = item.status === "risk";

  return (
    <div className={`grid min-h-[82px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[20px] p-3 ring-1 ${done ? "bg-[#eafff5] ring-[#008f5a]/20" : risk ? "bg-[#fff7d8] ring-[#ffcf3d]/40" : "bg-white ring-[#07120d]/10"}`}>
      <span className={`flex h-11 w-11 items-center justify-center rounded-[18px] ${done ? "bg-[#eafff5] text-[#005f3d]" : risk ? "bg-[#07120d] text-[#ffcf3d]" : "bg-[#fbf9f4] text-[#008f5a] ring-1 ring-[#07120d]/5"}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0">
        <strong className="block text-sm font-black leading-5 text-[#07120d]">{item.title}</strong>
        <small className="mt-0.5 block text-xs font-bold leading-4 text-[#07120d]/50">{item.text}</small>
      </span>
      {done ? <CheckCircle2 className="text-[#008f5a]" size={19} /> : <AlertTriangle className={risk ? "text-[#9a6500]" : "text-[#07120d]/20"} size={19} />}
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
