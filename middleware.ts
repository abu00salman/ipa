import { NextResponse, type NextRequest } from "next/server";

/** Sends www.<domain> to the canonical apex domain. Only active when PRIMARY_DOMAIN is set. */
export function middleware(request: NextRequest) {
  const primary = process.env.PRIMARY_DOMAIN?.trim();
  const host = request.headers.get("host") ?? "";
  if (primary && host === `www.${primary}`) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${primary}`);
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
