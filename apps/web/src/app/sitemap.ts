import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://zk-aidshield.vercel.app';

const ROUTES = [
  '',
  '/judges',
  '/auditor',
  '/audit',
  '/threats',
  '/edge',
  '/claim',
  '/admin',
  '/stats',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route === '/judges' || route === '/claim' ? 0.9 : 0.7,
  }));
}
