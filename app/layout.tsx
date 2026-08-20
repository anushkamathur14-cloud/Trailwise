import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Trailwise — product analytics demo",
  description: "Web and mobile analytics, signals, recommendations, and interactive journey previews.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans`}>
        <TooltipProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
