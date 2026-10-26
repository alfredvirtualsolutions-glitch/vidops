import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VidOps — Reel Builder",
  description: "Assemble vertical highlight reels from game clips with Mureka audio and Remotion.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
