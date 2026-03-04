import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Dashboard",
  description: "Local-first task dashboard powered by Google Sheets"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
