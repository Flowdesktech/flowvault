import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * High-res iOS home-screen icon. Same glyph as `icon.svg` but at 180x180
 * with Apple's non-transparent background expectation. Rendered on
 * demand by Next.js so we don't check in a binary.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#8b5cf6",
          borderRadius: 40,
        }}
      >
        <svg
          width="128"
          height="128"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2.5" y="2.5" width="19" height="19" rx="2.5" />
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
    ),
    size,
  );
}
