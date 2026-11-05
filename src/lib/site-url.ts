import "server-only";

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  return new URL(configuredUrl || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000"));
}

