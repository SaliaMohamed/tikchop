import LegalPage from "../components/LegalPage";

export const metadata = {
  title: "Confidentialite | Tikchop",
  description: "Politique de confidentialite Tikchop.",
};

export default function ConfidentialitePage() {
  return (
    <LegalPage
      eyebrow="Donnees personnelles"
      title="Politique de confidentialite"
      intro="Cette page explique les donnees traitees par Tikchop pour faire fonctionner les boutiques, les commandes, les recus et les messages de suivi."
      sections={[
        {
          title: "Donnees collectees",
          body: [
            "Tikchop peut traiter le nom de la boutique, le numero WhatsApp du vendeur, les articles, les prix, les photos, les commandes, les numeros clients, les adresses de livraison et les informations de paiement necessaires au suivi.",
            "Les donnees de paiement sensibles sont traitees par les prestataires de paiement. Tikchop ne doit pas stocker les codes secrets, OTP ou identifiants confidentiels des clients.",
          ],
        },
        {
          title: "Utilisation",
          body: [
            "Les donnees servent a afficher la boutique, creer les commandes, generer les recus, preparer la livraison, notifier le vendeur et ameliorer le support.",
            "Les informations client ne doivent pas etre utilisees pour du spam. Les relances commerciales doivent rester raisonnables et liees a l'activite de la boutique.",
          ],
        },
        {
          title: "Conservation et suppression",
          body: [
            "Les donnees sont conservees aussi longtemps que necessaire pour assurer le suivi commercial, la preuve de commande et le support.",
            "Un vendeur ou un client peut demander une correction ou suppression de donnees en contactant support@tikchop.app, sous reserve des obligations de preuve ou de securite applicables.",
          ],
        },
      ]}
    />
  );
}
