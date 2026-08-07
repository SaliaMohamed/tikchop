import "./globals.css";
import AppChrome from "./AppChrome";

export const metadata = {
  title: "Tikchop | Assistant de vente WhatsApp a Abidjan",
  description: "Application et chatbot WhatsApp pour transformer les messages TikTok en commandes suivies.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tikchop",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f4fbf4",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
