"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDate, formatDateTime, calculateAge, getInitials } from "@/lib/utils";

const BLOOD_LABELS: Record<string, string> = { A_POS: "A+", A_NEG: "A−", B_POS: "B+", B_NEG: "B−", AB_POS: "AB+", AB_NEG: "AB−", O_POS: "O+", O_NEG: "O−" };

type Tab = "overview" | "appointments" | "emr" | "billing" | "documents";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  useEffect(() => {
    fetch(`/api/patients/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setPatient)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
          <p className="text-sm text-[#74777f]">Loading patient record...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <span className="material-symbols-outlined text-[#c4c6cf] text-5xl">person_off</span>
        <p className="text-sm font-semibold text-[#1a1c1e]">Patient not found</p>
        <button onClick={() => router.push("/patients")} className="text-sm text-[#1960a3] hover:underline">Back to patients</button>
      </div>
    );
  }

  const firstName = patient.firstName as string;
  const lastName = patient.lastName as string;
  const fullName = `${firstName} ${lastName}`;
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview",     label: "Overview",      icon: "person" },
    { key: "appointments", label: "Appointments",  icon: "calendar_month" },
    { key: "emr",          label: "Medical Records", icon: "medical_information" },
    { key: "billing",      label: "Billing",       icon: "receipt_long" },
    { key: "documents",    label: "Documents",     icon: "folder_open" },
  ];

  const appointments = (patient.appointments as unknown[]) ?? [];
  const consultations = (patient.consultations as unknown[]) ?? [];
  const invoices = (patient.invoices as unknown[]) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/patients")} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
          <span className="material-symbols-outlined text-[#74777f]">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{fullName}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">MRN: {patient.mrn as string}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/appointments/new?patientId=${id}`)} className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors">
            <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
            Book Appointment
          </button>
          <button onClick={() => router.push(`/emr/${id}`)} className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">medical_information</span>
            Open EMR
          </button>
        </div>
      </div>

      {/* Patient card */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[#002045] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xl font-bold">{getInitials(fullName)}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 flex-1">
            <Info label="Date of Birth" value={patient.dateOfBirth ? formatDate(patient.dateOfBirth as string) : "—"} />
            <Info label="Age" value={patient.dateOfBirth ? `${calculateAge(patient.dateOfBirth as string)} years` : "—"} />
            <Info label="Gender" value={patient.gender as string} />
            <Info label="Blood Type" value={patient.bloodType ? (BLOOD_LABELS[patient.bloodType as string] ?? patient.bloodType as string) : "—"} blood />
            <Info label="National ID" value={(patient.nationalId as string) ?? "—"} />
            <Info label="Phone" value={(patient.phone as string) ?? "—"} />
            <Info label="Email" value={(patient.email as string) ?? "—"} />
            <Info label="Insurance" value={(patient.insuranceProvider as string) ?? "None"} />
            <Info label="Allergies" value={(patient.allergies as string[])?.join(", ") || "None documented"} full />
            <Info label="Chronic Conditions" value={(patient.chronicConditions as string[])?.join(", ") || "None documented"} full />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#e3e2e6]">
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === t.key
                  ? "border-[#1960a3] text-[#1960a3]"
                  : "border-transparent text-[#74777f] hover:text-[#43474e]"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon="calendar_month" label="Total Appointments" value={String(appointments.length)} color="text-[#1960a3]" bg="bg-[#d3e4ff]" />
            <StatCard icon="medical_information" label="Consultations" value={String(consultations.length)} color="text-[#0d9488]" bg="bg-[#ccfbf1]" />
            <StatCard icon="receipt_long" label="Invoices" value={String(invoices.length)} color="text-[#d97706]" bg="bg-[#fffbeb]" />
          </div>
        )}

        {activeTab === "appointments" && (
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            {appointments.length === 0 ? (
              <EmptyState icon="calendar_month" title="No appointments" subtitle="Appointments for this patient will appear here" />
            ) : (
              <table className="w-full">
                <thead>
                  <tr>{["Date & Time", "Doctor", "Type", "Status", "Reason"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {(appointments as Record<string, unknown>[]).map((a) => (
                    <tr key={a.id as string} className="hover:bg-[#f4f3f7] transition-colors">
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-xs font-mono text-[#43474e]">{formatDateTime(a.scheduledAt as string)}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-sm text-[#1a1c1e]">{((a.doctor as Record<string, unknown>)?.user as Record<string, unknown>)?.name as string ?? "—"}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-sm text-[#43474e]">{a.type as string}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6]">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#d3e4ff] text-[#00477f]">{a.status as string}</span>
                      </td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-sm text-[#74777f]">{(a.reason as string) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "emr" && (
          <div className="space-y-4">
            {consultations.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <EmptyState icon="medical_information" title="No consultations yet" subtitle="EMR entries will appear here after the first consultation" />
              </div>
            ) : (
              (consultations as Record<string, unknown>[]).map((c) => (
                <div key={c.id as string} className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-[#1a1c1e]">{formatDateTime(c.createdAt as string)}</p>
                    <button onClick={() => router.push(`/emr/${id}`)} className="text-xs text-[#1960a3] hover:underline font-semibold">Full EMR</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {!!c.subjective && <Info label="Subjective" value={c.subjective as string} />}
                    {!!c.assessment && <Info label="Assessment" value={c.assessment as string} />}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "billing" && (
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            {invoices.length === 0 ? (
              <EmptyState icon="receipt_long" title="No invoices" subtitle="Billing records for this patient will appear here" />
            ) : (
              <table className="w-full">
                <thead>
                  <tr>{["Invoice #", "Date", "Total", "Paid", "Balance", "Status"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {(invoices as Record<string, unknown>[]).map((inv) => (
                    <tr key={inv.id as string} className="hover:bg-[#f4f3f7] transition-colors">
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-xs font-mono font-semibold text-[#43474e]">{inv.invoiceNo as string}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-xs text-[#74777f]">{formatDate(inv.createdAt as string)}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-sm font-semibold text-[#1a1c1e]">{Number(inv.totalAmount).toFixed(2)}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-sm text-[#0d9488]">{Number(inv.paidAmount).toFixed(2)}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-sm text-[#ba1a1a]">{Number(inv.balance).toFixed(2)}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6]">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${inv.status === "PAID" ? "bg-[#ccfbf1] text-[#0d9488]" : inv.status === "OVERDUE" ? "bg-[#ffdad6] text-[#ba1a1a]" : "bg-[#fffbeb] text-[#d97706]"}`}>{inv.status as string}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <EmptyState icon="folder_open" title="No documents" subtitle="Patient documents and consent forms will appear here" />
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, full, blood }: { label: string; value: string; full?: boolean; blood?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider">{label}</p>
      {blood && value !== "—" ? (
        <span className="inline-block mt-0.5 text-sm font-bold px-2 py-0.5 rounded bg-[#ffdad6] text-[#ba1a1a]">{value}</span>
      ) : (
        <p className="text-sm text-[#1a1c1e] mt-0.5">{value}</p>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, bg }: { icon: string; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#e3e2e6] p-4 flex items-center gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className={`p-2.5 ${bg} rounded-xl`}><span className={`material-symbols-outlined ${color} text-[22px]`}>{icon}</span></div>
      <div>
        <p className="text-xl font-bold text-[#1a1c1e]">{value}</p>
        <p className="text-xs text-[#74777f]">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="py-16 flex flex-col items-center gap-3">
      <div className="w-14 h-14 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
        <span className="material-symbols-outlined text-[#74777f] text-2xl">{icon}</span>
      </div>
      <p className="text-sm font-semibold text-[#1a1c1e]">{title}</p>
      <p className="text-xs text-[#74777f]">{subtitle}</p>
    </div>
  );
}
