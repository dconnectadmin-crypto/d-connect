import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, roleHome, verifyToken, type Role } from "@/lib/token";

const areas: Record<string, Role> = { "/rider": "RIDER", "/captain": "CAPTAIN", "/admin": "ADMIN" };

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // CSRF defence in depth (cookie is also SameSite=Lax): reject cross-origin state-changing API calls.
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      let host = "";
      try { host = new URL(origin).host; } catch {}
      if (host !== req.headers.get("host")) return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }
  }
  const area = Object.keys(areas).find(a => pathname === a || pathname.startsWith(a + "/"));
  if (!area) return NextResponse.next();
  const token = req.cookies.get(COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (areas[area] !== session.role) return NextResponse.redirect(new URL(roleHome(session.role), req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/rider/:path*", "/captain/:path*", "/admin/:path*", "/api/:path*"] };
