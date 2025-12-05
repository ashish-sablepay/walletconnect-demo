import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SablePay POS - Stablecoin Payments",
  description: "Accept stablecoin payments with ease using WalletConnect Pay and Mesh",
  keywords: ["payment", "crypto", "stablecoin", "USDC", "merchant", "POS"],
  authors: [{ name: "SablePay" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "SablePay POS - Stablecoin Payments",
    description: "Accept stablecoin payments with ease",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
