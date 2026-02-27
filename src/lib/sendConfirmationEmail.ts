import { getGraphClient } from "@/lib/graphClient";

export async function sendConfirmationEmail({
  name,
  email,
  timeIn,
  date,
  status,
}: {
  name: string;
  email: string;
  timeIn: string;
  date: string;
  status: string;
}) {
  const client = getGraphClient();

  const statusColor = status === "On Time" ? "#166534" : "#991b1b";
  const statusBg = status === "On Time" ? "#dcfce7" : "#fee2e2";
  const statusBorder = status === "On Time" ? "#86efac" : "#fca5a5";

  const message = {
    subject: `✅ Time In Recorded – ${date}`,
    body: {
      contentType: "HTML",
      content: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5e5;">
          
          <h1 style="font-size: 28px; font-weight: bold; margin: 0 0 4px; color: #000;">Wellevate</h1>
          <p style="color: #666; font-size: 14px; margin: 0 0 28px;">WFH Time In Confirmation</p>

          <p style="font-size: 15px; color: #000; margin: 0 0 8px;">Hi <strong>${name}</strong>,</p>
          <p style="font-size: 15px; color: #333; margin: 0 0 24px;">Your time in has been successfully recorded for today.</p>

          <div style="padding: 20px; border-radius: 8px; background: ${statusBg}; border: 1px solid ${statusBorder}; text-align: center; margin-bottom: 28px;">
            <p style="margin: 0; font-size: 18px; font-weight: 700; color: ${statusColor};">${status}</p>
            <p style="margin: 6px 0 0; font-size: 14px; color: ${statusColor}; opacity: 0.85;">${timeIn} &bull; ${date}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 28px;">
            <tr>
              <td style="padding: 10px 12px; background: #f9f9f9; border: 1px solid #e5e5e5; font-weight: 600; color: #555; width: 40%;">Name</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e5e5; color: #000;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; background: #f9f9f9; border: 1px solid #e5e5e5; font-weight: 600; color: #555;">Email</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e5e5; color: #000;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; background: #f9f9f9; border: 1px solid #e5e5e5; font-weight: 600; color: #555;">Date</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e5e5; color: #000;">${date}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; background: #f9f9f9; border: 1px solid #e5e5e5; font-weight: 600; color: #555;">Time In</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e5e5; color: #000;">${timeIn}</td>
            </tr>
          </table>

          <hr style="border: none; border-top: 1px solid #e5e5e5; margin-bottom: 20px;" />
          <p style="font-size: 12px; color: #aaa; margin: 0;">This is an automated message from Wellevate WFH System. Please do not reply.</p>
        </div>
      `,
    },
    toRecipients: [
      { emailAddress: { address: email } },
    ],
  };

  await client.api(`/users/${process.env.SENDER_EMAIL}/sendMail`).post({
    message,
    saveToSentItems: false,
  });
}