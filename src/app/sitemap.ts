import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: getSiteUrl().toString(), changeFrequency: "weekly", priority: 1 }];
}

