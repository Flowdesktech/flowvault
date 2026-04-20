import { ImageResponse } from "next/og";

/**
 * Raster PNG favicon alongside `icon.svg`.
 *
 * Next.js emits a numbered `<link rel="icon">` for each `iconN.*` file
 * in `app/`. Some browsers and scrapers (older Safari, older Android
 * WebViews, a handful of RSS readers, and certain social-share
 * crawlers) pick the first PNG they find over an SVG, so we ship both
 * at the same glyph. No binary asset is committed &mdash; the image is
 * generated from this TSX at build time.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <svg
          width="22"
          height="22"
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
    ),
    size,
  );
}
