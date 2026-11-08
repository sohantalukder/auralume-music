import { ImageResponse } from "next/og";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/brand";

export const alt = `${APP_NAME} audio-first music player`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#0b0a10", color: "#f4f6ef", display: "flex", height: "100%", justifyContent: "center", padding: "72px", width: "100%" }}>
      <div style={{ alignItems: "center", display: "flex", flexDirection: "column", maxWidth: "900px", textAlign: "center" }}>
        <div style={{ alignItems: "center", background: "#ff7ab6", borderRadius: "28px", display: "flex", gap: "10px", height: "112px", justifyContent: "center", marginBottom: "42px", width: "112px" }}>
          {[46, 72, 54].map((height, index) => <span key={index} style={{ background: "#172300", borderRadius: "999px", display: "flex", height, width: "12px" }} />)}
        </div>
        <div style={{ color: "#ff7ab6", display: "flex", fontSize: "30px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>{APP_NAME}</div>
        <div style={{ display: "flex", fontSize: "76px", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1.05, marginTop: "18px" }}>Music, without the noise.</div>
        <div style={{ color: "#b8bea9", display: "flex", fontSize: "26px", lineHeight: 1.4, marginTop: "28px" }}>{APP_DESCRIPTION}</div>
      </div>
    </div>,
    size,
  );
}
