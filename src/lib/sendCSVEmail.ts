import fs from "fs";
import path from "path";
import { getGraphClient } from "@/lib/graphClient";

export async function sendCSVEmail(csvPath: string, imagePaths: string[] = []) {
  const client = await getGraphClient();

  const attachments = [];

  // Attach CSV
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  attachments.push({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: path.basename(csvPath),
    contentBytes: Buffer.from(csvContent).toString("base64"),
  });

  // Attach images
  for (const imgPath of imagePaths) {
    const imgBuffer = fs.readFileSync(imgPath);
    attachments.push({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: path.basename(imgPath),
      contentBytes: imgBuffer.toString("base64"),
    });
  }

  const message = {
    subject: "WFH Time-In Report",
    body: {
      contentType: "HTML",
      content: "Please find attached today's time-in CSV and uploaded images.",
    },
    toRecipients: [
      { emailAddress: { address: process.env.ADMIN_EMAIL } },
    ],
    ccRecipients: [
      { emailAddress: { address: process.env.CC_EMAIL } },
    ],
    attachments,
  };


  await client.api(`/users/${process.env.SENDER_EMAIL}/sendMail`).post({
    message,
    saveToSentItems: true,
  });
}
