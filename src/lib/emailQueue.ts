import fs from "fs";
import path from "path";
import { sendCSVEmail } from "./sendCSVEmail";

const MAX_BATCH_SIZE = 10;
const BATCH_DELAY = 5 * 60 * 1000; // 5 minutes

let timeout: NodeJS.Timeout | null = null;

type QueueItem = {
  row: string;
  images?: string[];
};

const pendingTimeIns: QueueItem[] = [];

/**
 * Add time-in entry
 */
export function addTimeInToQueue(row: string, images: string[] = []) {
  pendingTimeIns.push({ row, images });

  console.log(`📥 Queued (${pendingTimeIns.length}/${MAX_BATCH_SIZE})`);

  // 🚀 Send immediately if batch is full
  if (pendingTimeIns.length >= MAX_BATCH_SIZE) {
    flushQueue();
    return;
  }

  // ⏱️ Start delay timer only once
  if (!timeout) {
    timeout = setTimeout(flushQueue, BATCH_DELAY);
  }
}

/**
 * Send CSV + images and cleanup
 */
async function flushQueue() {
  if (pendingTimeIns.length === 0) return;

  // Stop timer to avoid double send
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }

  const dataDir = path.join(process.cwd(), "data");
  const uploadsDir = path.join(process.cwd(), "uploads");
  const batchFile = path.join(dataDir, "batch-time-in.csv");
  const mainCSV = path.join(dataDir, "time-in.csv");

  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    // Write CSV header
    fs.writeFileSync(batchFile, "Name,Email,Date,Time In,Status\n");

    // Write rows
    const rows = pendingTimeIns.map(i => i.row).join("");
    fs.appendFileSync(batchFile, rows);

    // Collect images
    const images = pendingTimeIns.flatMap(i => i.images || []);

    // Send email
    await sendCSVEmail(batchFile, images);

    // 🧹 Cleanup files
    if (fs.existsSync(batchFile)) fs.unlinkSync(batchFile);
    if (fs.existsSync(mainCSV)) fs.unlinkSync(mainCSV);

    images.forEach(img => {
      if (fs.existsSync(img)) fs.unlinkSync(img);
    });

    console.log(`✅ Sent ${pendingTimeIns.length} time-ins`);

    pendingTimeIns.length = 0;
  } catch (err) {
    console.error("❌ Batch send failed:", err);
    // Queue + files stay for retry
  }
}
