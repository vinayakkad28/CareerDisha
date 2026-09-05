/** @type {import('next').NextConfig} */

// The deployed site sent no security headers at all — no CSP, no
// X-Frame-Options, no Referrer-Policy — while serving a report page that
// displays a child's name, school and psychometric profile.
const isProd = process.env.NODE_ENV === "production" && !process.env.ALLOW_LOCAL_API;

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js injects inline bootstrap scripts. No third-party script origin
      // is permitted — the Razorpay checkout CDN was the only one and is gone.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // API calls go to the backend origin. Nothing else is embedded.
      //
      // localhost is allowed outside production only. The CSP applied in every
      // environment, so `next dev` against a local backend was blocked before a
      // single request left the page — the flow could not be rehearsed locally,
      // which is how a school visit gets debugged on the day instead of before.
      `connect-src 'self' https://*.railway.app https://*.onrender.com${
        isProd ? "" : " http://localhost:* http://127.0.0.1:*"
      }`,
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  // Clickjacking a report link would expose a child's profile inside an
  // attacker's page.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
