import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediFlow CMS — Clinic Management System",
  description: "Comprehensive ERP platform for modern medical clinics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#faf9fd] text-[#1a1c1e] antialiased">
        {children}
      </body>
    </html>
  );
}
