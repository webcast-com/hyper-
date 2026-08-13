import type { Metadata, Viewport } from "next";
import MobileNav from "./components/MobileNav";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creator Connect",
  description: "A creator-focused social media MVP built with Next.js",
  applicationName: "Creator Connect",
  appleWebApp: {
    capable: true,
    title: "Creator Connect",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#a855f7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <MobileNav />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
