import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SchemaFlow — Turn SQL into database diagrams",
  description:
    "Visualize your database schema instantly. Paste SQL, explore relationships, and design your database visually.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0d" },
    { media: "(prefers-color-scheme: light)", color: "#f6f7f8" },
  ],
};

const themeBootstrap = `(function(){try{var t=localStorage.getItem("schemaflow:theme");var d=t==="light"?"light":"dark";document.documentElement.setAttribute("data-theme",d);document.documentElement.style.colorScheme=d;}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
