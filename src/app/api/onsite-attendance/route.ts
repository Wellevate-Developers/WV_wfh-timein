import { NextRequest, NextResponse } from "next/server";
import { getGraphClient } from '@/lib/graphClient';

/**
 * Send late notification email to an employee
 */
async function sendLateNotificationEmail(
  employeeEmail: string,
  employeeName: string,
  lateMinutes: number
): Promise<boolean> {
  try {
    const graphClient = getGraphClient();
    const senderEmail = process.env.AZURE_SENDER_EMAIL || process.env.AZURE_USER_EMAIL;

    if (!senderEmail) {
      throw new Error('Sender email not configured');
    }

    // Format late duration
    const hours = Math.floor(lateMinutes / 60);
    const minutes = lateMinutes % 60;
    let lateDuration = '';

    if (hours > 0 && minutes > 0) {
      lateDuration = `${hours} ${hours > 1 ? '' : ''} and ${minutes} ${minutes > 1 ? '' : ''}`;
    } else if (hours > 0) {
      lateDuration = `${hours} ${hours > 1 ? '' : ''}`;
    } else {
      lateDuration = `${minutes} ${minutes > 1 ? '' : ''}`;
    }

    const message = {
      message: {
        subject: 'Attendance Notification Late Arrival',
        body: {
          contentType: 'HTML',
          content: `
            <!DOCTYPE html>
            <html>
            <body>
              <div class="container">
                
                <div class="content">
                  <p><strong>Hi ${employeeName},</strong></p>
                  
                  <div class="alert-box">
                    <p>This is a formal note regarding your late arrival today. You arrived at 9:${lateDuration} AM, 
                    which is ${lateDuration} minutes past our scheduled start time of 9:00 AM.<br>As per company policy, 
                    please extend your shift today.</p>
                  </div>

                  <p><strong>Revised Schedule</strong></p>
                  <ul>
                    <li><stong>Required Extension:</strong> ${lateDuration} minutes</li>
                    <li><stong>New Log-Off Time: 6:${lateDuration} pm</strong></li>
                  </ul>

                  <p>Please acknowledge receipt of this notice and confirm that you are able to stay until the revised end time. 
                      If there were extenuating circumstances regarding your arrival, feel free to discuss them with me directly.</p>

                  <p>
                    <br>Regards</br>
                    <strong>Maria Rebecca (Tobit) Flancia-Galido</strong>
                    <br>Office & Operations Manager</br>
                  </p>

                </div>

              </div>
            </body>
            </html>
          `,
        },
        toRecipients: [
          {
            emailAddress: {
              address: employeeEmail,
            },
          },
        ],
      },
      saveToSentItems: true,
    };

    await graphClient
      .api(`/users/${senderEmail}/sendMail`)
      .post(message);

    console.log(`Late notification sent to ${employeeName} (${employeeEmail}) - ${lateDuration} extension`);
    return true;
  } catch (error) {
    console.error(`Error sending late notification to ${employeeEmail}:`, error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employees, submittedBy } = body;

    if (!employees || !Array.isArray(employees)) {
      return NextResponse.json({ message: "Invalid employee data" }, { status: 400 });
    }

    // Get current Manila time
    const manilaTime = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
    );

    const timestamp = manilaTime.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });

    const dateForFilename = manilaTime.toISOString().split('T')[0]; // YYYY-MM-DD

    // Process attendance data
    const attendanceRecords = employees.map((emp: any) => ({
      employeeName: emp.employeeName,
      email: emp.email,
      status: emp.present ? "Present" : emp.late ? "Late" : emp.leave ? "Leave" : "Absent",
      remarks: emp.remarks || "",
      lateMinutes: emp.late ? (emp.lateMinutes || 0) : 0,
    }));

    // Send emails to late employees
    const lateEmployees = attendanceRecords.filter((emp: any) => emp.status === 'Late');
    const emailPromises = lateEmployees.map((emp: any) =>
      sendLateNotificationEmail(emp.email, emp.employeeName, emp.lateMinutes)
    );

    // Send all late notifications in parallel
    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter(result => result).length;

    console.log(`Late notifications: ${successfulEmails}/${lateEmployees.length} sent successfully`);

    // Generate CSV content
    const csvHeaders = ['Employee Name', 'Email', 'Status', 'Late Minutes', 'Remarks'];
    const csvRows = attendanceRecords.map((record: any) => [
      record.employeeName,
      record.email,
      record.status,
      record.lateMinutes || 0,
      record.remarks
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row =>
        row.map(cell => {
          // Escape cells that contain commas or quotes
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      )
    ].join('\n');

    // Convert CSV to base64 for email attachment
    const csvBase64 = Buffer.from(csvContent).toString('base64');

    // Send email to admin with CSV attachment
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

    if (!adminEmail) {
      console.error('Admin email not configured');
      return NextResponse.json(
        { message: "Admin email not configured" },
        { status: 500 }
      );
    }

    const senderEmail = process.env.AZURE_SENDER_EMAIL || process.env.AZURE_USER_EMAIL;

    if (!senderEmail) {
      console.error('Sender email not configured');
      return NextResponse.json(
        { message: "Sender email not configured" },
        { status: 500 }
      );
    }

    // Count attendance statistics
    const stats = {
      total: attendanceRecords.length,
      present: attendanceRecords.filter((r: any) => r.status === 'Present').length,
      late: attendanceRecords.filter((r: any) => r.status === 'Late').length,
      leave: attendanceRecords.filter((r: any) => r.status === 'Leave').length,
      absent: attendanceRecords.filter((r: any) => r.status === 'Absent').length,
    };

    // Create email with CSV attachment
    const graphClient = getGraphClient();

    const message = {
      message: {
        subject: `Onsite Attendance Report - ${dateForFilename}`,
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
                  max-width: 700px;
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
                }
                .content h2 {
                  color: #000000;
                  font-size: 20px;
                  margin-top: 0;
                  margin-bottom: 20px;
                }
                .content p {
                  color: #666666;
                  font-size: 16px;
                  line-height: 1.6;
                  margin: 10px 0;
                }
                .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 15px;
                  margin: 30px 0;
                }
                .stat-box {
                  background-color: #f5f5f5;
                  border-radius: 8px;
                  padding: 20px;
                  text-align: center;
                  border: 2px solid #e5e5e5;
                }
                .stat-number {
                  font-size: 36px;
                  font-weight: bold;
                  color: #000000;
                  margin: 0;
                }
                .stat-label {
                  font-size: 14px;
                  color: #666666;
                  margin: 5px 0 0 0;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                }
                .present { border-color: #86efac; background-color: #dcfce7; }
                .present .stat-number { color: #166534; }
                .late { border-color: #fca5a5; background-color: #fee2e2; }
                .late .stat-number { color: #991b1b; }
                .leave { border-color: #fdba74; background-color: #ffedd5; }
                .leave .stat-number { color: #9a3412; }
                .absent { border-color: #cbd5e1; background-color: #f1f5f9; }
                .absent .stat-number { color: #475569; }
                .info-box {
                  background-color: #f0f9ff;
                  border-left: 4px solid #0284c7;
                  padding: 15px 20px;
                  margin: 20px 0;
                  border-radius: 4px;
                }
                .info-box p {
                  margin: 5px 0;
                  color: #0c4a6e;
                }
                .footer {
                  background-color: #f5f5f5;
                  padding: 20px 30px;
                  text-align: center;
                  color: #999999;
                  font-size: 14px;
                }
                .attachment-notice {
                  background-color: #fffbeb;
                  border: 2px solid #fbbf24;
                  border-radius: 8px;
                  padding: 15px 20px;
                  margin: 20px 0;
                  text-align: center;
                }
                .attachment-notice p {
                  margin: 0;
                  color: #92400e;
                  font-weight: 600;
                }
                .late-notice {
                  background-color: #fee2e2;
                  border: 2px solid #dc2626;
                  border-radius: 8px;
                  padding: 15px 20px;
                  margin: 20px 0;
                }
                .late-notice p {
                  margin: 5px 0;
                  color: #991b1b;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Wellevate</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px;">Onsite Attendance Report</p>
                </div>
                
                <div class="content">
                  <h2>Attendance Summary</h2>
                  
                  <div class="info-box">
                    <p><strong>Date:</strong> ${timestamp}</p>
                    <p><strong>Submitted by:</strong> ${submittedBy || 'System'}</p>
                    <p><strong>Total Employees:</strong> ${stats.total}</p>
                  </div>

                  <div class="stats-grid">
                    <div class="stat-box present">
                      <p class="stat-number">${stats.present}</p>
                      <p class="stat-label">Present</p>
                    </div>
                    <div class="stat-box late">
                      <p class="stat-number">${stats.late}</p>
                      <p class="stat-label">Late</p>
                    </div>
                    <div class="stat-box leave">
                      <p class="stat-number">${stats.leave}</p>
                      <p class="stat-label">On Leave</p>
                    </div>
                    <div class="stat-box absent">
                      <p class="stat-number">${stats.absent}</p>
                      <p class="stat-label">Absent</p>
                    </div>
                  </div>

                  ${lateEmployees.length > 0 ? `
                  <div class="late-notice">
                    <p><strong>⚠️ Late Arrival Notifications Sent:</strong></p>
                    <p>${successfulEmails} of ${lateEmployees.length} late employees have been notified via email</p>
                    <p style="font-size: 14px; margin-top: 10px;">Employees reminded to extend their working hours today</p>
                  </div>
                  ` : ''}

                  <div class="attachment-notice">
                    <p>📎 Detailed attendance data is attached as a CSV file</p>
                  </div>

                  <p style="margin-top: 30px; color: #666;">The attached CSV file contains the complete attendance record with employee names, emails, status, and remarks.</p>
                </div>

                <div class="footer">
                  <p>This is an automated report from Wellevate Onsite Time In System.</p>
                  <p>Generated on ${timestamp}</p>
                </div>
              </div>
            </body>
            </html>
          `,
        },
        toRecipients: [
          {
            emailAddress: {
              address: adminEmail,
            },
          },
        ],
        attachments: [
          {
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: `attendance-${dateForFilename}.csv`,
            contentType: 'text/csv',
            contentBytes: csvBase64,
          },
        ],
      },
      saveToSentItems: true,
    };

    await graphClient
      .api(`/users/${senderEmail}/sendMail`)
      .post(message);

    console.log("Attendance submitted:", {
      records: attendanceRecords.length,
      submittedBy,
      timestamp,
      stats,
      lateNotificationsSent: successfulEmails,
    });

    return NextResponse.json({
      message: "Attendance submitted successfully",
      recordsProcessed: attendanceRecords.length,
      timestamp,
      stats,
      lateNotificationsSent: successfulEmails,
      lateEmployeesTotal: lateEmployees.length,
    });

  } catch (error) {
    console.error("Error processing attendance:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}