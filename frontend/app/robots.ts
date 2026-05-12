import type { MetadataRoute } from "next";

const siteUrl = "https://pokesim.kr";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/sets/", "/boxes/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
