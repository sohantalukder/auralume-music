import type { NextConfig } from "next";

// Report-only until it has been observed in production; Next's inline bootstrap
// scripts need 'unsafe-inline' unless nonces are added through a proxy.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com https://*.ytimg.com https://archive.org https://*.archive.org",
  "media-src 'self' blob: https://archive.org https://*.archive.org",
  "connect-src 'self'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
  // Dev mode evaluates code for fast refresh, which this policy would report on every load.
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(process.env.NODE_ENV === "development" ? { allowedDevOrigins: ["127.0.0.1", "192.168.0.102"] } : {}),
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
