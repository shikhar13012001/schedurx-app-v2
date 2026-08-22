import { withSentryConfig } from "@sentry/nextjs";

// The backend droplet is plain HTTP (no TLS) while this app is served over
// HTTPS on Vercel — a client-side fetch() straight to the backend is blocked
// as mixed content (confirmed live: the deployed app was calling
// NEXT_PUBLIC_API_BASE_URL directly from the browser, which either 404s
// against a misconfigured value or gets silently blocked once pointed at the
// real droplet). Routing /api/v1/* through this same-origin rewrite instead
// means the browser only ever talks to this app's own HTTPS origin; Vercel's
// server proxies the request on to the backend over plain HTTP itself, where
// the browser's mixed-content policy doesn't apply. src/lib/api-client.ts
// and ai-sheet.tsx now call relative /api/v1/... paths in the browser
// instead of prefixing NEXT_PUBLIC_API_BASE_URL — this rewrite is what makes
// that resolve to the real backend. NEXT_PUBLIC_API_BASE_URL must still be
// set correctly (the real backend origin) for this rewrite's destination —
// it no longer needs to be reachable directly from a browser, only from
// Vercel's own server.
// Vercel's rewrite engine rejects a raw IP-literal destination outright
// (DNS_HOSTNAME_RESOLVED_PRIVATE, confirmed live against the real droplet
// IP — a blanket SSRF-safety heuristic against IP literals, not an actual
// check of whether the IP is public) even though NEXT_PUBLIC_API_BASE_URL
// was correctly set to the real address. The droplet has no domain name of
// its own (see PRODUCTION_CHECKLIST.md's "No TLS" item), so this rewrites a
// bare-IP origin to the equivalent nip.io hostname — free wildcard DNS that
// resolves "1-2-3-4.nip.io" straight back to 1.2.3.4 — giving Vercel an
// actual hostname to accept without needing any real DNS/domain setup.
function backendOrigin() {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4005").replace(/\/$/, "");
  const match = raw.match(/^(https?:\/\/)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(:\d+)?$/);
  if (!match) return raw;
  const [, scheme, a, b, c, d, port] = match;
  return `${scheme}${a}-${b}-${c}-${d}.nip.io${port ?? ""}`;
}

// Standalone output lets the Dockerfile ship a minimal, self-contained
// runtime (just .next/standalone + static assets) instead of the full
// node_modules tree.
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${backendOrigin()}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        // Applies to every route — this app has no embeddable/public pages
        // that need a looser policy.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            // 'unsafe-inline'/'unsafe-eval' on script-src are required by
            // Next.js's own inline bootstrap scripts and React Fast Refresh
            // in dev — tightening this further needs per-script nonces,
            // which Next 14's Pages/App Router hybrid doesn't wire up by
            // default. apis.google.com/gstatic.com/accounts.google.com are
            // required by Firebase Auth's signInWithPopup(googleProvider) —
            // confirmed live: without script-src allowing apis.google.com,
            // the gapi iframe helper it injects gets blocked and Google
            // sign-in breaks entirely. connect-src includes the backend
            // origin and Firebase/Supabase/ElevenLabs endpoints this app
            // actually calls — note apis.google.com is its own domain, not a
            // *.googleapis.com subdomain, so it needs its own entry too.
            // The raw-IP:4000 entry this used to carry (from before
            // api.schedurx.com had TLS) is gone — that port's closed to the
            // public internet now, so the allowance was dead weight.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://apis.google.com https://accounts.google.com https://*.supabase.co wss://*.supabase.co https://*.schedurx.com",
              "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

// Wrapping is inert without SENTRY_AUTH_TOKEN/org/project set at build time
// (source-map upload silently skips) — the runtime SDK itself only reports
// anything once NEXT_PUBLIC_SENTRY_DSN is set, see sentry.*.config.ts.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  webpack: { treeshake: { removeDebugLogging: true } },
});
