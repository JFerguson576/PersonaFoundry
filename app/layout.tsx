import type { Metadata } from "next";
import { GlobalCommandBar } from "@/components/navigation/GlobalCommandBar"
import "./globals.css";

export const metadata: Metadata = {
  title: "Persona Foundry Platform",
  description: "Career Intelligence, AI Personality Generator, and TeamSync modules in one platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <GlobalCommandBar />
      </body>
    </html>
  );
}
