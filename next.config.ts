import type { NextConfig } from "next";

// Content-Security-Policy sobria para una app interna: sin CDNs externos,
// sin inline scripts salvo el nonce-less mínimo que Next requiere para
// hidratación (Next inyecta sus propios <script> de framework, permitidos
// por 'self'). No cargamos fuentes, imágenes ni scripts de terceros.
//
// En DESARROLLO (`next dev`) se añade 'unsafe-eval' y el websocket de HMR:
// el runtime de desarrollo de React/Next los necesita para hidratar. La
// CSP de producción (`next build` + `next start`, y Vercel) queda idéntica
// a antes — el equipo solo recupera el `npm run dev`.
const isDev = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // Es una app interna: nunca debe indexarse ni sugerirse en buscadores.
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
