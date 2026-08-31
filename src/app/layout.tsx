import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jawa Timur Dashboard",
  description: "Operational revenue dashboard for Jawa Timur transactions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
