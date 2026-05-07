"use client";

import { useState, useEffect } from "react";

interface Props {
  appointmentId: string;
  patientName: string;
  doctorName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function QuickConsultationModal({ appointmentId, patientName, doctorName, onClose, onSuccess }: Props) {
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSave() {
    if (!chiefComplaint.trim()) { setError("الشكوى الرئيسية مطلوبة"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, chiefComplaint, assessment, plan }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "فشل الحفظ");
      }
      // Update appointment status to IN_CONSULTATION
      await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_CONSULTATION" }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qc-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e2e6]">
          <div>
            <h2 id="qc-title" className="text-base font-semibold text-[#1a1c1e]">استشارة سريعة</h2>
            <p className="text-xs text-[#74777f] mt-0.5">{patientName} · {doctorName}</p>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="p-2 rounded-lg hover:bg-[#f4f3f7] text-[#74777f]">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-[#ba1a1a] bg-[#ffdad6] rounded-lg px-3 py-2">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#43474e] mb-1">
              الشكوى الرئيسية <span className="text-[#ba1a1a]">*</span>
            </label>
            <textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              rows={2}
              className="input-field w-full resize-none"
              placeholder="صف الشكوى الرئيسية للمريض..."
              aria-required="true"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#43474e] mb-1">التشخيص</label>
            <textarea
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              rows={2}
              className="input-field w-full resize-none"
              placeholder="التشخيص والتقييم..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#43474e] mb-1">خطة العلاج</label>
            <textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              rows={2}
              className="input-field w-full resize-none"
              placeholder="الأدوية والإجراءات المطلوبة..."
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#e3e2e6] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>إلغاء</button>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                حفظ...
              </span>
            ) : "حفظ الاستشارة"}
          </button>
        </div>
      </div>
    </div>
  );
}
