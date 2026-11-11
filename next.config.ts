import type { NextConfig } from "next";

/**
 * Two targets from one config:
 *  - default (`next dev`, `next build` + `next start`): a normal Next server.
 *  - GITHUB_PAGES=true: a fully static export into `out/` for GitHub Pages.
 *    NEXT_PUBLIC_BASE_PATH carries the project-site prefix ("/repo"), or is
 *    empty when the site sits at a domain root (custom domain / user site).
 */
const isPages = process.env.GITHUB_PAGES === "true";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["framer-motion", "@react-three/drei"],
  },
  ...(isPages
    ? {
        output: "export" as const,
        basePath: basePath || undefined,
        // /en → en/index.html, which every static host resolves.
        trailingSlash: true,
        // No image optimizer on a static host: serve the source files as they are.
        images: { unoptimized: true },
      }
    : {
        images: { formats: ["image/avif", "image/webp"] as ("image/avif" | "image/webp")[] },
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "X-Frame-Options", value: "SAMEORIGIN" },
                { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
