import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HeatSafe Discharge",
  description:
    "Assess environmental heat risk before hospital discharge using live FortyGuard data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
