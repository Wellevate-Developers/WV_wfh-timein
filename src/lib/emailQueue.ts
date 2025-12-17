import fs from "fs";
import path from "path";
import { sendCSVEmail } from "./sendCSVEmail";

const BATCH_DELAY = 5 * 60 * 1000; // 5 minutes
let timeout: NodeJS.Timeout | null = null;
const pendingTimeIns: string[] = [];

export function addTimeInToQueue(row: string) {
  pendingTimeIns.push(row);

  if (!timeout) {
    timeout = setTimeout(async () => {
      try {
        const dataDir = path.join(process.cwd(), "data");
        const batchFile = path.join(dataDir, "batch-time-in.csv");

        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        // Write header if missing
        if (!fs.existsSync(batchFile)) {
          fs.writeFileSync(batchFile, "Name,Email,Date,Time In,Status,IP\n");
        }

        // Append all pending rows
        fs.appendFileSync(batchFile, pendingTimeIns.join(""));

        // Send batch CSV to admin
        await sendCSVEmail(batchFile);

        // Clear queue
        pendingTimeIns.length = 0;
      } catch (err) {
        console.error("Failed to send batched CSV:", err);
      } finally {
        timeout = null; // reset timer
      }
    }, BATCH_DELAY);
  }
}
