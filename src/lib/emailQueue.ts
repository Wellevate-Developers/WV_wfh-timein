import fs from "fs";
import path from "path";
import { sendCSVEmail } from "./sendCSVEmail";

const BATCH_DELAY = 5 * 60 * 1000; // 5 minutes
let timeout: NodeJS.Timeout | null = null;

// Each queue item has the CSV row + optional images
type QueueItem = {
  row: string;
  images?: string[];
};

const pendingTimeIns: QueueItem[] = [];

export function addTimeInToQueue(row: string, images: string[] = []) {
  pendingTimeIns.push({ row, images });

  if (!timeout) {
    timeout = setTimeout(async () => {
      try {
        const dataDir = path.join(process.cwd(), "data");
        const uploadsDir = path.join(process.cwd(), "uploads");
        const batchFile = path.join(dataDir, "batch-time-in.csv");

        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        // Write header if missing
        if (!fs.existsSync(batchFile)) {
          fs.writeFileSync(batchFile, "Name,Email,Date,Time In,Status,IP\n");
        }

        // Collect all rows
        const allRows = pendingTimeIns.map(item => item.row).join("");
        fs.appendFileSync(batchFile, allRows);

        // Collect all image paths
        const allImages: string[] = [];
        pendingTimeIns.forEach(item => {
          if (item.images) allImages.push(...item.images);
        });

        // Send CSV + images
        await sendCSVEmail(batchFile, allImages);

        // Clear queue
        pendingTimeIns.length = 0;
      } catch (err) {
        console.error("Failed to send batched CSV/email:", err);
      } finally {
        timeout = null; // reset timer
      }
    }, BATCH_DELAY);
  }
}
