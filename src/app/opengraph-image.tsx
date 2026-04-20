import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "Flowvault — zero-knowledge encrypted notepad with plausible deniability";

/**
 * Social-share (Open Graph / Twitter) image. Dynamically generated so we
 * don't ship a large PNG and so the wordmark stays in sync with code.
 */
export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          background:
            "linear-gradient(135deg, #0b0b0f 0%, #13131a 55%, #1b1b25 100%)",
          color: "#ededf0",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "#8b5cf6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="12" cy="12" r="3" />
              <circle cx="7.5" cy="7.5" r="0.7" fill="#ffffff" stroke="none" />
              <path d="m7.9 7.9 2.7 2.7" />
              <circle cx="16.5" cy="7.5" r="0.7" fill="#ffffff" stroke="none" />
              <path d="m13.4 10.6 2.7-2.7" />
              <circle cx="7.5" cy="16.5" r="0.7" fill="#ffffff" stroke="none" />
              <path d="m7.9 16.1 2.7-2.7" />
              <circle cx="16.5" cy="16.5" r="0.7" fill="#ffffff" stroke="none" />
              <path d="m13.4 13.4 2.7 2.7" />
            </svg>
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: -1.5,
            }}
          >
            Flowvault
          </div>
        </div>

        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: -1.5,
            maxWidth: 1000,
          }}
        >
          Notes you can deny you have.
        </div>

        <div
          style={{
            marginTop: 32,
            fontSize: 28,
            color: "#8a8a94",
            lineHeight: 1.4,
            maxWidth: 1000,
          }}
        >
          Zero-knowledge encrypted notepad with plausible deniability, a
          dead-man&apos;s switch, and drand time-locked notes. Fully
          open-source.
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            color: "#8a8a94",
          }}
        >
          <span style={{ color: "#8b5cf6" }}>●</span>
          <span>flowvault.flowdesk.tech</span>
        </div>
      </div>
    ),
    size,
  );
}
