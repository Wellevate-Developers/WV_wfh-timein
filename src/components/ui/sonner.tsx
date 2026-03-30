"use client"

import { Loader2Icon } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <span className="size-4 rounded-full border-2 border-black inline-block" />,
        info: <span className="size-4 rounded-full border-2 border-black inline-block" />,
        warning: <span className="size-4 rounded-full border-2 border-black inline-block" />,
        error: <span className="size-4 rounded-full border-2 border-black inline-block" />,
        loading: <Loader2Icon className="size-4 animate-spin text-black" />,
      }}
      toastOptions={{
        style: {
          background: "#ffffff",
          color: "#000000",
          border: "1px solid #e0e0e0",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: "500",
          padding: "12px 20px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }