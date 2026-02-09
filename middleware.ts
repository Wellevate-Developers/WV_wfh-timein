// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAllowedIp } from "@/lib/ip-utils";

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export function middleware(req: NextRequest) {
  const ip = getClientIp(req);

  // Block if IP not in office network
  if (!ip || !isAllowedIp(ip)) {
    return new NextResponse("Access Denied", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/wfh-timein/onsite-time-in/:path*",
    "/api/time-in/:path*"
  ]
};
