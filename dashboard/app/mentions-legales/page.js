import LegalPage from "../components/LegalPage";

export const metadata = {
  title: "Mentions legales | Tikchop",
  description: "Informations legales de Tikchop.",
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      eyebrow="Cadre legal"
      title="Mentions legales"
      intro="Ces informations presentent le service Tikchop, son role et les limites importantes a connaitre avant une utilisation commerciale."
      sections={[
        {
          title: "Service",
          body: [
            "Tikchop est un outil de boutique en ligne, de suivi de commandes et d'assistance WhatsApp pour vendeurs.",
            "Tikchop aide a presenter les articles, organiser les commandes, preparer les paiements et faciliter la livraison. Le vendeur reste responsable de ses produits, de ses prix, de ses stocks et de ses clients.",
          ],
        },
        {
          title: "Editeur et contact",
          body: [
            "Tikchop est exploite comme service numerique en phase de lancement commercial accompagne.",
            "Pour toute demande officielle, correction d'information ou retrait de contenu, contactez le support a support@tikchop.app.",
          ],
        },
        {
          title: "Responsabilites du vendeur",
          body: [
            "Le vendeur doit publier des photos conformes, des prix exacts, des stocks realistes et des conditions de livraison claires.",
            "Le vendeur doit respecter les regles applicables a son activite, notamment la protection du consommateur, la fiscalite, la livraison et les moyens de paiement utilises.",
          ],
        },
      ]}
    />
  );
}
