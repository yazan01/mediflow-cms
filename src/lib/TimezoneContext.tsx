"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface TzCtx {
  timezone: string;
  formatDate: (d: Date | string | null | undefined) => string;
  formatTime: (d: Date | string | null | undefined) => string;
  formatDateTime: (d: Date | string | null | undefined) => string;
}

const fallback: TzCtx = {
  timezone: "Asia/Amman",
  formatDate: (d) => d ? new Date(d).toLocaleDateString() : "—",
  formatTime: (d) => d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
  formatDateTime: (d) => d ? new Date(d).toLocaleString() : "—",
};

const TimezoneContext = createContext<TzCtx>(fallback);

export function TimezoneProvider({ children, initialTz = "Asia/Amman" }: {
  children: React.ReactNode;
  initialTz?: string;
}) {
  const [timezone, setTimezone] = useState(initialTz);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.timezone) setTimezone(d.timezone); })
      .catch(() => {});
  }, []);

  function fmt(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions): string {
    if (!d) return "—";
    try {
      return new Intl.DateTimeFormat(undefined, { timeZone: timezone, ...opts }).format(new Date(d));
    } catch {
      return new Date(d).toLocaleString();
    }
  }

  return (
    <TimezoneContext.Provider value={{
      timezone,
      formatDate:     (d) => fmt(d, { year: "numeric", month: "short", day: "numeric" }),
      formatTime:     (d) => fmt(d, { hour: "2-digit", minute: "2-digit" }),
      formatDateTime: (d) => fmt(d, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export const useTimezone = () => useContext(TimezoneContext);
