import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = [
  "https://well-evate.com",
  "https://www.well-evate.com",
  "https://apps.well-evate.com",      // ← without www (most likely your real one)
  "https://www.apps.well-evate.com",  // ← with www
  "http://localhost:3000",
];

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");

  // Block cross-site requests
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/time-in"]
};