"use client";

import { APP_NAME } from "@/lib/brand";

// Replaces the root layout, so global styles are unavailable; keep styling inline.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#0b0d09", color: "#f4f6ef" }}>
        <title>{`Something went wrong · ${APP_NAME}`}</title>
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ opacity: 0.7, marginBottom: 20 }}>{APP_NAME} hit an unexpected error.</p>
          <button onClick={retry} style={{ padding: "10px 20px", borderRadius: 999, border: 0, fontWeight: 600, cursor: "pointer" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
