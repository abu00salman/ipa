import { readBlob, blobExists } from "@/lib/storage";
import { getAppBySlug } from "@/lib/db";
import { currentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = getAppBySlug(slug);
  // Unpublished apps are private: only the signed-in admin may fetch their media.
  if (!app || (!app.published && !(await currentAdmin())) || !app.iconPath || !(await blobExists(app.iconPath))) {
    return new Response("Not found", { status: 404 });
  }
  const data = await readBlob(app.iconPath);
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
  });
}
