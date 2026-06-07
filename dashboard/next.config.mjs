/** @type {import('next').NextConfig} */

const supabaseHost = "suhqntkvldwzrzaidnsw.supabase.co";

const cspDirectives = [
  // Sources par défaut : self uniquement
  "default-src 'self'",
  // Scripts : self + inline nécessaire pour Next.js hydration
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co",
  // Styles : self + inline (CSS-in-JS, Tailwind)
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Polices Google Fonts
  "font-src 'self' https://fonts.gstatic.com",
  // Images : self, données base64, Cloudinary, Supabase Storage, Unsplash (fallback produits)
  `img-src 'self' data: blob: https://res.cloudinary.com https://${supabaseHost} https://images.unsplash.com`,
  // Connexions API : Supabase, Evolution API, n8n, Gemini, Paystack, Cloudinary
  [
    "connect-src 'self'",
    `https://${supabaseHost}`,
    `wss://${supabaseHost}`,
    "https://evolution-tikchop.76.13.59.214.sslip.io",
    "https://n8n.sakamomo.tech",
    "https://generativelanguage.googleapis.com",
    "https://api.paystack.co",
    "https://api.cloudinary.com",
    "https://res.cloudinary.com",
  ].join(" "),
  // Médias (audio vocal)
  "media-src 'self' blob:",
  // Frames : Paystack popup uniquement
  "frame-src 'self' https://checkout.paystack.com",
  // Workers (Next.js service worker)
  "worker-src 'self' blob:",
  // Formulaires
  "form-action 'self'",
  // Empêche le chargement dans une iframe externe (clickjacking)
  "frame-ancestors 'none'",
].join("; ");

const nextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: supabaseHost,
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: cspDirectives,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
