import fs from "fs";
import path from "path";
import { sendCSVEmail } from "./sendCSVEmail";

/* =======================
   Configuration
======================= */

const MAX_BATCH_SIZE = 10;
const MAX_QUEUE_SIZE = 100; // 🛑 HARD LIMIT
const BATCH_DELAY = 5 * 60 * 1000; // 5 minutes

let timeout: NodeJS.Timeout | null = null;

type QueueItem = {
  row: string;
  images: string[];
};

const pendingTimeIns: QueueItem[] = [];

/* =======================
   Safe logger
======================= */

function logError(message: string, err?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.error(message, err);
  } else {
    console.error(message);
  }
}

/* =======================
   Public API
======================= */

export function addTimeInToQueue(row: string, images: string[] = []) {
  if (pendingTimeIns.length >= MAX_QUEUE_SIZE) {
    throw new Error("Email queue full");
  }

  pendingTimeIns.push({ row, images });

  if (process.env.NODE_ENV !== "production") {
    console.log(`📥 Queued (${pendingTimeIns.length}/${MAX_BATCH_SIZE})`);
  }

  // 🚀 Flush immediately if batch full
  if (pendingTimeIns.length >= MAX_BATCH_SIZE) {
    void flushQueue();
    return;
  }

  // ⏱️ Start delay timer once
  if (!timeout) {
    timeout = setTimeout(() => {
      void flushQueue();
    }, BATCH_DELAY);
  }
}

/* =======================
   Internal worker
======================= */

async function flushQueue() {
  if (pendingTimeIns.length === 0) return;

  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }

  const dataDir = path.join(process.cwd(), "data");
  const uploadsDir = path.join(process.cwd(), "uploads");
  const batchFile = path.join(dataDir, "batch-time-in.csv");
  const mainCSV = path.join(dataDir, "time-in.csv");

  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(uploadsDir, { recursive: true });

    fs.writeFileSync(batchFile, "Name,Email,Date,Time In,Status\n");
    fs.appendFileSync(batchFile, pendingTimeIns.map(i => i.row).join(""));

    const images = pendingTimeIns.flatMap(i => i.images);

    await sendCSVEmail(batchFile, images);

    // 🧹 Cleanup
    if (fs.existsSync(batchFile)) fs.unlinkSync(batchFile);
    if (fs.existsSync(mainCSV)) fs.unlinkSync(mainCSV);

    images.forEach(img => {
      if (fs.existsSync(img)) fs.unlinkSync(img);
    });

    pendingTimeIns.length = 0;
  } catch (err) {
    logError("Batch email send failed", err);
    // Queue remains for retry
  }
}
