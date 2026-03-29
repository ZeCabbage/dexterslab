import type { Metadata } from "next";
import "./globals.css";
import SystemListener from "./components/SystemListener";

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
        <SystemListener />
        {children}
      </body>
    </html>
  );
}
