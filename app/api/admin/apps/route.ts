import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { config } from "@/lib/env";
import { IpaError } from "@/lib/ipa/parse";
import { ingestIpa } from "@/lib/ingest";
import { addLog, getAppById } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Upload a new IPA, or replace the binary of an existing app by passing appId. */
export async function POST(request: Request) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > config.maxUploadBytes) {
    return NextResponse.json({ ok: false, message: "file_too_large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "bad_request" }, { status: 400 });
  }

  const file = form.get("file");
  const appId = String(form.get("appId") ?? "") || undefined;
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, message: "file_required" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".ipa")) {
    return NextResponse.json({ ok: false, message: "not_ipa_extension" }, { status: 415 });
  }
  if (file.size > config.maxUploadBytes) {
    return NextResponse.json({ ok: false, message: "file_too_large" }, { status: 413 });
  }

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const { app, info, replacedBuild } = await ingestIpa(data, appId);
    return NextResponse.json({
      ok: true,
      id: app.id,
      slug: app.slug,
      replacedBuild,
      analysis: {
        bundleId: info.bundleId,
        name: info.name,
        version: info.version,
        build: info.build,
        minIos: info.minIos,
        devices: info.devices,
        sizeBytes: info.sizeBytes,
        hasIcon: Boolean(info.icon),
        alreadySigned: info.alreadySigned,
      },
    });
  } catch (err) {
    const message = (err as Error).message;
    addLog("error", "upload", "فشل تحليل ملف IPA", { error: message, file: file.name.slice(0, 120) });
    const status = err instanceof IpaError ? 422 : getAppById(appId ?? "") ? 409 : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
