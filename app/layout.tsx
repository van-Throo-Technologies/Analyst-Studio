import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AccountMenu } from "@/components/layout/account-menu";
import { DevUserSwitcher } from "@/components/layout/dev-user-switcher";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Analyst Studio",
    template: "%s · Analyst Studio",
  },
  description:
    "Turn raw discovery material into a BA or FA pack, with traceability and quality checks.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-ink">
        <header className="print-hidden sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-3 px-6">
            <Link
              href="/projects"
              className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink"
            >
              <span
                aria-hidden
                className="inline-block h-3.5 w-3.5 rounded-[3px] border-2 border-accent"
              />
              Analyst Studio
            </Link>
            <span className="text-xs text-ink-faint">MVP</span>
            <div className="ml-auto">
              {/* Exactly one of these renders: the switcher when no provider is
                  configured, the account menu when one is. */}
              <AccountMenu />
              <DevUserSwitcher />
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
