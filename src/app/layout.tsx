import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Breadcrumbs from "@/components/Breadcrumbs";
import AskAI from "@/components/AskAI";
import ChatBot from "@/components/ChatBot";
import LoginGate from "@/components/LoginGate";
import AccessGuard from "@/components/AccessGuard";
import PageTransition from "@/components/PageTransition";
import { DefaultPasswordBanner } from "@/components/AccountSecurity";
import DigestRunner from "@/components/DigestRunner";
import ShellSwitch from "@/components/ShellSwitch";
import { AppDataProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Rulethu Holdings — ERP",
  description:
    "Rulethu Holdings internal ERP: Investments, Research, Finance, Microfinance, Procurement, Alternatives and HR in one platform.",
  manifest: "/manifest.webmanifest",
  applicationName: "Rulethu",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Rulethu" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b6e4f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('rulethu-theme')||'system';var a=localStorage.getItem('rulethu-accent')||'green';var d=document.documentElement;var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;d.setAttribute('data-theme',r);d.setAttribute('data-accent',a);}catch(e){}})();`,
          }}
        />
        <PWARegister />
        <ShellSwitch standalone={children}>
        <AppDataProvider>
          <AuthProvider>
            <LoginGate>
              <DigestRunner />
              <AskAI />
              <ChatBot />
              <div className="rz-shell flex overflow-hidden">
                <Sidebar />
                <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
                  <Topbar />
                  <div className="rz-scroll flex-1 flex flex-col min-w-0">
                    <Breadcrumbs />
                    <main className="flex-1 px-4 pb-8 pt-2 md:px-8 md:pb-10 max-w-[1440px] w-full mx-auto">
                      <DefaultPasswordBanner />
                      <AccessGuard><PageTransition>{children}</PageTransition></AccessGuard>
                    </main>
                  </div>
                </div>
              </div>
            </LoginGate>
          </AuthProvider>
        </AppDataProvider>
        </ShellSwitch>
      </body>
    </html>
  );
}
