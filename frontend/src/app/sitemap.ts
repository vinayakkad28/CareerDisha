import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://careerneeti.in";

/** sitemap.xml — previously a 404. Public, indexable pages only. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: BASE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/quiz`, lastModified, changeFrequency: "monthly", priority: 0.9 },
  ];
}
