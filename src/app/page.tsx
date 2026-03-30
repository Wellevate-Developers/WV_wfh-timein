"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import * as htmlToImage from "html-to-image";
import { toast } from "sonner";

const SHIFTS = [
  { label: "Regular", value: "Regular Shift" },
  { label: "Mid Shift", value: "Mid Shift" },
  { label: "Half Day", value: "Half Day" },
];

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [shift, setShift] = useState("Regular Shift");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | { status: string; timeIn: string; date: string }>(null);
  const [isBlockedDevice, setIsBlockedDevice] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  // disable right click
  useEffect(() => {
    const handleRightClick = (e: MouseEvent) => {
      e.preventDefault();
      toast("Right-click is disabled on this page.");
    };
    document.addEventListener("contextmenu", handleRightClick);
    return () => document.removeEventListener("contextmenu", handleRightClick);
  }, []);

  // Clock (Manila Time)
  useEffect(() => {
    const tick = () => {
      const manilaNow = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
      );
      setCurrentTime(manilaNow);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Detect blocked devices
  useEffect(() => {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    const mobileKeywords = ["Android", "iPhone", "iPod", "Opera Mini", "IEMobile", "Mobile"];
    const isPhone = mobileKeywords.some(k => ua.includes(k));
    const isiPad = ua.includes("iPad") || (navigator.maxTouchPoints > 1 && window.innerWidth <= 1024);
    const isiPadProA16 =
      navigator.maxTouchPoints > 1 &&
      ((screen.width === 2388 && screen.height === 1668) ||
        (screen.width === 2732 && screen.height === 2048));
    const appleKeywords = ["iPhone", "iPad", "iPod", "Macintosh", "MacIntel", "MacPPC", "Mac68K"];
    const isAppleDevice = appleKeywords.some(k => ua.includes(k) || platform.includes(k));
    if (isPhone || isiPad || isiPadProA16 || isAppleDevice) setIsBlockedDevice(true);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const formattedDate = currentTime.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });

  const getBrowserName = (): string => {
    const ua = navigator.userAgent;
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Edg")) return "Edge";
    if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
    return "UnknownBrowser";
  };

  const captureFormAsImage = async (): Promise<File> => {
    if (!formRef.current) throw new Error("Form not found");
    const blob = await htmlToImage.toBlob(formRef.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
    if (!blob) throw new Error("Failed to capture form");
    const browserName = getBrowserName();
    return new File([blob], `timein-${browserName}-${Date.now()}.png`, { type: "image/png" });
  };

  const timeIn = async () => {
    if (isBlockedDevice) {
      toast("Time In is not allowed on Apple devices or mobile phones.");
      return;
    }
    if (!name || !email) {
      toast("Please enter your name and email");
      return;
    }
    setLoading(true);
    try {
      const screenshot = await captureFormAsImage();
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("shift", shift); // ← new field sent to API
      formData.append("attachment", screenshot);

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const res = await fetch(`${basePath}/api/time-in`, { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast(data.message);
        return;
      }
      setResult({ status: data.status, timeIn: data.timeIn, date: data.date });
    } catch (err) {
      console.error(err);
      toast("Failed to capture form.");
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = !!result || isBlockedDevice;

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#1a1a1a", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div ref={formRef} style={{ width: 420, padding: 40, backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <h1 style={{ fontSize: 32, fontWeight: "bold", margin: 0, marginBottom: 8, color: "#000" }}>Wellevate</h1>
          <h2 style={{ fontSize: 18, fontWeight: "600", margin: 0, marginBottom: 4, color: "#000" }}>WFH Time In</h2>
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Enter your details below to clock in for the day</p>
        </div>

        {/* Clock */}
        <div style={{ textAlign: "center", marginBottom: 30, paddingBottom: 30, borderBottom: "1px solid #e5e5e5" }}>
          <h1 style={{ fontSize: 48, fontWeight: "bold", margin: 0, marginBottom: 4, color: "#000", letterSpacing: "-0.02em" }}>{formattedTime}</h1>
          <p style={{ fontSize: 14, color: "#666", margin: 0 }}>{formattedDate}</p>
        </div>

        {/* Shift Selector */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: 10, fontSize: 14, color: "#000" }}>Shift</label>
          <div style={{
            display: "flex",
            backgroundColor: "#f5f5f5",
            borderRadius: 10,
            padding: 4,
            gap: 4,
          }}>
            {SHIFTS.map(s => {
              const isActive = shift === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => !isDisabled && setShift(s.value)}
                  disabled={isDisabled}
                  style={{
                    flex: 1,
                    padding: "9px 0",
                    borderRadius: 7,
                    border: "none",
                    fontSize: 13,
                    fontWeight: isActive ? "700" : "500",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    backgroundColor: isActive ? "#000" : "transparent",
                    color: isActive ? "#fff" : "#555",
                    transition: "all 0.18s ease",
                    boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.18)" : "none",
                    letterSpacing: isActive ? "0.01em" : "0",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Full Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: 8, fontSize: 14, color: "#000" }}>Full Name</label>
          <input
            type="text"
            placeholder="John Smith"
            value={name}
            disabled={isDisabled}
            onChange={e => setName(e.target.value)}
            style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 15, boxSizing: "border-box", backgroundColor: isDisabled ? "#f5f5f5" : "#fff", color: "#000" }}
          />
        </div>

        {/* Email */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: 8, fontSize: 14, color: "#000" }}>Email Address</label>
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            disabled={isDisabled}
            onChange={e => setEmail(e.target.value)}
            style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 15, boxSizing: "border-box", backgroundColor: isDisabled ? "#f5f5f5" : "#fff", color: "#000" }}
          />
        </div>

        {/* Time In Button */}
        <button
          onClick={timeIn}
          disabled={loading || isDisabled}
          style={{ width: "100%", padding: 16, backgroundColor: loading || isDisabled ? "#666" : "#000", color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: "600", cursor: loading || isDisabled ? "not-allowed" : "pointer", transition: "all 0.2s", opacity: loading || isDisabled ? 0.6 : 1, marginBottom: 12 }}
        >
          {isBlockedDevice ? "Time In unavailable on Mobile/Tablet" : loading ? "Capturing..." : result ? "Time In Recorded" : "Time In"}
        </button>

        {/* Result */}
        {result && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 8, backgroundColor: result.status === "On Time" ? "#dcfce7" : "#fee2e2", border: `1px solid ${result.status === "On Time" ? "#86efac" : "#fca5a5"}`, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: "600", color: result.status === "On Time" ? "#166534" : "#991b1b" }}>{result.status}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: result.status === "On Time" ? "#166534" : "#991b1b", opacity: 0.8 }}>{result.timeIn} • {result.date} • {shift}</p>
          </div>
        )}

      </div>
    </main>
  );
}