import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "../components/providers";

export const metadata: Metadata = {
  title: "Pharma Chain",
  description: "On-chain pharma batch tracking UI",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
