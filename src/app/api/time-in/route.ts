import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { addTimeInToQueue } from "@/lib/emailQueue";
import { validateEnvironment } from "@/lib/validateEnv";
import { sendConfirmationEmail } from "@/lib/sendConfirmationEmail";

validateEnvironment();

export const runtime = "nodejs";

/* =======================
   Configuration
======================= */

const SHIFT_CONFIG: Record<string, { openHour: number | null; openMinute: number | null; startHour: number; startMinute: number; label: string }> = {
  "Regular Shift": { openHour: null, openMinute: null, startHour: 9,  startMinute: 0, label: "Regular Shift" },
  "Mid Shift":     { openHour: 14,   openMinute: 0,    startHour: 15, startMinute: 0, label: "Mid Shift"     },
  "Half Day":      { openHour: 13,   openMinute: 0,    startHour: 14, startMinute: 0, label: "Half Day"      },
};

const VALID_SHIFTS = Object.keys(SHIFT_CONFIG);

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
    [0xff, 0xd8, 0xff],
    [0x89, 0x50, 0x4e, 0x47],
    [0x52, 0x49, 0x46, 0x46],
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

function getShiftStatus(now: Date, shift: string): { status: string; tooEarly: boolean; opensAt: string } {
  const config = SHIFT_CONFIG[shift];

  // Only check open window if the shift has one defined
  if (config.openHour !== null && config.openMinute !== null) {
    const windowOpen = new Date(now);
    windowOpen.setHours(config.openHour, config.openMinute, 0, 0);

    if (now < windowOpen) {
      const opensAtLabel = windowOpen.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return { status: "Too Early", tooEarly: true, opensAt: opensAtLabel };
    }
  }

  const cutoff = new Date(now);
  cutoff.setHours(config.startHour, config.startMinute + 1, 0, 0);

  const status = now <= cutoff ? "On Time" : "Late";
  return { status, tooEarly: false, opensAt: "" };
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
    const name  = (formData.get("name")  as string)?.trim();
    const email = (formData.get("email") as string)?.trim();
    const shift = (formData.get("shift") as string)?.trim();
    const file  = formData.get("attachment") as File | null;

    // ── Basic field validation ──
    if (!name || !email) {
      return NextResponse.json({ message: "Name and email required" }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ message: "Invalid email format" }, { status: 400 });
    }

    // ── Shift validation ──
    if (!shift || !VALID_SHIFTS.includes(shift)) {
      return NextResponse.json({ message: "Invalid or missing shift selection" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();

    // ── Blocked email check ──
    const blockedEmails = (process.env.BLOCKED_EMAILS || "")
      .split(",")
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    if (blockedEmails.includes(normalizedEmail)) {
      return NextResponse.json(
        { message: "This email is not allowed to time in. Please contact your administrator." },
        { status: 403 }
      );
    }

    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
    );

    // ── Shift timing validation ──
    const { status, tooEarly, opensAt } = getShiftStatus(now, shift);

if (tooEarly) {
  return NextResponse.json(
    { message: `Time-in for ${shift} Available at ${opensAt}. Please come back then.` },
    { status: 400 }
  );
}

    const date   = now.toLocaleDateString("en-CA");
    const timeIn = now.toLocaleTimeString("en-US");

    const lockKey = `${normalizedEmail}-${date}`;
    if (timeInLocks.has(lockKey)) {
      return NextResponse.json({ message: "Duplicate request" }, { status: 409 });
    }
    timeInLocks.add(lockKey);

    try {
      const dataDir    = path.join(process.cwd(), "data");
      const uploadsDir = path.join(process.cwd(), "uploads");
      const csvPath    = path.join(dataDir, "time-in.csv");

      fs.mkdirSync(dataDir,    { recursive: true });
      fs.mkdirSync(uploadsDir, { recursive: true });

      // ── Write CSV header if new file (now includes Shift column) ──
      if (!fs.existsSync(csvPath)) {
        fs.writeFileSync(csvPath, "Name,Email,Shift,Date,Time In,Status\n");
      }

      const csv = fs.readFileSync(csvPath, "utf8");
      if (csv.includes(`"${normalizedEmail}","${date}"`)) {
        return NextResponse.json({ message: "Already timed in today" }, { status: 409 });
      }

      // ── Append row (Shift added after Email) ──
      const row =
        `"${sanitizeCSV(name)}","${sanitizeCSV(normalizedEmail)}","${sanitizeCSV(shift)}","${date}","${timeIn}","${status}"\n`;

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

      sendConfirmationEmail({ name, email: normalizedEmail, timeIn, date, status }).catch((err) => {
        logError("Confirmation email failed", err);
      });

      return NextResponse.json({ status, timeIn, date, shift });

    } finally {
      timeInLocks.delete(lockKey);
    }
  } catch (err) {
    logError("Time-in route failed", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}