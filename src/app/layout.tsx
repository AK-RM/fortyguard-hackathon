import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HeatSafe Discharge",
  description: "HeatSafe Discharge for the FortyGuard Hackathon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
