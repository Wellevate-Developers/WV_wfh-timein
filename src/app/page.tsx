"use client";
import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Pointer } from "lucide-react";
// If using shadcn later:
// import { Button } from "@/components/ui/button";

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
    year: "numeric",
    month: "short",
    day: "numeric"
  });

 const timeIn = async () => {
  if (!name || !email) {
    alert("Please enter your name and email");
    return;
  }

  setLoading(true);

  try {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);

    if (attachment) {
      formData.append("attachment", attachment);
    }

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
        backgroundColor: "#e0e0e0"
      }}
    >
      <div
        style={{
          width: 400,
          padding: 30,
          backgroundColor: "#ffffff",
          borderRadius: 8,
          boxShadow: "0 8px 20px rgba(0,0,0,0.1)"
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20
          }}
        >
          <img src="/logo.png" alt="Company Logo" style={{ height: 40 }} />
          <span style={{ fontWeight: "bold", fontSize: 18 }}>
            WFH Time In
          </span>
        </div>

        {/* Clock */}
        <h1
          style={{
            fontSize: 55,
            fontWeight: "bold",
            margin: "10px 0",
            textAlign: "center"
          }}
        >
          {formattedTime}
        </h1>

        {/* Date */}
        <p style={{ textAlign: "center", color: "#555", marginBottom: 30 }}>
          {formattedDate}
        </p>

        {/* Inputs */}
        <input
          type="text"
          placeholder="Name"
          value={name}
          disabled={!!result}
          onChange={e => setName(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 15,
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 16
          }}
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          disabled={!!result}
          onChange={e => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 25,
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 16
          }}
        />

         <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={!!result}
          onChange={(e) => setAttachment(e.target.files?.[0] || null)}
          style={{ width: "100%", marginBottom: 5 }}
        />

        <p style={{ fontSize: 12, color: "#666", marginBottom: 15 }}>
          Image only (JPG, PNG, WEBP) – max 5MB
        </p>

        {/* Button */}
        <Button
          onClick={timeIn}
          disabled={loading || !!result}
          style={{
            width: "100%",
            padding: 14,
            backgroundColor: loading || result ? "#9ca3af" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 18,
            cursor: loading || result ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Recording..." : result ? "Time In Recorded" : "Time In"}
        </Button>

        {/* Result */}
        {result && (
          <div
            style={{
              marginTop: 20,
              padding: 15,
              borderRadius: 6,
              backgroundColor:
                result.status === "On Time" ? "#dcfce7" : "#fee2e2",
              color: result.status === "On Time" ? "#166534" : "#991b1b",
              textAlign: "center"
            }}
          >
            <strong>{result.status}</strong>
            <br />
            {result.timeIn} • {result.date}
          </div>
        )}
      </div>
    </main>
  );
}
