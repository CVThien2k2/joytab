import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AppWrapper } from "@/components/wrapper/app-wrapper";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Gốc để Next resolve các URL tương đối trong metadata (OG image, canonical). */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const APP_NAME = "Joytab";
const APP_TAGLINE = "Quản lý thu chi & quỹ nhóm";
const APP_DESCRIPTION =
  "Joytab giúp bạn ghi thu chi, quản lý quỹ nhóm và theo dõi báo cáo dòng tiền ở cùng một nơi.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: [
    "Joytab",
    "quản lý thu chi",
    "sổ thu chi",
    "quỹ nhóm",
    "báo cáo dòng tiền",
  ],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  publisher: APP_NAME,
  referrer: "strict-origin-when-cross-origin",
  formatDetection: { telephone: false, email: false, address: false },
  alternates: { canonical: "/" },
  // favicon.ico đã được Next tự phát từ app/favicon.ico, ở đây chỉ bổ sung
  // bản SVG (scale tốt hơn) và apple-touch-icon.
  icons: {
    icon: [{ url: "/joytab-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon_tile.png", sizes: "1024x1024", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    locale: "vi_VN",
    url: "/",
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
    images: [
      {
        url: "/icon_tile.png",
        width: 1024,
        height: 1024,
        alt: `Logo ${APP_NAME}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
    images: ["/icon_tile.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1113" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      data-theme="blue"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        {/* Không dùng disableTransitionOnChange: prop đó chèn
            `transition: none !important` lên mọi element khi đổi theme, làm mất
            luôn hiệu ứng sun/moon của ThemeModeButton. */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <AppWrapper>{children}</AppWrapper>
          </QueryProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
