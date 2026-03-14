import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dexter's Lab",
  description: "Experimental playground — voice-controlled Raspberry Pi command center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
