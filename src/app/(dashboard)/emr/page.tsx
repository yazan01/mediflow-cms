"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDate, calculateAge } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize),
        ...(search && { search }),
      });
      const res = await fetch(`/api/patients?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } catch { /* network */ }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const bloodTypeDisplay: Record<string, string> = {
    A_POS: "A+", A_NEG: "A−", B_POS: "B+", B_NEG: "B−",
    AB_POS: "AB+", AB_NEG: "AB−", O_POS: "O+", O_NEG: "O−",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.emr.title}</h1>
        <p className="text-sm text-[#74777f] mt-0.5">{t.emr.subtitle}</p>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] p-4">
        <div className="relative max-w-xl">
          <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[20px]">search</span>
          <input
            autoFocus
            className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 ps-11 pe-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
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
        <div className="bg-white rounded-xl border border-[#e3e2e6] py-20 flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[#74777f] text-2xl">person_search</span>
          </div>
          <p className="text-sm font-semibold text-[#1a1c1e]">{t.emr.noPatients}</p>
          <p className="text-xs text-[#74777f]">{t.emr.tryDifferent}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#74777f]">{total} {t.emr.patientsCountPlural} — {t.emr.clickCard}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/emr/${p.id}`)}
                className="bg-white rounded-xl border border-[#e3e2e6] p-5 text-left hover:border-[#1960a3] hover:shadow-md transition-all duration-150 group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#d3e4ff] flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[#1960a3] text-[20px]">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a1c1e] group-hover:text-[#1960a3] transition-colors truncate">
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="text-xs text-[#74777f]">{p.mrn}</p>
                  </div>
                  <span className="material-symbols-outlined text-[#c4c6cf] text-[18px] group-hover:text-[#1960a3] transition-colors mt-0.5">
                    arrow_forward
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[#74777f]">{t.emr.ageGender}</p>
                    <p className="font-medium text-[#1a1c1e]">
                      {calculateAge(p.dateOfBirth)} {t.emr.yrs} · {p.gender === "MALE" ? t.common.male : t.common.female}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#74777f]">{t.emr.bloodType}</p>
                    <p className="font-medium text-[#1a1c1e]">{bloodTypeDisplay[p.bloodType] ?? p.bloodType ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[#74777f]">{t.emr.lastVisit}</p>
                    <p className="font-medium text-[#1a1c1e]">{formatDate(p.lastVisit)}</p>
                  </div>
                  <div>
                    <p className="text-[#74777f]">{t.emr.conditions}</p>
                    <p className="font-medium text-[#1a1c1e] truncate">
                      {p.chronicConditions?.length ? p.chronicConditions[0] : t.emr.none}
                    </p>
                  </div>
                </div>

                {p.chronicConditions?.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.chronicConditions.slice(0, 3).map((c) => (
                      <span key={c} className="text-[10px] bg-[#fff7ed] text-[#d97706] px-1.5 py-0.5 rounded-full font-medium">{c}</span>
                    ))}
                    {p.chronicConditions.length > 3 && (
                      <span className="text-[10px] bg-[#f4f3f7] text-[#74777f] px-1.5 py-0.5 rounded-full">+{p.chronicConditions.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Pagination */}
          {Math.ceil(total / pageSize) > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-[#74777f]">{t.common.page} {page} {t.common.of} {Math.ceil(total / pageSize)}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <button onClick={() => setPage((p) => Math.min(Math.ceil(total / pageSize), p + 1))} disabled={page === Math.ceil(total / pageSize)}
                  className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed">
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
