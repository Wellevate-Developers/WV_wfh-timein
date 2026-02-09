"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

type AttendanceRecord = {
  employeeName: string;
  email: string;
  present: boolean;
  late: boolean;
  leave: boolean;
  remarks: string;
  lateMinutes: number; // Minutes employee needs to render
};

export default function OnsiteTimeIn() {
  const router = useRouter();
  
  // Step management: 'login' | 'otp' | 'attendance'
  const [step, setStep] = useState<'login' | 'otp' | 'attendance'>('login');
  
  // Login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // OTP form
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Attendance tracking
  const [employees, setEmployees] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Load employees from CSV when reaching attendance step
  useEffect(() => {
    if (step === 'attendance' && employees.length === 0) {
      loadEmployeesFromCSV();
    }
  }, [step, employees.length]);

  // Load employees from CSV file
  const loadEmployeesFromCSV = async () => {
    setLoadingEmployees(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const response = await fetch(`${basePath}/api/attendance-csv`);
      
      if (!response.ok) {
        throw new Error('Failed to load CSV');
      }
      
      const text = await response.text();
      
      // Parse CSV
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',');
      
      const employeeData: AttendanceRecord[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= 2) {
          employeeData.push({
            employeeName: values[0].trim(),
            email: values[1].trim(),
            present: false,
            late: false,
            leave: false,
            remarks: "",
            lateMinutes: 0
          });
        }
      }
      
      setEmployees(employeeData);
      toast.success('Employees Loaded', {
        description: `${employeeData.length} employees loaded successfully`,
      });
    } catch (error) {
      console.error('Error loading employees from CSV:', error);
      toast.error('Load Failed', {
        description: 'Failed to load employee list. Please try again.',
      });
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Handle Login
  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Error', {
        description: 'Please enter email and password',
      });
      return;
    }

    setLoading(true);
    
    try {
      // Get credentials from environment variables
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
      const userPassword = process.env.NEXT_PUBLIC_USER_PASSWORD;
      
      // Check if email is admin email
      if (adminEmail && email.toLowerCase() === adminEmail.toLowerCase()) {
        // Validate admin password
        if (password !== adminPassword) {
          toast.error('Login Failed', {
            description: 'Invalid password',
          });
          setLoading(false);
          return;
        }
        
        // Admin with correct password - bypasses OTP and goes directly to attendance
        toast.success('Login Successful', {
          description: 'Welcome back, Admin!',
        });
        setLoading(false);
        setStep('attendance');
      } else {
        // Regular users - validate user password
        if (password !== userPassword) {
          toast.error('Login Failed', {
            description: 'Invalid password',
          });
          setLoading(false);
          return;
        }
        
        // Regular user with correct password - send OTP to admin email
        if (!adminEmail) {
          toast.error('Configuration Error', {
            description: 'Admin email not configured',
          });
          setLoading(false);
          return;
        }

        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const response = await fetch(`${basePath}/api/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: adminEmail }), // Send to admin email
        });

        const data = await response.json();

        if (!response.ok) {
          toast.error('OTP Failed', {
            description: data.message || 'Failed to send OTP',
          });
          setLoading(false);
          return;
        }

        toast.success('OTP Sent', {
          description: `OTP has been sent to ${adminEmail}. Please check the admin inbox.`,
        });
        setLoading(false);
        setStep('otp');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Error', {
        description: 'Failed to process login. Please try again.',
      });
      setLoading(false);
    }
  };

  // Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only single digit
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  // Handle OTP backspace
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    const otpValue = otp.join("");
    
    if (otpValue.length !== 6) {
      toast.error('Incomplete OTP', {
        description: 'Please enter complete 6-digit OTP',
      });
      return;
    }

    setLoading(true);
    
    try {
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      
      if (!adminEmail) {
        toast.error('Configuration Error', {
          description: 'Admin email not configured',
        });
        setLoading(false);
        return;
      }

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const response = await fetch(`${basePath}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, otp: otpValue }), // Verify against admin email
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error('Verification Failed', {
          description: data.message || 'Invalid OTP',
        });
        setLoading(false);
        return;
      }

      // OTP verified successfully
      toast.success('Verification Successful', {
        description: 'OTP verified! Redirecting to attendance...',
      });
      setLoading(false);
      setStep('attendance');
    } catch (error) {
      console.error('OTP verification error:', error);
      toast.error('Error', {
        description: 'Failed to verify OTP. Please try again.',
      });
      setLoading(false);
    }
  };

  // Handle checkbox changes
  const handleCheckboxChange = (index: number, field: 'present' | 'late' | 'leave') => {
    const newEmployees = [...employees];
    
    // Reset all checkboxes for this employee
    if (field === 'present') {
      newEmployees[index].present = !newEmployees[index].present;
      newEmployees[index].late = false;
      newEmployees[index].leave = false;
    } else if (field === 'late') {
      newEmployees[index].late = !newEmployees[index].late;
      newEmployees[index].present = false;
      newEmployees[index].leave = false;
    } else if (field === 'leave') {
      newEmployees[index].leave = !newEmployees[index].leave;
      newEmployees[index].present = false;
      newEmployees[index].late = false;
    }
    
    setEmployees(newEmployees);
  };

  // Handle remarks change
  const handleRemarksChange = (index: number, value: string) => {
    const newEmployees = [...employees];
    newEmployees[index].remarks = value;
    setEmployees(newEmployees);
  };

  // Handle late minutes change
  const handleLateMinutesChange = (index: number, value: string) => {
    const newEmployees = [...employees];
    const minutes = parseInt(value) || 0;
    newEmployees[index].lateMinutes = Math.max(0, minutes); // Ensure non-negative
    setEmployees(newEmployees);
  };

  // Submit attendance
  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const res = await fetch(`${basePath}/api/onsite-attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees, submittedBy: email }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error('Submission Failed', {
          description: data.message || 'Failed to submit attendance',
        });
        setLoading(false);
        return;
      }

      toast.success('Attendance Submitted', {
        description: `Successfully submitted attendance for ${data.recordsProcessed} employees${data.lateNotificationsSent > 0 ? `. ${data.lateNotificationsSent} late notification(s) sent.` : '.'}`,
      });
      
      // Wait a bit for user to see the toast before redirecting
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      console.error(err);
      toast.error('Error', {
        description: 'Failed to submit attendance. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster />
      <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#1a1a1a", fontFamily: "system-ui, -apple-system, sans-serif", padding: "20px" }}>
      
      {/* LOGIN STEP */}
      {step === 'login' && (
        <div style={{ width: 420, padding: 40, backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h1 style={{ fontSize: 32, fontWeight: "bold", margin: 0, marginBottom: 8, color: "#000" }}>Wellevate</h1>
            <h2 style={{ fontSize: 18, fontWeight: "600", margin: 0, color: "#000" }}>Onsite Time in</h2>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontWeight: "600", marginBottom: 8, fontSize: 14, color: "#000" }}>Email</label>
            <input 
              type="email" 
              placeholder="Noah" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 15, boxSizing: "border-box", backgroundColor: "#f5f5f5", color: "#000" }} 
            />
          </div>

          <div style={{ marginBottom: 30 }}>
            <label style={{ display: "block", fontWeight: "600", marginBottom: 8, fontSize: 14, color: "#000" }}>Password</label>
            <input 
              type="password" 
              placeholder="Noah" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 15, boxSizing: "border-box", backgroundColor: "#f5f5f5", color: "#000" }} 
            />
          </div>

          <button 
            onClick={handleLogin}
            disabled={loading}
            style={{ width: "100%", padding: 16, backgroundColor: loading ? "#666" : "#000", color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s" }}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </div>
      )}

      {/* OTP STEP */}
      {step === 'otp' && (
        <div style={{ width: 420, padding: 40, backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h1 style={{ fontSize: 32, fontWeight: "bold", margin: 0, marginBottom: 8, color: "#000" }}>Wellevate</h1>
            <h2 style={{ fontSize: 18, fontWeight: "600", margin: 0, color: "#000" }}>Onsite Time in</h2>
          </div>

          <div style={{ marginBottom: 30 }}>
            <label style={{ display: "block", fontWeight: "600", marginBottom: 16, fontSize: 14, color: "#000", textAlign: "center" }}>OTP</label>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => { otpInputs.current[index] = el; }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(index, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(index, e)}
                  style={{
                    width: 50,
                    height: 50,
                    textAlign: "center",
                    fontSize: 20,
                    fontWeight: "600",
                    borderRadius: 8,
                    border: "2px solid #e5e5e5",
                    backgroundColor: "#f5f5f5",
                    color: "#000",
                  }}
                />
              ))}
            </div>
          </div>

          <button 
            onClick={handleVerifyOtp}
            disabled={loading}
            style={{ width: "100%", padding: 16, backgroundColor: loading ? "#666" : "#000", color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s" }}
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </div>
      )}

      {/* ATTENDANCE STEP */}
      {step === 'attendance' && (
        <div style={{ width: "90%", maxWidth: 900, padding: 30, backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ marginBottom: 30 }}>
            <h1 style={{ fontSize: 28, fontWeight: "bold", margin: 0, marginBottom: 4, color: "#000" }}>Wellevate</h1>
            <h2 style={{ fontSize: 16, fontWeight: "600", margin: 0, color: "#000" }}>Onsite Time in</h2>
          </div>

          {loadingEmployees ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <p style={{ fontSize: 16, color: "#666" }}>Loading employees...</p>
            </div>
          ) : employees.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <p style={{ fontSize: 16, color: "#666" }}>No employees found. Please check the CSV file.</p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1.5fr", gap: 10, padding: "12px 16px", backgroundColor: "#f5f5f5", borderRadius: 8, marginBottom: 8, fontWeight: "600", fontSize: 13, color: "#000" }}>
                <div>Employee Name</div>
                <div style={{ textAlign: "center" }}>Present</div>
                <div style={{ textAlign: "center" }}>Late (Mins)</div>
                <div style={{ textAlign: "center" }}>Leave</div>
                <div>Remarks</div>
              </div>

              {/* Employee Rows */}
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {employees.map((employee, index) => (
                  <div key={employee.email} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1.5fr", gap: 10, padding: "12px 16px", borderBottom: "1px solid #e5e5e5", alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: "#000" }}>{employee.employeeName}</div>
                    
                    {/* Present */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <input
                        type="checkbox"
                        checked={employee.present}
                        onChange={() => handleCheckboxChange(index, 'present')}
                        style={{ width: 18, height: 18, cursor: "pointer" }}
                      />
                    </div>
                    
                    {/* Late (checkbox + minutes input combined) */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                      <input
                        type="checkbox"
                        checked={employee.late}
                        onChange={() => handleCheckboxChange(index, 'late')}
                        style={{ width: 18, height: 18, cursor: "pointer", flexShrink: 0 }}
                      />
                      <input
                        type="number"
                        value={employee.lateMinutes || ''}
                        onChange={e => handleLateMinutesChange(index, e.target.value)}
                        placeholder="0"
                        disabled={!employee.late}
                        min="0"
                        style={{ 
                          width: "80px", 
                          padding: "6px 10px", 
                          borderRadius: 4, 
                          border: "1px solid #e5e5e5", 
                          fontSize: 13, 
                          color: "#000",
                          backgroundColor: employee.late ? "#fff" : "#f5f5f5",
                          cursor: employee.late ? "text" : "not-allowed"
                        }}
                      />
                    </div>
                    
                    {/* Leave */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <input
                        type="checkbox"
                        checked={employee.leave}
                        onChange={() => handleCheckboxChange(index, 'leave')}
                        style={{ width: 18, height: 18, cursor: "pointer" }}
                      />
                    </div>
                    
                    {/* Remarks */}
                    <div>
                      <input
                        type="text"
                        value={employee.remarks}
                        onChange={e => handleRemarksChange(index, e.target.value)}
                        placeholder=""
                        style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid #e5e5e5", fontSize: 13, color: "#000", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit Button */}
              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <button 
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{ padding: "12px 32px", backgroundColor: loading ? "#666" : "#000", color: "white", border: "none", borderRadius: 8, fontSize: 15, fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s" }}
                >
                  {loading ? "Submitting..." : "Submit"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </main>
    </>
  );
}