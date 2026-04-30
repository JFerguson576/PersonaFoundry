import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { TrafficFlowTracker } from "@/components/analytics/TrafficFlowTracker";

export const metadata: Metadata = {
  title: "Personara.ai",
  description: "Strengths-based intelligence for identity, careers, and teams.",
  icons: {
    icon: "/brand/personara-logo-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <TrafficFlowTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
