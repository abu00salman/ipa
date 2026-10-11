import { readBlob, blobExists } from "@/lib/storage";
import { getAppBySlug } from "@/lib/db";
import { currentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; index: string }> }) {
  const { slug, index } = await params;
  const app = getAppBySlug(slug);
  const path = app?.screenshots[Number(index)];
  if (!app || (!app.published && !(await currentAdmin())) || !path || !(await blobExists(path))) {
    return new Response("Not found", { status: 404 });
  }
  const data = await readBlob(path);
  const type = path.endsWith(".png") ? "image/png" : "image/jpeg";
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" },
  });
}
