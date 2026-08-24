/** @type {import('next').NextConfig} */

// The deployed site sent no security headers at all — no CSP, no
// X-Frame-Options, no Referrer-Policy — while serving a report page that
// displays a child's name, school and psychometric profile.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js injects inline bootstrap scripts; Razorpay's checkout is loaded
      // from their CDN and is required for the payment step to function.
      "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // API calls go to the backend origin; Razorpay opens its own frames.
      "connect-src 'self' https://*.railway.app https://*.onrender.com https://api.razorpay.com https://lumberjack.razorpay.com",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  // Report links are shared over WhatsApp; clickjacking them would expose a
  // child's profile inside an attacker's page.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
