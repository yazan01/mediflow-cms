"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDate, getInitials } from "@/lib/utils";
import type { Patient } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { ErrorBanner } from "@/components/ErrorBanner";
import { apiFetch } from "@/lib/hooks/useDataFetch";
import type { FetchError } from "@/lib/hooks/useDataFetch";

const BLOOD_LABELS: Record<string, string> = {
  A_POS: "A+", A_NEG: "A−", B_POS: "B+", B_NEG: "B−",
  AB_POS: "AB+", AB_NEG: "AB−", O_POS: "O+", O_NEG: "O−",
};

export default function PatientsPage() {
  const { t } = useLanguage();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<FetchError | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activateId, setActivateId] = useState<string | null>(null);

  const pageSize = 10;

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== "ALL" && { status: statusFilter }),
      });
      const res = await fetch(`/api/patients?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data.data ?? []);
        setTotal(data.total ?? 0);
      } else {
        const body = await res.json().catch(() => ({}));
        setFetchError({ type: "api", status: res.status, message: body.detail ?? `Error ${res.status}` });
      }
    } catch {
      setFetchError({ type: "network", message: "Unable to connect. Check your network connection." });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  async function handleDeactivate(id: string) {
    try {
      await apiFetch(`/api/patients/${id}`, { method: "DELETE" });
      setDeleteId(null); fetchPatients();
    } catch { /* already soft-deleted or network error */ }
  }

  async function handleActivate(id: string) {
    try {
      await apiFetch(`/api/patients/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      });
      setActivateId(null); fetchPatients();
    } catch { /* ignore */ }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {fetchError && <ErrorBanner error={fetchError} onRetry={fetchPatients} />}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.patients.title}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{total} {t.patients.totalPatients}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 border border-[#c4c6cf] bg-white text-[#1a1c1e] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors">
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            {t.patients.importCsv}
          </button>
          <Link
            href="/patients/new"
            className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            {t.patients.addPatient}
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
            <input
              className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              placeholder={t.patients.searchPlaceholder}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3]"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="ALL">{t.patients.allStatuses}</option>
            <option value="ACTIVE">{t.patients.active}</option>
            <option value="INACTIVE">{t.patients.inactive}</option>
          </select>
          <button className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-4 py-2.5 rounded-lg text-sm text-[#1a1c1e] hover:bg-[#f4f3f7] transition-colors">
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t.patients.export}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{t.patients.patient}</th>
                <th className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{t.patients.mrn}</th>
                <th className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{t.patients.phone}</th>
                <th className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{t.patients.bloodType}</th>
                <th className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{t.patients.insurance}</th>
                <th className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{t.patients.lastVisit}</th>
                <th className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{t.common.status}</th>
                <th className="text-right text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
                      <p className="text-sm text-[#74777f]">{t.common.loading}</p>
                    </div>
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#74777f] text-3xl">person_search</span>
                      </div>
                      <p className="text-sm font-semibold text-[#1a1c1e]">{t.patients.noPatients}</p>
                      {!search && (
                        <Link href="/patients/new" className="mt-1 text-sm text-[#1960a3] font-semibold hover:underline">
                          {t.patients.addFirst}
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-[#f4f3f7] transition-colors group">
                    <td className="px-5 py-4 border-b border-[#e3e2e6]">
                      <div className="flex items-center gap-3">
                        {patient.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={patient.photo} alt={`${patient.firstName} ${patient.lastName}`} width={36} height={36} className="w-9 h-9 rounded-full object-cover border border-[#e3e2e6]" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#1a365d] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {getInitials(`${patient.firstName} ${patient.lastName}`)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-[#1a1c1e] group-hover:text-[#1960a3] transition-colors">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-xs text-[#74777f]">
                            {patient.gender === "MALE" ? t.patients.male : patient.gender === "FEMALE" ? t.patients.female : t.patients.other} · {patient.dateOfBirth ? formatDate(patient.dateOfBirth) : "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 border-b border-[#e3e2e6]">
                      <span className="text-xs font-mono font-semibold text-[#43474e] bg-[#f4f3f7] px-2 py-1 rounded">
                        {patient.mrn}
                      </span>
                    </td>
                    <td className="px-5 py-4 border-b border-[#e3e2e6]">
                      <p className="text-sm text-[#1a1c1e]">{patient.phone}</p>
                      {patient.email && <p className="text-xs text-[#74777f] truncate max-w-[150px]">{patient.email}</p>}
                    </td>
                    <td className="px-5 py-4 border-b border-[#e3e2e6]">
                      {patient.bloodType ? (
                        <span className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] px-2 py-1 rounded">
                          {BLOOD_LABELS[patient.bloodType] ?? patient.bloodType}
                        </span>
                      ) : (
                        <span className="text-xs text-[#74777f]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 border-b border-[#e3e2e6]">
                      <p className="text-sm text-[#1a1c1e]">{patient.insuranceProvider ?? t.patients.noInsurance}</p>
                    </td>
                    <td className="px-5 py-4 border-b border-[#e3e2e6]">
                      <p className="text-sm text-[#43474e]">
                        {patient.lastVisit ? formatDate(patient.lastVisit) : t.patients.neverVisited}
                      </p>
                    </td>
                    <td className="px-5 py-4 border-b border-[#e3e2e6]">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          patient.isActive
                            ? "bg-[#ccfbf1] text-[#0d9488]"
                            : "bg-[#e3e2e6] text-[#74777f]"
                        }`}
                      >
                        {patient.isActive ? t.patients.active : t.patients.inactive}
                      </span>
                    </td>
                    <td className="px-5 py-4 border-b border-[#e3e2e6]">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]"
                          title={t.patients.viewProfile}
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </Link>
                        <Link
                          href={`/emr/${patient.id}`}
                          className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]"
                          title={t.patients.viewEmr}
                        >
                          <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
                        </Link>
                        <Link
                          href={`/appointments/new?patient=${patient.id}`}
                          className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]"
                          title={t.patients.bookAppt}
                        >
                          <span className="material-symbols-outlined text-[18px]">event</span>
                        </Link>
                        {patient.isActive ? (
                          <button
                            onClick={() => setDeleteId(patient.id)}
                            className="p-1.5 hover:bg-[#ffdad6] rounded-lg transition-colors text-[#74777f] hover:text-[#ba1a1a]"
                            title={t.patients.deactivate}
                          >
                            <span className="material-symbols-outlined text-[18px]">person_off</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setActivateId(patient.id)}
                            className="p-1.5 hover:bg-[#ccfbf1] rounded-lg transition-colors text-[#74777f] hover:text-[#0d9488]"
                            title={t.patients.activate}
                          >
                            <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#e3e2e6] bg-[#faf9fd]">
            <p className="text-xs text-[#74777f]">
              {t.common.showing} {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} {t.common.of} {total} {t.patients.totalPatients}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                      page === p
                        ? "bg-[#002045] text-white"
                        : "hover:bg-[#f4f3f7] text-[#43474e]"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Activate confirmation modal */}
      {activateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-[#e3e2e6] shadow-[0_8px_32px_rgba(26,54,93,0.15)] p-6 w-full max-w-sm mx-4">
            <div className="w-12 h-12 bg-[#ccfbf1] rounded-2xl flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#0d9488] text-2xl">how_to_reg</span>
            </div>
            <h3 className="text-lg font-bold text-[#1a1c1e] mb-2">{t.patients.activateTitle}</h3>
            <p className="text-sm text-[#74777f] mb-6">
              {t.patients.activateDesc}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setActivateId(null)}
                className="flex-1 border border-[#c4c6cf] bg-white text-[#1a1c1e] py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={() => handleActivate(activateId)}
                className="flex-1 bg-[#0d9488] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {t.patients.activateBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-[#e3e2e6] shadow-[0_8px_32px_rgba(26,54,93,0.15)] p-6 w-full max-w-sm mx-4">
            <div className="w-12 h-12 bg-[#ffdad6] rounded-2xl flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#ba1a1a] text-2xl">person_off</span>
            </div>
            <h3 className="text-lg font-bold text-[#1a1c1e] mb-2">{t.patients.deactivateTitle}</h3>
            <p className="text-sm text-[#74777f] mb-6">
              {t.patients.deactivateDesc}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-[#c4c6cf] bg-white text-[#1a1c1e] py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={() => handleDeactivate(deleteId)}
                className="flex-1 bg-[#ba1a1a] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {t.patients.deactivateBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
