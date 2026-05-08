"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { InsuranceProviderSelect } from "@/components/ui/InsuranceProviderSelect";

type FormData = {
  name: string; dob: string; gender: string; nationality: string; nationalId: string;
  phone: string; email: string; address: string;
  bloodType: string; allergies: string; chronicConditions: string;
  emergencyContactName: string; emergencyContactPhone: string;
  insuranceProvider: string; insurancePolicyNo: string; insuranceExpiry: string;
};

const EMPTY: FormData = {
  name: "", dob: "", gender: "", nationality: "", nationalId: "",
  phone: "", email: "", address: "",
  bloodType: "", allergies: "", chronicConditions: "",
  emergencyContactName: "", emergencyContactPhone: "",
  insuranceProvider: "", insurancePolicyNo: "", insuranceExpiry: "",
};

export default function NewPatientPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const p = t.patients;
  const [form, setForm] = useState<FormData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"personal" | "clinical" | "insurance">("personal");

  function update(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const body = {
        ...form,
        allergies: form.allergies.split(",").map((s) => s.trim()).filter(Boolean),
        chronicConditions: form.chronicConditions.split(",").map((s) => s.trim()).filter(Boolean),
      };
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? p.registrationFailed);
      router.push(`/patients/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : p.registrationFailed);
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { key: "personal",   label: p.tabPersonal,  icon: "person" },
    { key: "clinical",   label: p.tabClinical,  icon: "medical_information" },
    { key: "insurance",  label: p.tabInsurance, icon: "health_and_safety" },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/patients"
          className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors text-[#74777f] hover:text-[#1a1c1e]"
          aria-label={t.common.back}
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{p.registerTitle}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{p.registerDesc}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl">
          <span className="material-symbols-outlined text-[#ba1a1a]">error</span>
          <p className="text-sm text-[#93000a]">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#f4f3f7] rounded-xl mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-white text-[#1960a3] shadow-sm"
                  : "text-[#74777f] hover:text-[#1a1c1e]"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">

          {/* Personal Info Tab */}
          {activeTab === "personal" && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-[#1a1c1e] pb-3 border-b border-[#e3e2e6]">{p.sectionPersonal}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label={`${p.fullNameLabel} *`}>
                  <input required value={form.name} onChange={(e) => update("name", e.target.value)}
                    className="input-field" placeholder={p.fullNamePlaceholder} />
                </Field>
                <Field label={`${p.dateOfBirth} *`}>
                  <input required type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)}
                    className="input-field" />
                </Field>
                <Field label={`${p.genderLabel} *`}>
                  <select required value={form.gender} onChange={(e) => update("gender", e.target.value)}
                    className="input-field">
                    <option value="">{p.selectGender}</option>
                    <option value="MALE">{p.male}</option>
                    <option value="FEMALE">{p.female}</option>
                  </select>
                </Field>
                <Field label={p.nationality}>
                  <input value={form.nationality} onChange={(e) => update("nationality", e.target.value)}
                    className="input-field" placeholder={p.nationalityPlaceholder} />
                </Field>
                <Field label={p.nationalIdPassport}>
                  <input value={form.nationalId} onChange={(e) => update("nationalId", e.target.value)}
                    className="input-field" placeholder={p.idPassportPlaceholder} />
                </Field>
                <Field label={`${p.phoneNumberLabel} *`}>
                  <input required type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
                    className="input-field" placeholder="+962 79 000 0000" />
                </Field>
                <Field label={p.emailAddressLabel}>
                  <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
                    className="input-field" placeholder={p.emailPatientPlaceholder} />
                </Field>
                <Field label={p.addressLabel}>
                  <input value={form.address} onChange={(e) => update("address", e.target.value)}
                    className="input-field" placeholder={p.addressPlaceholder} />
                </Field>
              </div>

              <div className="pt-4 border-t border-[#e3e2e6]">
                <h3 className="text-sm font-semibold text-[#43474e] mb-4">{p.emergencyContact}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label={p.contactName}>
                    <input value={form.emergencyContactName} onChange={(e) => update("emergencyContactName", e.target.value)}
                      className="input-field" placeholder={p.contactNamePlaceholder} />
                  </Field>
                  <Field label={p.contactPhone}>
                    <input type="tel" value={form.emergencyContactPhone} onChange={(e) => update("emergencyContactPhone", e.target.value)}
                      className="input-field" placeholder="+962 79 000 0000" />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* Clinical Info Tab */}
          {activeTab === "clinical" && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-[#1a1c1e] pb-3 border-b border-[#e3e2e6]">{p.sectionClinical}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label={p.bloodTypeLabel}>
                  <select value={form.bloodType} onChange={(e) => update("bloodType", e.target.value)} className="input-field">
                    <option value="">{p.bloodTypeUnknown}</option>
                    {["A_POS","A_NEG","B_POS","B_NEG","AB_POS","AB_NEG","O_POS","O_NEG"].map((b) => (
                      <option key={b} value={b}>
                        {b.replace("_POS", "+").replace("_NEG", "−").replace("_", "")}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label={p.knownAllergies}>
                <textarea
                  value={form.allergies}
                  onChange={(e) => update("allergies", e.target.value)}
                  className="input-field resize-none"
                  rows={3}
                  placeholder={p.allergiesFullPlaceholder}
                />
                <p className="text-xs text-[#74777f] mt-1">{p.separateWithCommas}</p>
              </Field>
              <Field label={p.chronicLabel}>
                <textarea
                  value={form.chronicConditions}
                  onChange={(e) => update("chronicConditions", e.target.value)}
                  className="input-field resize-none"
                  rows={3}
                  placeholder={p.chronicFullPlaceholder}
                />
                <p className="text-xs text-[#74777f] mt-1">{p.separateWithCommas}</p>
              </Field>
            </div>
          )}

          {/* Insurance Tab */}
          {activeTab === "insurance" && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-[#1a1c1e] pb-3 border-b border-[#e3e2e6]">{p.sectionInsurance}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label={p.insuranceProvider}>
                  <InsuranceProviderSelect
                    value={form.insuranceProvider}
                    onChange={(v) => update("insuranceProvider", v)}
                    className="input-field"
                  />
                </Field>
                <Field label={p.insurancePolicy}>
                  <input value={form.insurancePolicyNo} onChange={(e) => update("insurancePolicyNo", e.target.value)}
                    className="input-field" placeholder="Policy or member ID" />
                </Field>
                <Field label={p.insuranceExpiryDate}>
                  <input type="date" value={form.insuranceExpiry} onChange={(e) => update("insuranceExpiry", e.target.value)}
                    className="input-field" />
                </Field>
              </div>

              <div className="p-4 bg-[#eff6ff] border border-[#1960a3]/20 rounded-xl flex gap-3">
                <span className="material-symbols-outlined text-[#1960a3] text-[20px] flex-shrink-0">info</span>
                <p className="text-sm text-[#1a1c1e]">{p.insuranceSelfPay}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-2">
            {activeTab !== "personal" && (
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === "insurance" ? "clinical" : "personal")}
                className="flex items-center gap-2 border border-[#c4c6cf] bg-white text-[#1a1c1e] px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                {t.common.previous}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/patients"
              className="border border-[#c4c6cf] bg-white text-[#1a1c1e] px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
            >
              {t.common.cancel}
            </Link>
            {activeTab !== "insurance" ? (
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === "personal" ? "clinical" : "insurance")}
                className="flex items-center gap-2 bg-[#1960a3] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {t.common.next}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-[#002045] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {p.registering}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    {p.registerBtn}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
