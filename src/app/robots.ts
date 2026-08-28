import type { MetadataRoute } from "next";

// App interna: se bloquea todo rastreo. Se complementa con el header
// "X-Robots-Tag: noindex" configurado globalmente en next.config.ts.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
