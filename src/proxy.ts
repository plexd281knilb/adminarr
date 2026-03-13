import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Must match the key used in your auth-actions.ts
const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || "default-secret-key-change-me");

// Change "proxy" to "proxy" here
export async function proxy(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  const { pathname } = req.nextUrl;

  // 1. ALLOW THE LOGIN PAGE
  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // 2. CHECK FOR A SESSION ON ALL OTHER PAGES
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 3. VERIFY THE SESSION IS VALID AND NOT EXPIRED
  try {
    await jwtVerify(session, SECRET_KEY);
    return NextResponse.next(); 
  } catch (err) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};