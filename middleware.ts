import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = [
  "https://wellevate.ch",
  "https://www.wellevate.ch",
  "https://localhost:3000"
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
