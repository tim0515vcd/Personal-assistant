import type { Metadata } from "next";
import { Home, Settings } from "lucide-react";
import { NavLinks } from "./NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Assistant",
  description: "我的個人助手",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-6">
            <a href="/" className="flex items-center gap-2 font-semibold text-slate-800 no-underline">
              <Home size={16} />
              個人助手
            </a>
            <nav className="flex gap-1 flex-1">
              <NavLinks />
            </nav>
            <a
              href="/plugins/settings"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors no-underline"
            >
              <Settings size={14} />
              設定
            </a>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
