import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://careerneeti.in";

/** robots.txt — previously a 404. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Staff tooling and anything keyed by a personal token must never be
        // indexed: /reports/<token> and the survey links identify a real child.
        disallow: [
          "/dashboard",
          "/schools",
          "/sessions",
          "/students",
          "/settings",
          "/school-portal",
          "/login",
          "/reports/",
          "/feedback",
          "/outcome",
          "/assessment",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
