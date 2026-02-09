// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAllowedIp } from "@/lib/ip-utils";

const ALLOWED_ORIGINS = [
  "https://wellevate.ch",
  "https://www.wellevate.ch",
  "https://localhost:3000"
];

// Helper to get client IP
function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take first IP if multiple
    return forwarded.split(",")[0].trim();
  }

  return req.headers.get("x-real-ip");
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");
  const clientIp = getClientIp(req);

  // 🔐 ORIGIN CHECK
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new NextResponse("Forbidden (Invalid Origin)", { status: 403 });
  }

  // 🔐 IP CHECK
  if (clientIp && !isAllowedIp(clientIp)) {
    return new NextResponse("Forbidden (IP Not Allowed)", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/time-in"]
};
