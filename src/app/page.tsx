"use client";
import { useState, useEffect, useRef } from "react";
import * as htmlToImage from "html-to-image";

export default function Home() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | { status: string; timeIn: string; date: string }>(null);
  const [isBlockedDevice, setIsBlockedDevice] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Detect blocked devices (phones + iPads including iPad Pro A16)
  useEffect(() => {
    const ua = navigator.userAgent;

    const mobileKeywords = ["Android", "iPhone", "iPod", "Opera Mini", "IEMobile", "Mobile"];
    const isPhone = mobileKeywords.some(k => ua.includes(k));

    // Detect iPad (legacy and A16)
    const isiPad =
      ua.includes("iPad") || // legacy UA
      (navigator.maxTouchPoints > 1 && window.innerWidth <= 1024); // modern iPads in desktop UA

    // Optionally, block specific iPad Pro A16 screen resolutions
    const isiPadProA16 =
      navigator.maxTouchPoints > 1 &&
      ((screen.width === 2388 && screen.height === 1668) || // 11-inch iPad Pro
       (screen.width === 2732 && screen.height === 2048));   // 12.9-inch iPad Pro

    if (isPhone || isiPad || isiPadProA16) {
      setIsBlockedDevice(true);
    }
  }, []);

  const formattedTime = currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const formattedDate = currentTime.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });

  // Browser name
  const getBrowserName = (): string => {
    const ua = navigator.userAgent;
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Edg")) return "Edge";
    if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
    return "UnknownBrowser";
  };

  // Capture form as image
  const captureFormAsImage = async (): Promise<File> => {
    if (!formRef.current) throw new Error("Form not found");
    const blob = await htmlToImage.toBlob(formRef.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
    if (!blob) throw new Error("Failed to capture form");
    const browserName = getBrowserName();
    return new File([blob], `timein-${browserName}-${Date.now()}.png`, { type: "image/png" });
  };

  // Time In
  const timeIn = async () => {
    if (isBlockedDevice) {
      alert("Time In is not allowed on phones or tablets, including iPads.");
      return;
    }

    if (!name || !email) {
      alert("Please enter your name and email");
      return;
    }

    setLoading(true);

    try {
      const screenshot = await captureFormAsImage();
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("attachment", screenshot);

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const res = await fetch(`${basePath}/api/time-in`, { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        alert(data.message);
        return;
      }

      setResult({ status: data.status, timeIn: data.timeIn, date: data.date });
    } catch (err) {
      console.error(err);
      alert("Failed to capture form.");
    } finally {
      setLoading(false);
    }
  };

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

        {/* Full Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: 8, fontSize: 14, color: "#000" }}>Full Name</label>
          <input type="text" placeholder="John Smith" value={name} disabled={!!result || isBlockedDevice} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 15, boxSizing: "border-box", backgroundColor: result || isBlockedDevice ? "#f5f5f5" : "#fff", color: "#000" }} />
        </div>

        {/* Email */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: 8, fontSize: 14, color: "#000" }}>Email Address</label>
          <input type="email" placeholder="email@example.com" value={email} disabled={!!result || isBlockedDevice} onChange={e => setEmail(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 15, boxSizing: "border-box", backgroundColor: result || isBlockedDevice ? "#f5f5f5" : "#fff", color: "#000" }} />
        </div>

        {/* Time In Button */}
        <button onClick={timeIn} disabled={loading || !!result || isBlockedDevice} style={{ width: "100%", padding: 16, backgroundColor: loading || result || isBlockedDevice ? "#666" : "#000", color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: "600", cursor: loading || result || isBlockedDevice ? "not-allowed" : "pointer", transition: "all 0.2s", opacity: loading || result || isBlockedDevice ? 0.6 : 1 }}>
          {isBlockedDevice ? "Time In unavailable on phones/iPads" : loading ? "Capturing..." : result ? "Time In Recorded" : "Capture & Time In"}
        </button>

        {/* Result */}
        {result && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 8, backgroundColor: result.status === "On Time" ? "#dcfce7" : "#fee2e2", border: `1px solid ${result.status === "On Time" ? "#86efac" : "#fca5a5"}`, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: "600", color: result.status === "On Time" ? "#166534" : "#991b1b" }}>{result.status}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: result.status === "On Time" ? "#166534" : "#991b1b", opacity: 0.8 }}>{result.timeIn} • {result.date}</p>
          </div>
        )}
      </div>
    </main>
  );
}
