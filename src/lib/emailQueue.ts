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
      const dataDir = path.join(process.cwd(), "data");
      const uploadsDir = path.join(process.cwd(), "uploads");
      const batchFile = path.join(dataDir, "batch-time-in.csv");
      const mainCSV = path.join(dataDir, "time-in.csv");

      try {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        // ✅ Write header without IP
        if (!fs.existsSync(batchFile)) {
          fs.writeFileSync(batchFile, "Name,Email,Date,Time In,Status\n");
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

        // ✅ DELETE FILES AFTER SUCCESSFUL EMAIL SEND
        
        // Delete the batch CSV file
        if (fs.existsSync(batchFile)) {
          fs.unlinkSync(batchFile);
          console.log(`✅ Deleted batch CSV: ${batchFile}`);
        }

        // Delete the main time-in.csv file
        if (fs.existsSync(mainCSV)) {
          fs.unlinkSync(mainCSV);
          console.log(`✅ Deleted main CSV: ${mainCSV}`);
        }

        // Delete all uploaded images
        allImages.forEach(imagePath => {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`✅ Deleted image: ${imagePath}`);
          }
        });

        // Clear queue
        pendingTimeIns.length = 0;
        
        console.log("✅ Email sent and all files cleaned up successfully");
      } catch (err) {
        console.error("❌ Failed to send batched CSV/email:", err);
        // Don't delete files if email failed - keep them for retry/debugging
      } finally {
        timeout = null; // reset timer
      }
    }, BATCH_DELAY);
  }
}

// Optional: cleanup function
export function cleanupOldFiles() {
  const dataDir = path.join(process.cwd(), "data");
  const uploadsDir = path.join(process.cwd(), "uploads");
  const batchFile = path.join(dataDir, "batch-time-in.csv");
  const mainCSV = path.join(dataDir, "time-in.csv");

  let cleanedCount = 0;

  // Delete old batch CSV
  if (fs.existsSync(batchFile)) {
    fs.unlinkSync(batchFile);
    cleanedCount++;
    console.log("🧹 Cleaned up old batch CSV on startup");
  }

  // Delete old main CSV
  if (fs.existsSync(mainCSV)) {
    fs.unlinkSync(mainCSV);
    cleanedCount++;
    console.log("🧹 Cleaned up old main CSV on startup");
  }

  // Delete all old images in uploads directory
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      fs.unlinkSync(filePath);
      cleanedCount++;
    });
    console.log(`🧹 Cleaned up ${files.length} old image(s) on startup`);
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Total cleanup: ${cleanedCount} file(s) removed`);
  }
}