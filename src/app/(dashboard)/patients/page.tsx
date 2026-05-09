"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function PatientsPage() {
  const { t } = useLanguage();
  const [patients,     setPatients]     = useState<Patient[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState<FetchError | null>(null);
  const [search,       setSearch]       = useState("");
  const debouncedSearch                 = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page,         setPage]         = useState(1);
  const [deleteId,     setDeleteId]     = useState<string | null>(null);
  const [activateId,   setActivateId]   = useState<string | null>(null);

  const pageSize = 10;

  const fetchPatients = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== "ALL" && { status: statusFilter }),
      });
      const res = await fetch(`/api/patients?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data.data ?? []); setTotal(data.total ?? 0);
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

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  async function handleDeactivate(id: string) {
    try {
      await apiFetch(`/api/patients/${id}`, { method: "DELETE" });
      setDeleteId(null); fetchPatients();
    } catch { /* soft-deleted */ }
  }

  async function handleActivate(id: string) {
    try {
      await apiFetch(`/api/patients/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) });
      setActivateId(null); fetchPatients();
    } catch { /* ignore */ }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-5 animate-fade-in">
      {fetchError && <ErrorBanner error={fetchError} onRetry={fetchPatients} />}

      {/* ── Page header ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <h1 className="page-title">{t.patients.title}</h1>
          <p className="page-subtitle">
            {total > 0 ? `${total} ${t.patients.totalPatients}` : t.patients.noPatients}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            className="btn-secondary btn-sm hidden sm:flex"
            onClick={() => {/* TODO: export */}}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            {t.patients.export}
          </button>
          <button
            className="btn-secondary btn-sm hidden sm:flex"
            onClick={() => {/* TODO: import */}}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
            {t.patients.importCsv}
          </button>
          <Link href="/patients/new" className="btn-primary btn-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
            {t.patients.addPatient}
          </Link>
        </div>
      </motion.div>

      {/* ── Filters bar ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.35, ease }}
        className="card p-4"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="input-group flex-1">
            <span className="material-symbols-outlined input-icon input-icon-start" style={{ fontSize: 17 }}>search</span>
            <input
              className="search-field"
              placeholder={t.patients.searchPlaceholder}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Status filter */}
          <select
            className="select-field sm:w-44"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="ALL">{t.patients.allStatuses}</option>
            <option value="ACTIVE">{t.patients.active}</option>
            <option value="INACTIVE">{t.patients.inactive}</option>
          </select>

          {/* Mobile actions */}
          <div className="flex gap-2 sm:hidden">
            <button className="btn-secondary flex-1">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
              {t.patients.export}
            </button>
          </div>
        </div>

        {/* Active filters chips */}
        <AnimatePresence>
          {(debouncedSearch || statusFilter !== "ALL") && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 mt-3 pt-3 flex-wrap overflow-hidden"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <span className="text-xs font-semibold" style={{ color: "var(--txt4)" }}>Filters:</span>
              {debouncedSearch && (
                <span className="chip active text-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>search</span>
                  {debouncedSearch}
                  <button onClick={() => setSearch("")}
                    className="material-symbols-outlined" style={{ fontSize: 12 }}>close</button>
                </span>
              )}
              {statusFilter !== "ALL" && (
                <span className="chip active text-xs">
                  {statusFilter}
                  <button onClick={() => setStatusFilter("ALL")}
                    className="material-symbols-outlined" style={{ fontSize: 12 }}>close</button>
                </span>
              )}
              <button
                onClick={() => { setSearch(""); setStatusFilter("ALL"); }}
                className="text-xs font-semibold hover:underline ms-auto"
                style={{ color: "var(--txt3)" }}
              >
                Clear all
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Table ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.10, duration: 0.38, ease }}
        className="table-wrapper"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {[
                  t.patients.patient, t.patients.mrn, t.patients.phone,
                  t.patients.bloodType, t.patients.insurance, t.patients.lastVisit,
                  t.common.status, t.common.actions,
                ].map((h, i) => (
                  <th key={h}
                    className={`table-header ${i === 7 ? "text-end" : "text-start"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                /* Skeleton rows */
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="skeleton w-9 h-9 rounded-full" />
                        <div className="space-y-1.5 flex-1">
                          <div className="skeleton h-3 w-28" />
                          <div className="skeleton h-2.5 w-20" />
                        </div>
                      </div>
                    </td>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="table-cell">
                        <div className="skeleton h-3 w-16" />
                      </td>
                    ))}
                    <td className="table-cell text-end">
                      <div className="flex justify-end gap-1">
                        <div className="skeleton h-7 w-7 rounded-lg" />
                        <div className="skeleton h-7 w-7 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state py-16">
                      <div className="empty-state-icon">
                        <span className="material-symbols-outlined"
                          style={{ fontSize: 28, color: "var(--txt3)",
                            fontVariationSettings: `'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24` }}>
                          person_search
                        </span>
                      </div>
                      <p className="empty-state-title">{t.patients.noPatients}</p>
                      <p className="empty-state-desc">{search ? `No results for "${search}"` : ""}</p>
                      {!search && (
                        <Link href="/patients/new" className="btn-primary btn-sm">
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
                          {t.patients.addFirst}
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                patients.map((patient, idx) => (
                  <motion.tr
                    key={patient.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.25, ease }}
                    className="table-row"
                  >
                    {/* Patient */}
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        {patient.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={patient.photo}
                            alt={`${patient.firstName} ${patient.lastName}`}
                            width={36} height={36}
                            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                            style={{ border: "2px solid var(--border)" }}
                          />
                        ) : (
                          <div className="avatar avatar-md flex-shrink-0">
                            {getInitials(`${patient.firstName} ${patient.lastName}`)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <Link
                            href={`/patients/${patient.id}`}
                            className="text-[13.5px] font-semibold hover:underline block truncate transition-colors"
                            style={{ color: "var(--txt1)" }}
                          >
                            {patient.firstName} {patient.lastName}
                          </Link>
                          <p className="text-[11.5px] truncate mt-0.5" style={{ color: "var(--txt3)" }}>
                            {patient.gender === "MALE"
                              ? t.patients.male
                              : patient.gender === "FEMALE"
                                ? t.patients.female
                                : t.patients.other}{" "}
                            · {patient.dateOfBirth ? formatDate(patient.dateOfBirth) : "—"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* MRN */}
                    <td className="table-cell">
                      <span
                        className="font-mono text-[11.5px] font-semibold px-2 py-1 rounded-lg"
                        style={{ background: "var(--surface2)", color: "var(--txt2)", border: "1px solid var(--border)" }}
                      >
                        {patient.mrn}
                      </span>
                    </td>

                    {/* Phone */}
                    <td className="table-cell">
                      <p className="text-[13px] font-medium" style={{ color: "var(--txt1)" }}>{patient.phone}</p>
                      {patient.email && (
                        <p className="text-[11.5px] truncate max-w-[150px]" style={{ color: "var(--txt3)" }}>
                          {patient.email}
                        </p>
                      )}
                    </td>

                    {/* Blood type */}
                    <td className="table-cell">
                      {patient.bloodType ? (
                        <span className="badge"
                          style={{ background: "var(--err-soft)", color: "var(--err)", fontWeight: 800 }}>
                          {BLOOD_LABELS[patient.bloodType] ?? patient.bloodType}
                        </span>
                      ) : (
                        <span style={{ color: "var(--txt4)", fontSize: 13 }}>—</span>
                      )}
                    </td>

                    {/* Insurance */}
                    <td className="table-cell">
                      <p className="text-[13px]" style={{ color: patient.insuranceProvider ? "var(--txt1)" : "var(--txt4)" }}>
                        {patient.insuranceProvider ?? t.patients.noInsurance}
                      </p>
                    </td>

                    {/* Last visit */}
                    <td className="table-cell">
                      <p className="text-[13px]" style={{ color: patient.lastVisit ? "var(--txt2)" : "var(--txt4)" }}>
                        {patient.lastVisit ? formatDate(patient.lastVisit) : t.patients.neverVisited}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="table-cell">
                      <span className={`badge ${patient.isActive ? "status-ok" : "status-muted"}`}>
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: patient.isActive ? "var(--teal)" : "var(--txt4)" }}
                        />
                        {patient.isActive ? t.patients.active : t.patients.inactive}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="table-cell text-end">
                      <div className="flex items-center justify-end gap-0.5">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="btn-icon btn-sm"
                          title={t.patients.viewProfile}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>visibility</span>
                        </Link>
                        <Link
                          href={`/emr/${patient.id}`}
                          className="btn-icon btn-sm"
                          title={t.patients.viewEmr}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>clinical_notes</span>
                        </Link>
                        <Link
                          href={`/appointments?patientId=${patient.id}&action=book`}
                          className="btn-icon btn-sm"
                          title={t.patients.bookAppt}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>event</span>
                        </Link>
                        {patient.isActive ? (
                          <button
                            onClick={() => setDeleteId(patient.id)}
                            className="btn-icon btn-sm"
                            title={t.patients.deactivate}
                            style={{ color: "var(--err)" }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>person_off</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setActivateId(patient.id)}
                            className="btn-icon btn-sm"
                            title={t.patients.activate}
                            style={{ color: "var(--teal)" }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>how_to_reg</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────── */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-5 py-4 border-t"
            style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
          >
            <p className="text-xs" style={{ color: "var(--txt3)" }}>
              {t.common.showing} {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)}{" "}
              {t.common.of} {total} {t.patients.totalPatients}
            </p>
            <div className="pagination">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="pagination-btn"
                aria-label="Previous page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`pagination-btn ${page === p ? "active" : ""}`}>
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="pagination-btn"
                aria-label="Next page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Activate modal ──────────────────────── */}
      <AnimatePresence>
        {activateId && (
          <ConfirmModal
            icon="how_to_reg"
            iconBg="var(--teal-soft)"
            iconColor="var(--teal-h)"
            title={t.patients.activateTitle}
            desc={t.patients.activateDesc}
            confirmLabel={t.patients.activateBtn}
            confirmStyle={{ background: "var(--teal)", color: "#fff" }}
            onCancel={() => setActivateId(null)}
            onConfirm={() => handleActivate(activateId)}
          />
        )}
      </AnimatePresence>

      {/* ── Deactivate modal ────────────────────── */}
      <AnimatePresence>
        {deleteId && (
          <ConfirmModal
            icon="person_off"
            iconBg="var(--err-soft)"
            iconColor="var(--err)"
            title={t.patients.deactivateTitle}
            desc={t.patients.deactivateDesc}
            confirmLabel={t.patients.deactivateBtn}
            confirmStyle={{ background: "var(--err)", color: "#fff" }}
            onCancel={() => setDeleteId(null)}
            onConfirm={() => handleDeactivate(deleteId)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ConfirmModal({
  icon, iconBg, iconColor, title, desc, confirmLabel, cancelLabel, confirmStyle, onCancel, onConfirm,
}: {
  icon: string; iconBg: string; iconColor: string; title: string; desc: string;
  confirmLabel: string; cancelLabel?: string; confirmStyle: React.CSSProperties;
  onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.94, y: 10  }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        className="modal-panel max-w-sm"
      >
        <div className="p-6 text-center">
          <div
            className="icon-box icon-box-lg mx-auto mb-4"
            style={{ background: iconBg, color: iconColor }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 26, fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
            >
              {icon}
            </span>
          </div>
          <h3 className="t-h2 mb-2">{title}</h3>
          <p className="t-body text-center" style={{ color: "var(--txt3)" }}>{desc}</p>
          <div className="flex gap-3 mt-6">
            <button onClick={onCancel} className="btn-secondary flex-1 justify-center">
              {cancelLabel ?? "Cancel"}
            </button>
            <button onClick={onConfirm} className="flex-1 btn-primary justify-center" style={confirmStyle}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
