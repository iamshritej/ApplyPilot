import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApplyPilot",
  description: "AI dashboard for resume matching, optimization, and application tracking"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111314"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
