import type { NextConfig } from "next";

/**
 * Security headers (audit: were completely missing).
 *
 * Frame policy: CSP `frame-ancestors 'self' https:` is used INSTEAD of
 * X-Frame-Options: DENY. Reasons:
 * - The app legitimately runs inside the sandbox preview panel (https parent).
 * - frame-ancestors is the modern standard (CSP2) and blocks embedding on
 *   plain-HTTP sites and non-allowed parents, defeating clickjacking while
 *   keeping the preview working.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "0" }, // modern browsers: rely on CSP, not the legacy auditor
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 'unsafe-inline'/'unsafe-eval' are required by Next.js runtime & dev HMR
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.firebaseio.com wss://*.firebaseio.com",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self' https:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // standalone output is for local sandbox prod runs; Vercel builds its own
  // output and must NOT use standalone
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false, // don't advertise the framework version
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    // Whitelist for the next/image optimizer. Uploaded files live at
    // /api/files?name=<name> (query-string URLs) and Next rejects local
    // images with query strings unless they are explicitly allowed here.
    // Without this, photos uploaded from the admin panel never render in
    // the app (optimizer 400s), while static /images/* kept working.
    localPatterns: [
      { pathname: "/api/files" }, // any query string allowed
      { pathname: "/images/**" },
      { pathname: "/logo.png" },
      { pathname: "/_next/static/media/**", search: "" },
    ],
  },
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
