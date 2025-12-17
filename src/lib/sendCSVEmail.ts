import fs from "fs";
import { getGraphClient } from "@/lib/graphClient";

export async function sendCSVEmail(csvPath: string) {
  const client = await getGraphClient();

  const fileContent = fs.readFileSync(csvPath, "utf-8");
  const attachment = Buffer.from(fileContent).toString("base64");

  const message = {
    subject: "WFH Time-In Report",
    body: {
      contentType: "HTML",
      content: "Please find attached today's time-in CSV.",
    },
    toRecipients: [
      {
        emailAddress: { address: process.env.ADMIN_EMAIL }, // admin from .env
      },
    ],
    attachments: [
      {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: "time-in.csv",
        contentBytes: attachment,
      },
    ],
  };

  await client.api(`/users/${process.env.SENDER_EMAIL}/sendMail`).post({
    message,
    saveToSentItems: true,
  });
}
