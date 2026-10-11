import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppDetail } from "../../../components/Store";
import { catalog } from "../../../lib/catalog";

export const dynamicParams = false;

export function generateStaticParams() {
  // Next.js refuses an empty list with output: "export", so an empty catalog emits one placeholder that 404s.
  const slugs = catalog.apps.map((app) => app.slug);
  return (slugs.length ? slugs : ["_none"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const app = catalog.apps.find((a) => a.slug === slug);
  return app ? { title: app.name, description: app.description.slice(0, 160) || app.name } : { title: "Not found" };
}

export default async function AppPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = catalog.apps.find((a) => a.slug === slug);
  if (!app) notFound();
  return <AppDetail app={app} />;
}
