import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from "@/components/ui";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Test Status Reporter",
  description: "Executive test status from TestRail",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen">
        <Nav />
        {children}
      </body>
    </html>
  );
}
