import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { headers } from "next/headers";
import { addTimeInToQueue } from "@/lib/emailQueue";

export const runtime = "nodejs"; // Required for fs
const SHIFT_HOUR = 9; // 9:00 AM exact

export async function POST(req: Request) {
  try {
    const { name, email } = await req.json();

    // Validation
    if (!name || !email) {
      return NextResponse.json({ message: "Name and email are required" }, { status: 400 });
    }
    if (name.length > 100 || email.length > 100) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Current time in Philippines timezone
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const date = now.toLocaleDateString("en-CA"); // YYYY-MM-DD
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

    // CSV paths
    const dataDir = path.join(process.cwd(), "data");
    const filePath = path.join(dataDir, "time-in.csv");

    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    // Create CSV with header if missing
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "Name,Email,Date,Time In,Status,IP\n");
    }

    // Prevent duplicate time-in
    const csv = fs.readFileSync(filePath, "utf8");
    const alreadyTimedIn = csv
      .split("\n")
      .slice(1)
      .some(line => {
        const cols = line.split(",");
        const rowEmail = cols[1]?.replace(/"/g, "").toLowerCase();
        const rowDate = cols[2]?.replace(/"/g, "");
        return rowEmail === normalizedEmail && rowDate === date;
      });

    if (alreadyTimedIn) {
      return NextResponse.json({ message: "You already timed in today" }, { status: 409 });
    }

    // Append new row to main CSV
    const row = `"${name}","${normalizedEmail}","${date}","${timeIn}","${status}","${ip}"\n`;
    fs.appendFileSync(filePath, row);

    // Add row to batch queue for delayed email
    addTimeInToQueue(row);

    return NextResponse.json({
      message: "Time in recorded successfully",
      status,
      timeIn,
      date,
    });
  } catch (err) {
    console.error("Time-in route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
