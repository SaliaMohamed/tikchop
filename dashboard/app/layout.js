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
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
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
