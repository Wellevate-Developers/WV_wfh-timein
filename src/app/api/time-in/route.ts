import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { headers } from "next/headers";
import { addTimeInToQueue } from "@/lib/emailQueue"; // handles delayed email sending

export const runtime = "nodejs";

const SHIFT_HOUR = 9;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const file = formData.get("attachment") as File | null;

    // Validation
    if (!name || !email) {
      return NextResponse.json({ message: "Name and email required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Image validation
    let savedImagePath: string | null = null;
    if (file) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ message: "Only image files allowed" }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ message: "Image exceeds 5MB" }, { status: 400 });
      }
    }

    // Current time in Philippines
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const date = now.toLocaleDateString("en-CA");
    const timeIn = now.toLocaleTimeString("en-US");

    // Shift status
    const shiftStart = new Date(now);
    shiftStart.setHours(SHIFT_HOUR, 0, 0, 0);
    const status = now <= shiftStart ? "On Time" : "Late";

    // Client IP
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0] ||
      headersList.get("x-real-ip") ||
      "Unknown";

    // Directories and CSV
    const dataDir = path.join(process.cwd(), "data");
    const uploadsDir = path.join(process.cwd(), "uploads");
    const csvPath = path.join(dataDir, "time-in.csv");

    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(uploadsDir, { recursive: true });

    if (!fs.existsSync(csvPath)) {
      fs.writeFileSync(csvPath, "Name,Email,Date,Time In,Status,IP\n");
    }

    // Prevent duplicate time-in
    const csv = fs.readFileSync(csvPath, "utf8");
    const exists = csv
      .split("\n")
      .slice(1)
      .some(line => {
        const cols = line.split(",");
        return cols[1]?.replace(/"/g, "") === normalizedEmail &&
               cols[2]?.replace(/"/g, "") === date;
      });

    if (exists) {
      return NextResponse.json({ message: "Already timed in today" }, { status: 409 });
    }

    // Append to CSV
    const row = `"${name}","${normalizedEmail}","${date}","${timeIn}","${status}","${ip}"\n`;
    fs.appendFileSync(csvPath, row);

    // Save uploaded image
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name);
      const filename = `${Date.now()}-${normalizedEmail}${ext}`;
      savedImagePath = path.join(uploadsDir, filename);
      fs.writeFileSync(savedImagePath, buffer);
    }

    // Add to batch queue for admin email (CSV + any images)
    addTimeInToQueue(row, savedImagePath ? [savedImagePath] : []);

    return NextResponse.json({ status, timeIn, date });
  } catch (err) {
    console.error("Time-in route error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
