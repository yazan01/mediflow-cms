"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDate, calculateAge } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { ErrorBanner } from "@/components/ErrorBanner";

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  bloodType: string;
  chronicConditions: string[];
  lastVisit: string | null;
}

export default function EMRIndexPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize),
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const res = await fetch(`/api/patients?${params}`);
      if (!res.ok) throw Object.assign(new Error("API error"), { status: res.status });
      const data = await res.json();
      setPatients(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setFetchError(err as Error);
    } finally { setLoading(false); }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const bloodTypeDisplay: Record<string, string> = {
    A_POS: "A+", A_NEG: "A−", B_POS: "B+", B_NEG: "B−",
    AB_POS: "AB+", AB_NEG: "AB−", O_POS: "O+", O_NEG: "O−",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--txt1)]">{t.emr.title}</h1>
        <p className="text-sm text-[var(--txt2)] mt-0.5">{t.emr.subtitle}</p>
      </div>

      {fetchError && <ErrorBanner error={fetchError} onRetry={fetchPatients} />}

      {/* Search bar */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-4">
        <div className="relative max-w-xl">
          <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[var(--txt2)] text-[20px]">search</span>
          <input
            autoFocus
            className="w-full bg-[var(--surface2)] border-none rounded-lg py-2.5 ps-11 pe-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            placeholder={t.emr.searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Patient grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
        </div>
      ) : patients.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--border)] py-20 flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-[var(--surface2)] rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[var(--txt2)] text-2xl">person_search</span>
          </div>
          <p className="text-sm font-semibold text-[var(--txt1)]">{t.emr.noPatients}</p>
          <p className="text-xs text-[var(--txt2)]">{t.emr.tryDifferent}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[var(--txt2)]">{total} {t.emr.patientsCountPlural} — {t.emr.clickCard}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/emr/${p.id}`)}
                className="bg-white rounded-xl border border-[var(--border)] p-5 text-left hover:border-[#1960a3] hover:shadow-md transition-all duration-150 group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--blue-bg)] flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[var(--blue)] text-[20px]">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--txt1)] group-hover:text-[var(--blue)] transition-colors truncate">
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="text-xs text-[var(--txt2)]">{p.mrn}</p>
                  </div>
                  <span className="material-symbols-outlined text-[#c4c6cf] text-[18px] group-hover:text-[var(--blue)] transition-colors mt-0.5">
                    arrow_forward
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[var(--txt2)]">{t.emr.ageGender}</p>
                    <p className="font-medium text-[var(--txt1)]">
                      {calculateAge(p.dateOfBirth)} {t.emr.yrs} · {p.gender === "MALE" ? t.common.male : t.common.female}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--txt2)]">{t.emr.bloodType}</p>
                    <p className="font-medium text-[var(--txt1)]">{bloodTypeDisplay[p.bloodType] ?? p.bloodType ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[var(--txt2)]">{t.emr.lastVisit}</p>
                    <p className="font-medium text-[var(--txt1)]">{formatDate(p.lastVisit)}</p>
                  </div>
                  <div>
                    <p className="text-[var(--txt2)]">{t.emr.conditions}</p>
                    <p className="font-medium text-[var(--txt1)] truncate">
                      {p.chronicConditions?.length ? p.chronicConditions[0] : t.emr.none}
                    </p>
                  </div>
                </div>

                {p.chronicConditions?.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.chronicConditions.slice(0, 3).map((c) => (
                      <span key={c} className="text-[10px] bg-[var(--warn-bg)] text-[var(--warn)] px-1.5 py-0.5 rounded-full font-medium">{c}</span>
                    ))}
                    {p.chronicConditions.length > 3 && (
                      <span className="text-[10px] bg-[var(--surface2)] text-[var(--txt2)] px-1.5 py-0.5 rounded-full">+{p.chronicConditions.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Pagination */}
          {Math.ceil(total / pageSize) > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-[var(--txt2)]">{t.common.page} {page} {t.common.of} {Math.ceil(total / pageSize)}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-[var(--border2)] hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <button onClick={() => setPage((p) => Math.min(Math.ceil(total / pageSize), p + 1))} disabled={page === Math.ceil(total / pageSize)}
                  className="p-1.5 rounded-lg border border-[var(--border2)] hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
