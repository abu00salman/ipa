import { readFile } from "node:fs/promises";
import { derivedKey, verifyPayload } from "@/lib/crypto";
import { bumpCounter, getAppBySlug } from "@/lib/db";
import { dataPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Serves the signed IPA only with a valid, unexpired token issued by the manifest route. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const claims = verifyPayload<{ slug: string; exp: number }>(token, derivedKey("download"));
  if (!claims || claims.slug !== slug || claims.exp < Date.now()) {
    return new Response("Forbidden", { status: 403 });
  }

  const app = getAppBySlug(slug);
  if (!app || !app.published || !app.signedPath) return new Response("Not found", { status: 404 });

  const data = await readFile(dataPath(app.signedPath));
  bumpCounter(app.id, "downloads");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(data.length),
      "Content-Disposition": `attachment; filename="${app.slug}.ipa"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
