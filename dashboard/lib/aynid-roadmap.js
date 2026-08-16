export const aynidInspiredRoadmap = [
  {
    id: "simple-onboarding",
    title: "Inscription boutique ultra simple",
    percent: 70,
    status: "in_progress",
    next: "Retirer encore les textes inutiles et tester en PWA installee.",
  },
  {
    id: "no-shop-empty-state",
    title: "Écran aucune boutique",
    percent: 60,
    status: "in_progress",
    next: "Ajouter une vraie illustration et un seul bouton creer boutique.",
  },
  {
    id: "clean-products",
    title: "Catalogue vendeur epure",
    percent: 88,
    status: "done",
    next: "Separarer mieux publie, non publie et rupture.",
  },
  {
    id: "ai-product-creation",
    title: "Ajout produit photo + IA",
    percent: 88,
    status: "in_progress",
    next: "Tester le flux photos -> prix -> publier -> partager en PWA installee.",
  },
  {
    id: "ai-description",
    title: "Generation IA details produit",
    percent: 86,
    status: "done",
    next: "Ajouter une description orientee WhatsApp par defaut.",
  },
  {
    id: "mobile-bottom-nav",
    title: "Navigation mobile simple",
    percent: 90,
    status: "done",
    next: "Tester sur PWA installee Android/iPhone.",
  },
  {
    id: "empty-states",
    title: "Empty states propres",
    percent: 72,
    status: "in_progress",
    next: "Uniformiser produits, commandes, messages et boutique.",
  },
  {
    id: "shop-info",
    title: "Informations boutique",
    percent: 74,
    status: "in_progress",
    next: "Ajouter logo/photo boutique et edition adresse physique.",
  },
  {
    id: "social-channels",
    title: "Reseaux sociaux et partage",
    percent: 55,
    status: "in_progress",
    next: "Connecter plus tard Facebook/Instagram API si le compte Meta Business est pret.",
  },
  {
    id: "delivery-zones",
    title: "Zones desservies",
    percent: 68,
    status: "in_progress",
    next: "Mieux connecter zones au bot WhatsApp et aux commandes.",
  },
  {
    id: "orders-delivery",
    title: "Commandes et livraison",
    percent: 76,
    status: "in_progress",
    next: "Rendre le cycle commande plus visuel et plus court.",
  },
  {
    id: "seller-profile",
    title: "Profil vendeur simple",
    percent: 45,
    status: "planned",
    next: "Ajouter profil, sécurité, photo et appareils connectés.",
  },
];

export function getAynidRoadmapProgress() {
  const total = aynidInspiredRoadmap.reduce((sum, item) => sum + item.percent, 0);
  return Math.round(total / aynidInspiredRoadmap.length);
}

export function getRoadmapStatusLabel(status) {
  if (status === "done") return "Fait";
  if (status === "in_progress") return "En cours";
  return "A faire";
}
