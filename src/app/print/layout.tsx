import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/700.css";

export const metadata: Metadata = { title: "MediFlow — Print" };

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
