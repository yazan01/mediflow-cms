import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string | null | undefined, locale = "en-US"): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined, locale = "en-US"): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatTime(date: Date | string | null | undefined, locale = "en-US"): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function calculateAge(dob: Date | string): number {
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]+/g, "");
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + "..." : str;
}

export function printDocument(url: string): void {
  const existing = document.getElementById("__mediflow_print_frame");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__mediflow_print_frame";
  // Off-screen but not display:none — hidden iframes block print in some browsers
  iframe.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const cleanup = () => {
    window.removeEventListener("message", onMessage);
    if (document.getElementById("__mediflow_print_frame")) iframe.remove();
  };

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    if (e.data?.type === "mediflow-ready-to-print") {
      // Print the iframe's document from the parent context — most reliable cross-browser
      iframe.contentWindow?.print();
      // Clean up after the user dismisses the print dialog (60 s is generous)
      setTimeout(cleanup, 60_000);
    }
  };

  window.addEventListener("message", onMessage);

  iframe.src = url;

  // Safety valve: remove if page never signals ready (e.g. auth redirect)
  setTimeout(cleanup, 30_000);
}
