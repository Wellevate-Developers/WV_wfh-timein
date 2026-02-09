// lib/otpService.ts
import { getGraphClient } from './graphClient';

/**
 * Generate a random 6-digit OTP
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP email via Microsoft Graph
 */
export async function sendOTPEmail(recipientEmail: string, otp: string): Promise<boolean> {
  try {
    const graphClient = getGraphClient();
    const senderEmail = process.env.AZURE_SENDER_EMAIL || process.env.AZURE_USER_EMAIL;

    if (!senderEmail) {
      throw new Error('AZURE_SENDER_EMAIL or AZURE_USER_EMAIL not configured');
    }

    const message = {
      message: {
        subject: 'Your OTP for Wellevate Onsite Time In',
        body: {
          contentType: 'HTML',
          content: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  background-color: #f4f4f4;
                  margin: 0;
                  padding: 0;
                }
                .container {
                  max-width: 600px;
                  margin: 40px auto;
                  background-color: #ffffff;
                  border-radius: 8px;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  overflow: hidden;
                }
                .header {
                  background-color: #000000;
                  color: #ffffff;
                  padding: 30px;
                  text-align: center;
                }
                .header h1 {
                  margin: 0;
                  font-size: 28px;
                  font-weight: bold;
                }
                .content {
                  padding: 40px 30px;
                  text-align: center;
                }
                .content p {
                  color: #666666;
                  font-size: 16px;
                  line-height: 1.6;
                  margin: 0 0 30px 0;
                }
                .otp-box {
                  background-color: #f5f5f5;
                  border: 2px solid #e5e5e5;
                  border-radius: 8px;
                  padding: 20px;
                  margin: 30px 0;
                }
                .otp-code {
                  font-size: 36px;
                  font-weight: bold;
                  color: #000000;
                  letter-spacing: 8px;
                  margin: 10px 0;
                }
                .footer {
                  background-color: #f5f5f5;
                  padding: 20px 30px;
                  text-align: center;
                  color: #999999;
                  font-size: 14px;
                }
                .warning {
                  color: #ff6b6b;
                  font-size: 14px;
                  margin-top: 20px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Wellevate</h1>
                </div>
                <div class="content">
                  <p>Hello,</p>
                  <p>You requested access to the Onsite Time In system. Please use the following One-Time Password (OTP) to verify your identity:</p>
                  
                  <div class="otp-box">
                    <div class="otp-code">${otp}</div>
                  </div>
                  
                  <p>This code will expire in 10 minutes.</p>
                  <p class="warning">⚠️ If you did not request this code, please ignore this email.</p>
                </div>
                <div class="footer">
                  <p>This is an automated message from Wellevate Onsite Time In System.</p>
                  <p>Please do not reply to this email.</p>
                </div>
              </div>
            </body>
            </html>
          `,
        },
        toRecipients: [
          {
            emailAddress: {
              address: recipientEmail,
            },
          },
        ],
      },
      saveToSentItems: false,
    };

    await graphClient
      .api(`/users/${senderEmail}/sendMail`)
      .post(message);

    console.log(`OTP email sent successfully to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
}

/**
 * Store OTP in memory with expiration (10 minutes)
 * In production, use Redis or a database
 */
interface OTPRecord {
  otp: string;
  email: string;
  expiresAt: number;
}

const otpStore = new Map<string, OTPRecord>();

export function storeOTP(email: string, otp: string): void {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  otpStore.set(email.toLowerCase(), { otp, email, expiresAt });
}

export function verifyOTP(email: string, otp: string): boolean {
  const record = otpStore.get(email.toLowerCase());
  
  if (!record) {
    return false; // No OTP found
  }
  
  if (Date.now() > record.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return false; // OTP expired
  }
  
  if (record.otp !== otp) {
    return false; // Wrong OTP
  }
  
  // OTP is valid, delete it so it can't be reused
  otpStore.delete(email.toLowerCase());
  return true;
}

export function clearExpiredOTPs(): void {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(email);
    }
  }
}

// Clear expired OTPs every 5 minutes
setInterval(clearExpiredOTPs, 5 * 60 * 1000);