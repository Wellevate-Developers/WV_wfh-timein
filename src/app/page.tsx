"use client";
import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";

export default function Home() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | {
    status: string;
    timeIn: string;
    date: string;
  }>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  const formattedDate = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  const timeIn = async () => {
    // ✅ Validation: Check name, email, and image
    if (!name || !email) {
      alert("Please enter your name and email");
      return;
    }

    if (!attachment) {
      alert("Please attach an image");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("attachment", attachment);

      // ✅ Use environment variable
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const res = await fetch(`${basePath}/api/time-in`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message);
        return;
      }

      setResult({
        status: data.status,
        timeIn: data.timeIn,
        date: data.date,
      });
    } catch (err) {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#1a1a1a",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}
    >
      <div
        style={{
          width: 420,
          padding: 40,
          backgroundColor: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
        }}
      >
        {/* Header with Logo */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <h1 style={{ 
            fontSize: 32, 
            fontWeight: "bold", 
            margin: 0,
            marginBottom: 8,
            color: "#000"
          }}>
            Wellevate
          </h1>
          <h2 style={{ 
            fontSize: 18, 
            fontWeight: "600", 
            margin: 0,
            marginBottom: 4,
            color: "#000"
          }}>
            WFH Time In
          </h2>
          <p style={{ 
            fontSize: 13, 
            color: "#666",
            margin: 0
          }}>
            Enter your details below to clock in for the day
          </p>
        </div>

        {/* Clock */}
        <div style={{ 
          textAlign: "center", 
          marginBottom: 30,
          paddingBottom: 30,
          borderBottom: "1px solid #e5e5e5"
        }}>
          <h1
            style={{
              fontSize: 48,
              fontWeight: "bold",
              margin: 0,
              marginBottom: 4,
              color: "#000",
              letterSpacing: "-0.02em"
            }}
          >
            {formattedTime}
          </h1>
          <p style={{ 
            fontSize: 14, 
            color: "#666", 
            margin: 0 
          }}>
            {formattedDate}
          </p>
        </div>

        {/* Full Name Input */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: "block", 
            fontWeight: "600", 
            marginBottom: 8,
            fontSize: 14,
            color: "#000"
          }}>
            Full Name
          </label>
          <input
            type="text"
            placeholder="John Smith"
            value={name}
            disabled={!!result}
            onChange={e => setName(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid #e5e5e5",
              fontSize: 15,
              boxSizing: "border-box",
              backgroundColor: result ? "#f5f5f5" : "#fff",
              color: "#000"
            }}
          />
        </div>

        {/* Email Address Input */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: "block", 
            fontWeight: "600", 
            marginBottom: 8,
            fontSize: 14,
            color: "#000"
          }}>
            Email Address
          </label>
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            disabled={!!result}
            onChange={e => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid #e5e5e5",
              fontSize: 15,
              boxSizing: "border-box",
              backgroundColor: result ? "#f5f5f5" : "#fff",
              color: "#000"
            }}
          />
        </div>

        {/* Attach Image */}
        <div style={{ marginBottom: 25 }}>
          <label style={{ 
            display: "block", 
            fontWeight: "600", 
            marginBottom: 8,
            fontSize: 14,
            color: "#000"
          }}>
            Attach Image
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={!!result}
            onChange={(e) => setAttachment(e.target.files?.[0] || null)}
            style={{ 
              width: "100%", 
              fontSize: 14,
              padding: "10px 16px",
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              boxSizing: "border-box",
              backgroundColor: result ? "#f5f5f5" : "#fff",
              cursor: result ? "not-allowed" : "pointer"
            }}
          />
          <p style={{ 
            fontSize: 12, 
            color: "#999", 
            marginTop: 6,
            marginBottom: 0 
          }}>
            JPG, PNG, or WEBP • Max 5MB
          </p>
        </div>

        {/* Time In Button */}
        <button
          onClick={timeIn}
          disabled={loading || !!result}
          style={{
            width: "100%",
            padding: 16,
            backgroundColor: loading || result ? "#666" : "#000",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            fontWeight: "600",
            cursor: loading || result ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            opacity: loading || result ? 0.6 : 1
          }}
        >
          {loading ? "Recording..." : result ? "Time In Recorded" : "Time In"}
        </button>

        {/* Result */}
        {result && (
          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 8,
              backgroundColor: result.status === "On Time" ? "#dcfce7" : "#fee2e2",
              border: `1px solid ${result.status === "On Time" ? "#86efac" : "#fca5a5"}`,
              textAlign: "center"
            }}
          >
            <p style={{
              margin: 0,
              fontSize: 15,
              fontWeight: "600",
              color: result.status === "On Time" ? "#166534" : "#991b1b"
            }}>
              {result.status}
            </p>
            <p style={{
              margin: "4px 0 0 0",
              fontSize: 13,
              color: result.status === "On Time" ? "#166534" : "#991b1b",
              opacity: 0.8
            }}>
              {result.timeIn} • {result.date}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}