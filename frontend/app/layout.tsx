import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoPulse AI | Waitlist",
  description:
    "Join the waitlist for early access to GeoPulse AI's private geospatial intelligence platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
