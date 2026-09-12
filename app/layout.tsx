import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8">{children}</main>
        <footer className="border-t border-gray-200 px-4 py-4 text-center text-sm text-gray-500">
          Abdul Rehman, completed September 13, 2026
        </footer>
      </body>
    </html>
  );
}
