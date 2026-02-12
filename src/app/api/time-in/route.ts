import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { addTimeInToQueue } from "@/lib/emailQueue";
import { validateEnvironment } from "@/lib/validateEnv";

validateEnvironment();


export const runtime = "nodejs";

/* =======================
   Configuration
======================= */

const SHIFT_HOUR = 9;
const MAX_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

/* =======================
   Rate limiting
======================= */

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 10;
const rateMap = new Map<string, { count: number; ts: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now - entry.ts > RATE_LIMIT_WINDOW) {
    rateMap.set(ip, { count: 1, ts: now });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

/* =======================
   Race lock
======================= */

const timeInLocks = new Set<string>();

/* =======================
   Helpers
======================= */

function sanitizeCSV(value: string): string {
  let v = String(value).replace(/"/g, '""');
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return v.replace(/[\x00-\x1F\x7F]/g, "");
}

function sanitizeEmail(email: string): string {
  return email.replace(/[^a-z0-9@._-]/gi, "_");
}

function sanitizeExt(name: string): string {
  return path.extname(name).toLowerCase().replace(/[^a-z.]/g, "");
}

function isValidImageMagic(buf: Buffer): boolean {
  const sigs = [
    [0xff, 0xd8, 0xff], // jpg
    [0x89, 0x50, 0x4e, 0x47], // png
    [0x52, 0x49, 0x46, 0x46] // webp
  ];
  return sigs.some(sig => sig.every((b, i) => buf[i] === b));
}

function logError(msg: string, err?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.error(msg, err);
  } else {
    console.error(msg);
  }
}

/* =======================
   Route
======================= */

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json({ message: "Too many requests" }, { status: 429 });
    }

    const formData = await req.formData();
    const name = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim();
    const file = formData.get("attachment") as File | null;

    if (!name || !email) {
      return NextResponse.json({ message: "Name and email required" }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ message: "Invalid email format" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();

    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
    );

    const date = now.toLocaleDateString("en-CA");
    const timeIn = now.toLocaleTimeString("en-US");

    const shiftStart = new Date(now);
    shiftStart.setHours(SHIFT_HOUR, 1, 0, 0);
    const status = now <= shiftStart ? "On Time" : "Late";

    const lockKey = `${normalizedEmail}-${date}`;
    if (timeInLocks.has(lockKey)) {
      return NextResponse.json({ message: "Duplicate request" }, { status: 409 });
    }
    timeInLocks.add(lockKey);

    try {
      const dataDir = path.join(process.cwd(), "data");
      const uploadsDir = path.join(process.cwd(), "uploads");
      const csvPath = path.join(dataDir, "time-in.csv");

      fs.mkdirSync(dataDir, { recursive: true });
      fs.mkdirSync(uploadsDir, { recursive: true });

      if (!fs.existsSync(csvPath)) {
        fs.writeFileSync(csvPath, "Name,Email,Date,Time In,Status\n");
      }

      const csv = fs.readFileSync(csvPath, "utf8");
      if (csv.includes(`"${normalizedEmail}","${date}"`)) {
        return NextResponse.json({ message: "Already timed in today" }, { status: 409 });
      }

      const row =
        `"${sanitizeCSV(name)}","${sanitizeCSV(normalizedEmail)}","${date}","${timeIn}","${status}"\n`;

      fs.appendFileSync(csvPath, row);

      let imagePath: string | null = null;

      if (file) {
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
          return NextResponse.json({ message: "Invalid image type" }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
          return NextResponse.json({ message: "Image too large" }, { status: 400 });
        }

        const ext = sanitizeExt(file.name);
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          return NextResponse.json({ message: "Invalid file extension" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        if (!isValidImageMagic(buffer)) {
          return NextResponse.json({ message: "Invalid image content" }, { status: 400 });
        }

        const filename = `${Date.now()}-${sanitizeEmail(normalizedEmail)}-${crypto.randomUUID()}${ext}`;
        imagePath = path.join(uploadsDir, path.basename(filename));
        fs.writeFileSync(imagePath, buffer);
      }

      try {
        addTimeInToQueue(row, imagePath ? [imagePath] : []);
      } catch {
        return NextResponse.json(
          { message: "System busy, please try again later" },
          { status: 503 }
        );
      }

      return NextResponse.json({ status, timeIn, date });
    } finally {
      timeInLocks.delete(lockKey);
    }
  } catch (err) {
    logError("Time-in route failed", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}